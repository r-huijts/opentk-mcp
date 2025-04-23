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
 * @param offset Starting position for extraction (default: 0)
 * @returns Object containing the summarized text and pagination info
 */
export function summarizeText(text: string, maxLength: number = 8000, offset: number = 0): {
  text: string;
  isTruncated: boolean;
  totalLength: number;
  currentOffset: number;
  nextOffset: number | null;
  remainingLength: number;
} {
  const totalLength = text.length;

  // Validate offset
  if (offset >= totalLength) {
    return {
      text: 'No more content available. You have reached the end of the document.',
      isTruncated: false,
      totalLength,
      currentOffset: offset,
      nextOffset: null,
      remainingLength: 0
    };
  }

  // Extract the portion of text from offset to offset + maxLength
  const endPosition = Math.min(offset + maxLength, totalLength);
  const extractedText = text.substring(offset, endPosition);
  const isTruncated = endPosition < totalLength;

  // Calculate next offset and remaining length
  const nextOffset = isTruncated ? endPosition : null;
  const remainingLength = totalLength - endPosition;

  return {
    text: extractedText + (isTruncated ? '... [Text truncated due to length]' : ''),
    isTruncated,
    totalLength,
    currentOffset: offset,
    nextOffset,
    remainingLength
  };
}
