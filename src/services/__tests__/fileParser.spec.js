import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock mammoth.js
vi.mock('mammoth', () => {
  return {
    default: {
      extractRawText: vi.fn().mockImplementation(async ({ arrayBuffer }) => {
        return { value: 'Mocked Word document content' };
      })
    }
  };
});

// Mock pdfjs-dist
vi.mock('pdfjs-dist', () => {
  return {
    GlobalWorkerOptions: {
      workerSrc: ''
    },
    getDocument: vi.fn().mockImplementation(() => {
      return {
        promise: Promise.resolve({
          numPages: 2,
          getPage: async (pageNum) => {
            return {
              getTextContent: async () => {
                return {
                  items: [{ str: `Page ${pageNum} content` }]
                };
              }
            };
          }
        })
      };
    })
  };
});

import { parseResumeFile } from '../fileParser';

describe('fileParser.js', () => {
  it('parses a text file correctly', async () => {
    const textContent = 'This is a sample resume text content.';
    const mockFile = new File([textContent], 'resume.txt', { type: 'text/plain' });

    const result = await parseResumeFile(mockFile);
    expect(result).toBe(textContent);
  });

  it('parses a Word file correctly using Mammoth', async () => {
    const mockFile = new File([''], 'resume.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    
    const result = await parseResumeFile(mockFile);
    expect(result).toBe('Mocked Word document content');
  });

  it('parses a PDF document page by page using pdfjs-dist', async () => {
    const mockFile = new File([''], 'resume.pdf', { type: 'application/pdf' });
    
    const result = await parseResumeFile(mockFile);
    expect(result).toContain('Page 1 content');
    expect(result).toContain('Page 2 content');
  });

  it('truncates content and appends warning message when exceeding 8000 character limit', async () => {
    const baseWord = 'word ';
    const longString = baseWord.repeat(1700); // 8500 characters
    const mockFile = new File([longString], 'long_resume.txt', { type: 'text/plain' });

    const result = await parseResumeFile(mockFile);
    
    expect(result.length).toBe(8000 + '\n\n[Resume truncated to fit API token limits]'.length);
    expect(result.endsWith('[Resume truncated to fit API token limits]')).toBe(true);
    expect(result.substring(0, 8000)).toBe(longString.slice(0, 8000));
  });

  it('throws an error for unsupported extensions', async () => {
    const mockFile = new File(['binary content'], 'document.png', { type: 'image/png' });

    await expect(parseResumeFile(mockFile)).rejects.toThrow('Unsupported file format: .png');
  });

  it('correctly polyfills Uint8Array.prototype.toHex and toBase64', () => {
    const array = new Uint8Array([0, 15, 255, 128]);
    
    expect(array.toHex()).toBe('000fff80');
    // base64 check for [0, 15, 255, 128]
    expect(array.toBase64()).toBe('AA//gA==');
  });
});
