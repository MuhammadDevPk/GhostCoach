import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildProfileApiUrl, fetchRemoteProfile, fetchRemoteQuestions } from '../profileSync';
import * as fileParser from '../fileParser';

vi.mock('../fileParser', () => ({
  parseResumeFile: vi.fn()
}));

global.fetch = vi.fn();

describe('profileSync.js', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('buildProfileApiUrl', () => {
    it('throws error if host is missing or empty', () => {
      expect(() => buildProfileApiUrl({})).toThrow('Server Host domain is not configured');
      expect(() => buildProfileApiUrl({ host: '   ' })).toThrow('Server Host domain is not configured');
    });

    it('builds URL using scheme and host', () => {
      const url = buildProfileApiUrl({ host: 'my-portal.com', scheme: 'https' });
      expect(url).toBe('https://my-portal.com/api/profile');
    });

    it('uses apiPort for HTTP calls and ignores WebSocket port', () => {
      const url = buildProfileApiUrl({ host: 'localhost', port: '8080', apiPort: '8000', scheme: 'http' });
      expect(url).toBe('http://localhost:8000/api/profile');
    });

    it('defaults localhost to http scheme and port 8000 for web API', () => {
      const url = buildProfileApiUrl({ host: 'localhost', port: 8080 });
      expect(url).toBe('http://localhost:8000/api/profile');
    });

    it('strips leading ws. subdomain for HTTP API requests to hit web server instead of Reverb', () => {
      const url = buildProfileApiUrl({ host: 'ws.helper-ext.larawork.com', scheme: 'https', port: '443', apiPort: '8000' });
      expect(url).toBe('https://helper-ext.larawork.com/api/profile');
    });

    it('respects explicit apiHost override if provided', () => {
      const url = buildProfileApiUrl({ host: 'ws.helper-ext.larawork.com', apiHost: 'api.larawork.com', scheme: 'https' });
      expect(url).toBe('https://api.larawork.com/api/profile');
    });

    it('handles host that already includes explicit port', () => {
      const url = buildProfileApiUrl({ host: 'http://localhost:8000' });
      expect(url).toBe('http://localhost:8000/api/profile');
    });
  });



  describe('fetchRemoteProfile', () => {
    const mockSettings = { host: 'my-domain.com', scheme: 'https' };

    it('throws error when server returns non-200 HTTP response', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ message: 'Profile not found' })
      });

      await expect(fetchRemoteProfile({ settings: mockSettings, target: 'all' }))
        .rejects.toThrow('Profile API Error: Profile not found');
    });

    it('parses and returns all fields for target="all"', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          status: 'success',
          profile: {
            ai_training: 'Act as a Senior Architect.',
            candidate_profile: '5+ years experience in Vue.',
            files: [
              { name: 'resume.pdf', url: 'https://my-domain.com/storage/resume.pdf' }
            ]
          }
        })
      });

      // Mock PDF file download
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        blob: async () => new Blob(['pdf binary content'], { type: 'application/pdf' })
      });

      vi.mocked(fileParser.parseResumeFile).mockResolvedValueOnce('Parsed Resume Text');

      const result = await fetchRemoteProfile({ settings: mockSettings, target: 'all' });

      expect(result.systemInstruction).toBe('Act as a Senior Architect.');
      expect(result.persona).toBe('5+ years experience in Vue.');
      expect(result.resumeText).toBe('Parsed Resume Text');
      expect(result.resumeFileName).toBe('resume.pdf');
    });

    it('returns only target="ai_training" updates', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          status: 'success',
          profile: {
            ai_training: 'Strict Senior Persona',
            candidate_profile: 'Ignore me'
          }
        })
      });

      const result = await fetchRemoteProfile({ settings: mockSettings, target: 'ai_training' });
      expect(result.systemInstruction).toBe('Strict Senior Persona');
      expect(result.persona).toBeUndefined();
    });
  });

  describe('fetchRemoteQuestions', () => {
    const mockSettings = { host: 'my-domain.com', scheme: 'https' };

    it('fetches successfully from dedicated /api/questions endpoint', async () => {
      const mockQuestions = [
        { id: 1, title: 'Q1', description: 'Desc 1' },
        { id: 2, title: 'Q2', description: 'Desc 2' }
      ];

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          status: 'success',
          questions: mockQuestions
        })
      });

      const result = await fetchRemoteQuestions(mockSettings);
      expect(result).toEqual(mockQuestions);
    });

    it('falls back to /api/profile questions array if /api/questions 404s', async () => {
      const mockQuestions = [
        { id: 3, title: 'Fallback Q', description: 'Fallback Desc' }
      ];

      // First fetch to /api/questions fails with 404
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({})
      });

      // Second fetch to /api/profile succeeds with questions array in profile
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          status: 'success',
          profile: {
            questions: mockQuestions
          }
        })
      });

      const result = await fetchRemoteQuestions(mockSettings);
      expect(result).toEqual(mockQuestions);
    });

    it('throws error if both dedicated and fallback endpoints fail', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Server Error',
        json: async () => ({ message: 'Dedicated endpoint crashed' })
      });

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Server Error',
        json: async () => ({})
      });

      await expect(fetchRemoteQuestions(mockSettings))
        .rejects.toThrow('Questions API Error: Dedicated endpoint crashed');
    });
  });
});
