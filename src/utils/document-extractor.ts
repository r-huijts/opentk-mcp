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

/**
 * Interface for person occurrence results
 */
export interface PersonOccurrence {
  lineStart: number;
  lineEnd: number;
  characterOffset: number;
  snippet: string;
  context: string;
}

/**
 * Finds all occurrences of a person's name in document text using fuzzy matching
 * @param text The full document text to search in
 * @param personName The name or part of a name to search for
 * @returns Array of occurrence objects with location and context information
 */
export function findPersonOccurrences(text: string, personName: string): PersonOccurrence[] {
  if (!text || !personName) {
    return [];
  }

  const occurrences: PersonOccurrence[] = [];
  
  // Split text into lines for line number tracking
  const lines = text.split(/\r?\n/);
  
  // Normalize the search name for fuzzy matching
  const normalizedSearchName = normalizeText(personName);
  
  // Track character positions for each line
  let currentCharOffset = 0;
  const lineOffsets: number[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    lineOffsets.push(currentCharOffset);
    const line = lines[i];
    if (line) {
      currentCharOffset += line.length + 1; // +1 for newline character
    }
  }

  // Search through each line for fuzzy matches
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    if (!line) continue;
    
    const normalizedLine = normalizeText(line);
    
    // Check if the normalized line contains the normalized search name
    if (normalizedLine.includes(normalizedSearchName)) {
      // Find the actual position in the original line
      const matchIndex = findFuzzyMatch(line, personName);
      
      if (matchIndex !== -1) {
        const lineOffset = lineOffsets[lineIndex];
        if (lineOffset !== undefined) {
          const characterOffset = lineOffset + matchIndex;
          
          // Create snippet (30 chars before and after the match)
          const snippetStart = Math.max(0, matchIndex - 30);
          const snippetEnd = Math.min(line.length, matchIndex + personName.length + 30);
          const snippet = line.substring(snippetStart, snippetEnd);
        
          // Create context (2 lines before and after)
          const contextStart = Math.max(0, lineIndex - 2);
          const contextEnd = Math.min(lines.length, lineIndex + 3);
          const context = lines.slice(contextStart, contextEnd).join('\n');
          
          occurrences.push({
            lineStart: lineIndex + 1, // Convert to 1-based line numbers
            lineEnd: lineIndex + 1,
            characterOffset,
            snippet: snippet.trim(),
            context: context.trim()
          });
        }
      }
    }
  }

  return occurrences;
}

/**
 * Find the start of a paragraph near the given position
 * Looks backwards for double newlines or start of text
 */
export function findParagraphStart(text: string, position: number): number {
  // Look backwards for paragraph boundary (double newline)
  for (let i = position; i >= 0; i--) {
    if (text[i] === '\n' && (i === 0 || text[i-1] === '\n')) {
      return i + 1; // Start after the newline
    }
  }
  return 0; // Start of document
}

/**
 * Find the end of a paragraph near the given position
 * Looks forwards for double newlines or end of text
 */
export function findParagraphEnd(text: string, position: number): number {
  // Look forwards for paragraph boundary
  for (let i = position; i < text.length; i++) {
    if (text[i] === '\n' && (i === text.length - 1 || text[i+1] === '\n')) {
      return i; // End at the newline
    }
  }
  return text.length; // End of document
}

/**
 * Normalizes text for fuzzy matching by removing accents, converting to lowercase, and cleaning up whitespace
 * @param text The text to normalize
 * @returns Normalized text
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD') // Decompose accented characters
    .replace(/[\u0300-\u036f]/g, '') // Remove accent marks
    .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Finds the position of a fuzzy match in the original text
 * @param originalText The original text to search in
 * @param searchName The name to search for
 * @returns The character index of the match, or -1 if not found
 */
function findFuzzyMatch(originalText: string, searchName: string): number {
  const normalizedOriginal = normalizeText(originalText);
  const normalizedSearch = normalizeText(searchName);
  
  const index = normalizedOriginal.indexOf(normalizedSearch);
  if (index === -1) {
    return -1;
  }
  
  // Find the corresponding position in the original text
  let originalIndex = 0;
  let normalizedIndex = 0;
  
  while (normalizedIndex < index && originalIndex < originalText.length) {
    const char = originalText[originalIndex];
    if (char) {
      const normalizedChar = normalizeText(char);
      
      if (normalizedChar.length > 0) {
        normalizedIndex += normalizedChar.length;
      }
    }
    originalIndex++;
  }
  
  return originalIndex;
}
