/**
 * Utility for extracting text from various document formats
 * Using established libraries for better reliability
 */

// Using require for pdf-parse due to CommonJS module compatibility
const pdfParse = require('pdf-parse');
import * as mammoth from 'mammoth';

/**
 * Extracts text from a PDF document using pdf-parse library
 * @param data The PDF document as a Buffer
 * @returns The extracted text content
 */
export async function extractTextFromPdf(data: ArrayBuffer): Promise<string> {
  try {
    // Convert ArrayBuffer to Buffer for pdf-parse
    const buffer = Buffer.from(data);

    // Parse the PDF
    const result = await pdfParse(buffer);

    // Get the text content
    let extractedText = result.text || '';

    // Clean up the text
    extractedText = extractedText.replace(/\s+/g, ' ').trim();

    if (!extractedText || extractedText.length < 50) {
      return 'The document appears to be a PDF file, but no readable text content could be extracted. This might be due to the document structure, content format, or encryption. Please download the original document for full content.';
    }

    return extractedText;
  } catch (error) {
    console.error(`Error extracting text from PDF: ${(error as Error).message}`);
    return 'Failed to extract text from the PDF document. This might be due to the document structure, content format, or encryption. Please download the original document for full content.';
  }
}

/**
 * Extracts text from a DOCX document using mammoth library
 * @param data The DOCX document as an ArrayBuffer
 * @returns The extracted text content
 */
export async function extractTextFromDocx(data: ArrayBuffer): Promise<string> {
  try {
    // Convert ArrayBuffer to Buffer for mammoth
    const buffer = Buffer.from(data);

    // Extract text from the DOCX
    const result = await mammoth.extractRawText({ buffer });

    // Get the text content
    let extractedText = result.value || '';

    // Clean up the text
    extractedText = extractedText.replace(/\s+/g, ' ').trim();

    if (!extractedText || extractedText.length < 50) {
      return 'The document appears to be a Word file, but no readable text content could be extracted. This might be due to the document structure or content format. Please download the original document for full content.';
    }

    return extractedText;
  } catch (error) {
    console.error(`Error extracting text from DOCX: ${(error as Error).message}`);
    return 'Failed to extract text from the DOCX document. This might be due to the document structure or content format. Please download the original document for full content.';
  }
}

/**
 * Summarizes the extracted text to a reasonable length
 * @param text The full extracted text
 * @param maxLength Maximum length of the summary (default: 8000 characters)
 * @returns The summarized text
 */
export function summarizeText(text: string, maxLength: number = 8000): string {
  if (text.length <= maxLength) {
    return text;
  }

  // Simple approach: Take the first part of the text up to maxLength
  // and add an ellipsis to indicate truncation
  return text.substring(0, maxLength) + '... [Text truncated due to length]';
}
