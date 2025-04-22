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

    // More robust pattern matching for XML content
    // Look for paragraphs and text elements

    // First try to find w:p (paragraph) elements
    const paragraphRegex = /<w:p[^>]*>([\s\S]*?)<\/w:p>/g;
    let paragraphMatch;
    let paragraphs = [];

    while ((paragraphMatch = paragraphRegex.exec(docxString)) !== null) {
      if (paragraphMatch[1]) {
        paragraphs.push(paragraphMatch[1]);
      }
    }

    // If we found paragraphs, extract text from each paragraph
    if (paragraphs.length > 0) {
      for (const paragraph of paragraphs) {
        // Extract text from w:t tags (text elements in Word XML)
        const textRegex = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
        let textMatch;
        let paragraphText = '';

        while ((textMatch = textRegex.exec(paragraph)) !== null) {
          if (textMatch[1]) {
            paragraphText += textMatch[1];
          }
        }

        if (paragraphText) {
          extractedText += paragraphText + '\n';
        }
      }
    }

    // If we couldn't extract text using paragraphs, try direct text extraction
    if (!extractedText) {
      // Extract all text elements directly
      const textRegex = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
      let textMatch;

      while ((textMatch = textRegex.exec(docxString)) !== null) {
        if (textMatch[1]) {
          extractedText += textMatch[1] + ' ';
        }
      }
    }

    // If we still couldn't extract text, try a more general approach
    if (!extractedText) {
      // Look for any XML tags that might contain text
      const xmlTextRegex = />([^<]{5,})</g;
      let xmlTextMatch;

      while ((xmlTextMatch = xmlTextRegex.exec(docxString)) !== null) {
        if (xmlTextMatch[1] && /[a-zA-Z]{3,}/.test(xmlTextMatch[1])) {
          extractedText += xmlTextMatch[1].trim() + ' ';
        }
      }
    }

    // If all XML approaches failed, try a simpler text-based approach
    if (!extractedText) {
      // Look for readable text in the file (sequences of printable ASCII characters)
      const textChunks = docxString.match(/[\x20-\x7E]{10,}/g) || [];
      // Filter out chunks that look like XML tags or file paths
      const filteredChunks = textChunks.filter(chunk =>
        !chunk.includes('<') &&
        !chunk.includes('>') &&
        !chunk.includes('PK') &&
        !chunk.includes('xml') &&
        !chunk.includes('word/') &&
        !chunk.includes('Content_Types')
      );
      extractedText = filteredChunks.join(' ');
    }

    // Clean up the text
    extractedText = extractedText.replace(/\s+/g, ' ').trim();

    // If we still couldn't extract meaningful text
    if (!extractedText || extractedText.length < 50) {
      return 'The document appears to be a Word file, but no readable text content could be extracted. This might be due to the document structure or content format. Please download the original document for full content.';
    }

    return extractedText;
  } catch (error) {
    console.error(`Error extracting text from DOCX: ${(error as Error).message}`);
    return 'Failed to extract text from the DOCX document. This might be due to the document structure or content format. Please download the original document for full content.';
  }
}
