/**
 * Utility for extracting text from DOCX documents
 * 
 * Note: This is a simplified implementation that extracts text from DOCX binary data.
 * For a more robust implementation, you might want to use a library like mammoth.js.
 */

/**
 * Extracts text from a DOCX document
 * @param data The DOCX document as an ArrayBuffer
 * @returns The extracted text content
 */
export async function extractTextFromDocx(data: ArrayBuffer): Promise<string> {
  try {
    // Convert ArrayBuffer to Uint8Array
    const docxData = new Uint8Array(data);
    
    // DOCX files are ZIP archives containing XML files
    // The main content is in word/document.xml
    
    // For a simple implementation, we'll look for text between XML tags
    // This won't handle all formatting but should extract basic text
    const docxString = new TextDecoder('utf-8').decode(docxData);
    
    // Extract text from XML content
    let extractedText = '';
    
    // Look for content in word/document.xml
    const documentXmlStart = docxString.indexOf('<w:document');
    if (documentXmlStart !== -1) {
      const documentXmlEnd = docxString.indexOf('</w:document>', documentXmlStart);
      if (documentXmlEnd !== -1) {
        const documentXml = docxString.substring(documentXmlStart, documentXmlEnd + 12);
        
        // Extract text from w:t tags (text elements in Word XML)
        const textRegex = /<w:t[^>]*>(.*?)<\/w:t>/g;
        let match;
        while ((match = textRegex.exec(documentXml)) !== null) {
          if (match[1]) {
            extractedText += match[1] + ' ';
          }
        }
      }
    }
    
    // If we couldn't extract text from XML, try a simpler approach
    if (!extractedText) {
      // Look for readable text in the file
      const textChunks = docxString.match(/[\x20-\x7E]{10,}/g) || [];
      extractedText = textChunks.join(' ');
    }
    
    // Clean up the text
    extractedText = extractedText.replace(/\s+/g, ' ').trim();
    
    return extractedText || 'No text content could be extracted from this DOCX file.';
  } catch (error) {
    console.error(`Error extracting text from DOCX: ${(error as Error).message}`);
    return 'Failed to extract text from the DOCX document.';
  }
}
