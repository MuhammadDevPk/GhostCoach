import { describe, it, expect, vi } from 'vitest';
import { extractTextFromImage } from '../ocr';

// Mock tesseract.js worker API to avoid network calls and WebAssembly overhead in unit tests
vi.mock('tesseract.js', () => {
  return {
    createWorker: vi.fn().mockImplementation(async () => {
      return {
        recognize: async (src) => {
          if (src === 'empty') {
            return { data: { text: '' } };
          }
          return { data: { text: 'Extracted interview question: What is JavaScript?' } };
        },
        terminate: async () => {}
      };
    })
  };
});

describe('ocr.js', () => {
  it('extracts text from an image successfully', async () => {
    const text = await extractTextFromImage('valid-image-url-or-base64');
    expect(text).toBe('Extracted interview question: What is JavaScript?');
  });

  it('handles empty text return from OCR engine', async () => {
    const text = await extractTextFromImage('empty');
    expect(text).toBe('');
  });

  it('throws an error if image source parameter is missing', async () => {
    await expect(extractTextFromImage(null)).rejects.toThrow('Image source is required for OCR text extraction.');
  });
});
