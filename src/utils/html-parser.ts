/**
 * Utility functions for parsing HTML content
 */

interface DocumentDetails {
  title: string | null;
  type: string | null;
  nummer: string | null;
  datum: string | null;
  bijgewerkt: string | null;
  versie: number | null;
  directLinkPdf: string | null;
  tweedekamerLink: string | null;
  bijlageBij: {
    title: string | null;
    nummer: string | null;
    link: string;
  } | null;
}

const extractValue = (html: string, regex: RegExp, group: number = 1): string | null => {
  const match = html.match(regex);
  return match && match[group] ? match[group].trim() : null;
};

export function extractDocumentLink(html: string): string | null {
  const match = html.match(/<a href="([^"]+)"[^>]*>Directe link naar document<\/a>/i);
  return match?.[1] || null;
}

export function extractDocumentDetailsFromHtml(html: string, baseUrl: string): DocumentDetails | null {
  if (!html) {
    return null;
  }

  const details: DocumentDetails = {
    title: null,
    type: null,
    nummer: null,
    datum: null,
    bijgewerkt: null,
    versie: null,
    directLinkPdf: null,
    tweedekamerLink: null,
    bijlageBij: null,
  };

  // Extract basic info
  details.title = extractValue(html, /<hblock>\s*<h2>([\s\S]*?)<\/h2>/i);
  details.type = extractValue(html, /<\/hblock>[\s\S]*?<p><em>([\s\S]*?)<\/em><\/p>/i);

  // Extract metadata line
  const metadataMatch = html.match(/<p>Nummer: <b>(.*?)<\/b>, datum: <b>(.*?)<\/b>, bijgewerkt: <b>(.*?)<\/b>, versie: (\d+)/i);
  if (metadataMatch) {
    details.nummer = metadataMatch[1]?.trim() || null;
    details.datum = metadataMatch[2]?.trim() || null;
    details.bijgewerkt = metadataMatch[3]?.trim() || null;
    details.versie = metadataMatch[4] ? parseInt(metadataMatch[4], 10) : null;
  }

  // Extract links
  const directLinkMatch = html.match(/<a href="(getraw\/[^"']+)">Directe link naar document<\/a>/i);
  if (directLinkMatch && directLinkMatch[1]) {
    // Resolve relative URL
    details.directLinkPdf = new URL(directLinkMatch[1], baseUrl).href;
  }
  details.tweedekamerLink = extractValue(html, /<a href="(https:\/\/www\.tweedekamer\.nl\/[^"']+)">link naar pagina op de Tweede Kamer site<\/a>/i);

  // Extract bijlage bij info
  const bijlageMatch = html.match(/<p>Bijlage bij: <a href="(document\.html\?nummer=[^"]+)">([\s\S]*?)<\/a> \(([^)]+)\)<\/p>/i);
  if (bijlageMatch && bijlageMatch[1]) {
    details.bijlageBij = {
      title: bijlageMatch[2]?.trim() || null,
      nummer: bijlageMatch[3]?.trim() || null,
      link: new URL(bijlageMatch[1], baseUrl).href,
    };
  }

  return details;
}
