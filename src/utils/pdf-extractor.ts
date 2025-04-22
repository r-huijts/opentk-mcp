/**
 * Utility for extracting text from PDF documents
 * 
 * Note: This is a simplified implementation that extracts text from PDF binary data.
 * For a more robust implementation, you might want to use a library like pdf.js or pdfjs-dist.
 */

/**
 * Extracts text from a PDF document
 * @param data The PDF document as an ArrayBuffer
 * @returns The extracted text content
 */
export async function extractTextFromPdf(data: ArrayBuffer): Promise<string> {
  try {
    // Convert ArrayBuffer to Uint8Array
    const pdfData = new Uint8Array(data);
    
    // Simple text extraction by looking for text streams in the PDF
    // This is a very basic implementation and won't work for all PDFs
    // For a more robust solution, use a proper PDF parsing library
    
    // Convert binary data to string for simple text extraction
    const pdfString = new TextDecoder('utf-8').decode(pdfData);
    
    // Extract text streams from the PDF
    // Look for text between "stream" and "endstream" markers
    const textStreams: string[] = [];
    let streamStart = pdfString.indexOf('stream');
    
    while (streamStart !== -1) {
      const streamEnd = pdfString.indexOf('endstream', streamStart);
      if (streamEnd === -1) break;
      
      // Extract the stream content
      const stream = pdfString.substring(streamStart + 6, streamEnd).trim();
      
      // Check if this looks like a text stream (contains readable ASCII characters)
      if (/[\x20-\x7E]{10,}/.test(stream)) {
        textStreams.push(stream);
      }
      
      // Find the next stream
      streamStart = pdfString.indexOf('stream', streamEnd);
    }
    
    // Join all text streams
    let extractedText = textStreams.join('\n\n');
    
    // Clean up the text (remove non-printable characters)
    extractedText = extractedText.replace(/[^\x20-\x7E\n]/g, ' ');
    
    // Remove duplicate spaces
    extractedText = extractedText.replace(/\s+/g, ' ');
    
    return extractedText || 'No text content could be extracted from this PDF.';
  } catch (error) {
    console.error(`Error extracting text from PDF: ${(error as Error).message}`);
    return 'Failed to extract text from the PDF document.';
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
