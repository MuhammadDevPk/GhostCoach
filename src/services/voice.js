/**
 * Manual Toggle-to-Record Voice Capture and Transcription Service.
 * Records microphone audio from start click to stop click, and transcribes
 * the result via Groq Whisper or Gemini APIs.
 */
export class SpeechToText {
  constructor({ onTranscript, onStatusChange, onError }) {
    this.onTranscript = onTranscript;
    this.onStatusChange = onStatusChange;
    this.onError = onError;

    this.stream = null;
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.isRecording = false;
  }

  /**
   * Start recording the microphone input
   */
  async start({ provider, geminiKey, groqKey, geminiModel }) {
    this.provider = provider;
    this.geminiKey = geminiKey;
    this.groqKey = groqKey;
    this.geminiModel = geminiModel || 'gemini-2.5-flash';

    if (!this.groqKey && !this.geminiKey) {
      throw new Error('Voice transcription requires either a Groq or Gemini API key in settings.');
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioChunks = [];

      let options = {};
      if (MediaRecorder.isTypeSupported('audio/webm')) {
        options = { mimeType: 'audio/webm' };
      } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
        options = { mimeType: 'audio/ogg' };
      }

      this.mediaRecorder = new MediaRecorder(this.stream, options);
      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          this.audioChunks.push(e.data);
        }
      };

      this.mediaRecorder.start();
      this.isRecording = true;
      if (this.onStatusChange) this.onStatusChange(true);

    } catch (err) {
      console.error('Failed to start recording:', err);
      if (this.onError) this.onError(err.message || 'Microphone access error');
      this.cleanupTracks();
    }
  }

  /**
   * Stop recording and transcribe the buffered audio
   * @param {boolean} shouldTranscribe - If false, discards recorded chunks without transcribing
   */
  async stop(shouldTranscribe = true) {
    if (!this.isRecording) return '';
    this.isRecording = false;

    if (this.onStatusChange) this.onStatusChange(false);

    return new Promise((resolve) => {
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(this.audioChunks, { type: this.mediaRecorder.mimeType || 'audio/webm' });
          this.cleanupTracks();

          if (shouldTranscribe && audioBlob.size > 100) {
            try {
              let text = '';

              const hasGroq = Array.isArray(this.groqKey)
                ? this.groqKey.some(k => typeof k === 'string' && k.trim() !== '')
                : typeof this.groqKey === 'string' && this.groqKey.trim() !== '';

              const hasGemini = Array.isArray(this.geminiKey)
                ? this.geminiKey.some(k => typeof k === 'string' && k.trim() !== '')
                : typeof this.geminiKey === 'string' && this.geminiKey.trim() !== '';

              if (hasGroq) {
                try {
                  text = await this.transcribeViaGroqWhisper(audioBlob);
                } catch (err) {
                  console.warn('All Groq Whisper keys failed. Attempting Gemini fallback...', err.message);
                  if (hasGemini) {
                    text = await this.transcribeViaGemini(audioBlob);
                  } else {
                    throw err;
                  }
                }
              } else if (hasGemini) {
                text = await this.transcribeViaGemini(audioBlob);
              }

              if (this.onTranscript) {
                this.onTranscript(text.trim());
              }
              resolve(text.trim());
            } catch (err) {
              console.error('Transcription failed:', err);
              if (this.onError) this.onError(`Transcription Error: ${err.message || err}`);
              resolve('');
            }
          } else {
            resolve('');
          }
        };

        this.mediaRecorder.stop();
      } else {
        this.cleanupTracks();
        resolve('');
      }
    });
  }

  /**
   * Closes audio tracks and cleans up recording state
   */
  cleanupTracks() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.isRecording = false;
  }

  /**
   * Transcribe recorded audio blob using Groq Whisper Large v3
   */
  async transcribeViaGroqWhisper(audioBlob) {
    const keys = (Array.isArray(this.groqKey) ? this.groqKey : [this.groqKey])
      .map(k => typeof k === 'string' ? k.trim() : '')
      .filter(k => k !== '');

    if (keys.length === 0) {
      throw new Error('No valid Groq API keys configured for transcription.');
    }

    const url = 'https://api.groq.com/openai/v1/audio/transcriptions';
    let lastError = null;

    for (let i = 0; i < keys.length; i++) {
      const activeKey = keys[i];
      try {
        const formData = new FormData();
        formData.append('file', audioBlob, 'speech.webm');
        formData.append('model', 'whisper-large-v3');
        formData.append('response_format', 'json');

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${activeKey}`
          },
          body: formData
        });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || response.statusText || 'Groq Whisper error');
      }

      const result = await response.json();
      return result.text || '';

      } catch (error) {
        console.warn(`Groq Whisper transcription key rotation: key ${i + 1}/${keys.length} failed:`, error.message || error);
        lastError = error;

        if (i < keys.length - 1) {
          continue;
        }
      }
    }
    throw new Error(`All Groq Whisper transcription keys failed. Last error: ${lastError ? lastError.message : 'Unknown Error'}`);
  }

  /**
   * Transcribe recorded audio blob using Gemini Multimodal input
   */
  async transcribeViaGemini(audioBlob) {
    const keys = (Array.isArray(this.geminiKey) ? this.geminiKey : [this.geminiKey])
      .map(k => typeof k === 'string' ? k.trim() : '')
      .filter(k => k !== '');

    if (keys.length === 0) {
      throw new Error('No valid Gemini API keys configured for transcription.');
    }

    const base64Audio = await this.blobToBase64(audioBlob);
    const payload = {
      contents: [{
        parts: [
          {
            inlineData: {
              mimeType: audioBlob.type || 'audio/webm',
              data: base64Audio
            }
          },
          {
            text: 'Transcribe the spoken audio in this clip exactly. Do not add any greeting, answers, explanations, or comments. Just return the transcription text.'
          }
        ]
      }]
    };

    let lastError = null;

    for (let i = 0; i < keys.length; i++) {
      const activeKey = keys[i];
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.geminiModel}:generateContent?key=${activeKey}`;

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error?.message || response.statusText || 'Gemini Transcribe error');
        }

        const result = await response.json();
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
        return text ? text.trim() : '';
      } catch (err) {
        console.warn(`Gemini transcription key rotation: key ${i + 1}/${keys.length} failed:`, err.message || err);
        lastError = err;
        if (i < keys.length - 1) {
          continue; // Try next key
        }
      }
    }

    throw new Error(`All Gemini transcription keys failed. Last error: ${lastError ? lastError.message : 'Unknown Error'}`);
  }

  blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64data = reader.result.split(',')[1];
        resolve(base64data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}
