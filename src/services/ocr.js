import { createWorker } from 'tesseract.js';

/**
 * Performs local Wasm-based Optical Character Recognition (OCR) on an image.
 * Extracts raw textual characters from a base64 PNG data URL or Image object.
 * 
 * @param {string|File|Blob} imageSource - The base64 data URL, image file, or Blob.
 * @returns {Promise<string>} The extracted raw text string.
 */
export async function extractTextFromImage(imageSource) {
  if (!imageSource) {
    throw new Error('Image source is required for OCR text extraction.');
  }

  // Initialize a new Tesseract WebAssembly worker specifically for English
  const worker = await createWorker('eng');

  try {
    // Perform text recognition on the source image
    const response = await worker.recognize(imageSource);
    const rawText = response.data.text || '';
    
    // Clean up excessive whitespaces, tabs, and consecutive newlines to optimize token footprint
    return rawText
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  } catch (error) {
    console.error('Tesseract OCR recognition error:', error);
    throw new Error(`OCR Processing Failed: ${error.message}`);
  } finally {
    // Terminate worker to free WebAssembly thread memory
    await worker.terminate();
  }
}
