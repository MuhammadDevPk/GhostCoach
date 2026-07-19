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
              if (this.groqKey) {
                text = await this.transcribeViaGroqWhisper(audioBlob);
              } else if (this.geminiKey) {
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
    const url = 'https://api.groq.com/openai/v1/audio/transcriptions';
    const formData = new FormData();
    formData.append('file', audioBlob, 'speech.webm');
    formData.append('model', 'whisper-large-v3');
    formData.append('response_format', 'json');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.groqKey}`
      },
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || response.statusText || 'Groq Whisper error');
    }

    const result = await response.json();
    return result.text || '';
  }

  /**
   * Transcribe recorded audio blob using Gemini Multimodal input
   */
  async transcribeViaGemini(audioBlob) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.geminiModel}:generateContent?key=${this.geminiKey}`;
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
