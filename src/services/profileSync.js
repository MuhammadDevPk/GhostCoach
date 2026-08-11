import { parseResumeFile } from './fileParser';

/**
 * Constructs the target API URL dynamically based on user's configured settings.
 * Note: HTTP API calls use apiPort (Laravel web server, e.g. 8000) rather than port (WebSocket Reverb, e.g. 8080).
 * @param {Object} settings - App settings object containing host, scheme, and apiPort
 * @param {String} path - API endpoint path (defaults to '/api/profile')
 * @returns {String} Full absolute URL string
 */
export function buildProfileApiUrl(settings, path = '/api/profile') {
  let rawHost = (settings?.apiHost || settings?.host || '').trim();
  if (!rawHost) {
    throw new Error('Server Host domain is not configured in Settings. Please set your Host Domain first.');
  }

  // Strip trailing slashes
  rawHost = rawHost.replace(/\/+$/, '');

  // Extract scheme if present in rawHost
  let scheme = settings?.scheme || '';
  if (/^https?:\/\//i.test(rawHost)) {
    scheme = rawHost.match(/^(https?):\/\//i)[1];
    rawHost = rawHost.replace(/^https?:\/\//i, '');
  }

  // HTTP API requests should hit the Web Server, so strip leading ws. or wss. subdomain if user passed WebSocket host
  if (!settings?.apiHost) {
    rawHost = rawHost.replace(/^wss?\./i, '');
  }

  const isLocal = /^localhost|^127\.0\.0\.1/i.test(rawHost);
  if (!scheme) {
    scheme = isLocal ? 'http' : 'https';
  }

  let finalHost = rawHost;

  // Check if host already specifies a port explicitly (e.g. localhost:8000)
  const hasExplicitPort = /:\d+$/.test(rawHost);

  if (!hasExplicitPort) {
    const rawApiPort = settings?.apiPort ? settings.apiPort.toString().trim() : '';

    if (isLocal) {
      // Local development: HTTP API defaults to port 8000 (Laravel Web Server)
      const apiPort = rawApiPort || '8000';
      finalHost = `${rawHost}:${apiPort}`;
    } else if (rawApiPort && rawApiPort !== '8000' && rawApiPort !== '443' && rawApiPort !== '80') {
      // Production live domain: only append port if user specified a custom non-standard production port
      finalHost = `${rawHost}:${rawApiPort}`;
    }
  }

  return `${scheme}://${finalHost}${path}`;
}


/**
 * On-demand profile fetch service
 * @param {Object} options
 * @param {Object} options.settings - App settings object
 * @param {String} options.target - 'all' | 'ai_training' | 'candidate_profile' | 'resume'
 * @returns {Promise<Object>} Object containing updated fields (systemInstruction, persona, resumeText, resumeFileName)
 */
export async function fetchRemoteProfile({ settings, target = 'all' }) {
  const apiUrl = buildProfileApiUrl(settings);

  const response = await fetch(apiUrl, {
    method: 'GET',
    headers: {
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const msg = errorData.message || response.statusText || `HTTP ${response.status}`;
    throw new Error(`Profile API Error: ${msg}`);
  }

  const data = await response.json();
  if (data.status !== 'success' || !data.profile) {
    throw new Error(data.message || 'Invalid or missing profile payload from server.');
  }

  const profile = data.profile;
  const updates = {};

  // 1. Synchronize AI Training (System Instruction)
  if ((target === 'all' || target === 'ai_training') && typeof profile.ai_training === 'string') {
    updates.systemInstruction = profile.ai_training;
  }

  // 2. Synchronize Candidate Profile (Persona)
  if ((target === 'all' || target === 'candidate_profile') && typeof profile.candidate_profile === 'string') {
    updates.persona = profile.candidate_profile;
  }

  // 3. Synchronize Resume File (Files array)
  if ((target === 'all' || target === 'resume') && Array.isArray(profile.files) && profile.files.length > 0) {
    const firstFile = profile.files[0];
    if (firstFile && firstFile.url) {
      try {
        const fileRes = await fetch(firstFile.url);
        if (!fileRes.ok) {
          throw new Error(`Failed to download remote file (${fileRes.status})`);
        }

        const blob = await fileRes.blob();
        const fileName = firstFile.name || 'remote_resume.pdf';
        const fileObj = new File([blob], fileName, { type: blob.type || 'application/pdf' });

        const parsedText = await parseResumeFile(fileObj);
        updates.resumeText = parsedText;
        updates.resumeFileName = fileName;
      } catch (err) {
        console.warn('Failed to parse remote resume file:', err);
        updates.resumeError = err.message || 'Could not parse remote resume document.';
      }
    }
  }

  return updates;
}
