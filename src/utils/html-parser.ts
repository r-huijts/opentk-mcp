/**
 * Utility functions for parsing HTML content
 */

/**
 * Extracts the direct document link from a document HTML page
 * @param html The HTML content of the document page
 * @returns The direct link to the document or null if not found
 */
export function extractDocumentLink(html: string): string | null {
  // Look for the direct link pattern in the HTML
  const directLinkRegex = /<a href="(getraw\/[^"]+)">Directe link naar document<\/a>/;
  const directLinkMatch = html.match(directLinkRegex);
  
  if (directLinkMatch && directLinkMatch[1]) {
    return directLinkMatch[1];
  }
  
  // If direct link not found, try to find the iframe source
  const iframeRegex = /<iframe[^>]*src=['"]\.?\/(getraw\/[^'"]+)['"]/;
  const iframeMatch = html.match(iframeRegex);
  
  if (iframeMatch && iframeMatch[1]) {
    return iframeMatch[1];
  }
  
  return null;
}
