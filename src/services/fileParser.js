// Polyfill Promise.try for environments/libraries requiring it (like modern PDF.js builds)
if (typeof Promise.try !== 'function') {
  Promise.try = function (fn, ...args) {
    return new Promise((resolve, reject) => {
      try {
        resolve(fn(...args));
      } catch (err) {
        reject(err);
      }
    });
  };
}

// Polyfill Uint8Array.prototype.toHex for older Chromium versions (Chrome < 128, Electron 29 uses Chrome 122)
if (typeof Uint8Array.prototype.toHex !== 'function') {
  Uint8Array.prototype.toHex = function () {
    let hex = '';
    for (let i = 0; i < this.length; i++) {
      hex += this[i].toString(16).padStart(2, '0');
    }
    return hex;
  };
}

// Polyfill Uint8Array.prototype.toBase64 for older Chromium versions
if (typeof Uint8Array.prototype.toBase64 !== 'function') {
  Uint8Array.prototype.toBase64 = function () {
    let binary = '';
    for (let i = 0; i < this.length; i++) {
      binary += String.fromCharCode(this[i]);
    }
    return window.btoa(binary);
  };
}

import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker using Vite's native worker loader (?worker)
import PDFJSWorker from 'pdfjs-dist/build/pdf.worker.js?worker';
if (typeof PDFJSWorker === 'function') {
  pdfjsLib.GlobalWorkerOptions.workerPort = new PDFJSWorker();
}

// Safety constraint limit: maximum characters to extract to protect free tier API token limits
const TEXT_MAX_LIMIT = 8000;

/**
 * Extracts raw text from an uploaded File object (txt, docx, or pdf).
 * Truncates the result to protect token usage limits.
 * @param {File} file - The file uploaded via input element
 * @returns {Promise<string>} The parsed and truncated text content
 */
export async function parseResumeFile(file) {
  if (!file) {
    throw new Error('No file provided for parsing.');
  }

  const extension = file.name.split('.').pop().toLowerCase();
  let extractedText = '';

  switch (extension) {
    case 'txt':
      extractedText = await parseTxtFile(file);
      break;
    case 'docx':
      extractedText = await parseDocxFile(file);
      break;
    case 'pdf':
      extractedText = await parsePdfFile(file);
      break;
    default:
      throw new Error(`Unsupported file format: .${extension}. Only .txt, .pdf, and .docx are supported.`);
  }

  // Safety Truncation check
  if (extractedText.length > TEXT_MAX_LIMIT) {
    return extractedText.slice(0, TEXT_MAX_LIMIT) + '\n\n[Resume truncated to fit API token limits]';
  }

  return extractedText;
}

/**
 * Parses plain text files using browser's native FileReader
 */
function parseTxtFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(new Error('Failed to read plain text file: ' + e.target.error));
    reader.readAsText(file);
  });
}

/**
 * Parses Microsoft Word (.docx) files using Mammoth.js
 */
function parseDocxFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target.result;
        const result = await mammoth.extractRawText({ arrayBuffer });
        resolve(result.value || '');
      } catch (err) {
        reject(new Error('Failed to parse Word document: ' + err.message));
      }
    };
    reader.onerror = (e) => reject(new Error('Failed to read Word file: ' + e.target.error));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Parses PDF documents page by page using pdfjs-dist
 */
function parsePdfFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target.result;
        
        // Load the PDF document binary data using the inlined web worker
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        
        let fullText = '';
        
        // Loop pages to extract text content streams
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          
          // Join separate text tokens on the page
          const pageText = textContent.items.map(item => item.str).join(' ');
          fullText += pageText + '\n';
        }
        
        resolve(fullText);
      } catch (err) {
        reject(new Error('Failed to parse PDF document: ' + err.message));
      }
    };
    reader.onerror = (e) => reject(new Error('Failed to read PDF file: ' + e.target.error));
    reader.readAsArrayBuffer(file);
  });
}
