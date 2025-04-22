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

interface Committee {
  id: string;
  name: string;
  url: string;
}

interface CommitteeDetails extends Committee {
  description?: string | null;
  members?: Array<{
    name: string;
    id: string;
    party?: string;
    role?: string;
  }>;
  recentActivities?: Array<{
    title: string;
    date: string;
    url: string;
  }>;
}

interface Activity {
  id: string;
  title: string;
  date: string;
  time?: string;
  location?: string;
  url: string;
  type?: string;
}

interface VotingResult {
  id: string;
  title: string;
  date: string;
  result: 'Aangenomen' | 'Verworpen' | 'Ingetrokken' | 'Aangehouden' | string;
  votes?: {
    voor: string[];
    tegen: string[];
  };
  url: string;
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

/**
 * Extracts committee information from the committees HTML page
 * @param html The HTML content of the committees page
 * @param baseUrl The base URL for resolving relative URLs
 * @returns Array of committee objects
 */
export function extractCommitteesFromHtml(html: string, baseUrl: string): Committee[] {
  if (!html) {
    return [];
  }

  const committees: Committee[] = [];

  // Extract the table containing committees
  const tableRegex = /<table[^>]*>[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/i;
  const tableMatch = html.match(tableRegex);

  if (!tableMatch || !tableMatch[1]) {
    return [];
  }

  const tableContent = tableMatch[1];

  // Extract each row (committee) from the table
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;

  while ((rowMatch = rowRegex.exec(tableContent)) !== null) {
    if (!rowMatch[1]) continue;

    const rowContent = rowMatch[1];

    // Extract the committee ID and name from the link
    const linkRegex = /<a href="(commissie\.html\?id=([^"]+))">([^<]+)<\/a>/i;
    const linkMatch = rowContent.match(linkRegex);

    if (linkMatch && linkMatch[1] && linkMatch[2] && linkMatch[3]) {
      const id = linkMatch[2];
      const name = linkMatch[3].trim();
      const url = new URL(linkMatch[1], baseUrl).href;

      committees.push({
        id,
        name,
        url
      });
    }
  }

  return committees;
}

/**
 * Extracts detailed committee information from a committee page
 * @param html The HTML content of the committee page
 * @param baseUrl The base URL for resolving relative URLs
 * @returns Committee details object
 */
export function extractCommitteeDetailsFromHtml(html: string, baseUrl: string, committeeId: string): CommitteeDetails | null {
  if (!html) {
    return null;
  }

  // Extract the committee name from the title tag or h2 tag
  let name = "";

  // First try to get the name from the h2 tag
  const h2Regex = /<h2>([^<]+)<\/h2>/i;
  const h2Match = html.match(h2Regex);
  if (h2Match && h2Match[1]) {
    name = h2Match[1].trim();
  }

  // If not found, try to get it from the title tag
  if (!name) {
    const titleRegex = /<title>([^<]+)<\/title>/i;
    const titleMatch = html.match(titleRegex);
    if (titleMatch && titleMatch[1]) {
      name = titleMatch[1].trim();
    }
  }

  if (!name) {
    return null;
  }

  const details: CommitteeDetails = {
    id: committeeId,
    name,
    url: `${baseUrl}/commissie.html?id=${encodeURIComponent(committeeId)}`,
    members: [],
    recentActivities: []
  };

  // Extract description if available
  const descriptionRegex = /<p class="description">([^<]+)<\/p>/i;
  const descriptionMatch = html.match(descriptionRegex);
  details.description = descriptionMatch?.[1]?.trim() || null;

  // Extract members from the first table
  const membersTableRegex = /<table[^>]*>[\s\S]*?<thead>[\s\S]*?<\/thead>[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/i;
  const membersTableMatch = html.match(membersTableRegex);

  if (membersTableMatch && membersTableMatch[1]) {
    const membersTableContent = membersTableMatch[1];
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch;

    while ((rowMatch = rowRegex.exec(membersTableContent)) !== null) {
      if (!rowMatch[1]) continue;

      const rowContent = rowMatch[1];

      // Extract cells
      const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      const cells: string[] = [];
      let cellMatch;

      while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
        if (cellMatch[1]) {
          cells.push(cellMatch[1].trim());
        }
      }

      if (cells.length < 3) continue;

      // Extract role, name, and party
      const role = cells[1] ? cells[1].replace(/<[^>]+>/g, "").trim() : "";

      // Extract name and ID from the link
      const nameCell = cells[2] || "";
      const nameMatch = nameCell.match(/<a href="persoon\.html\?nummer=([^"]+)">([^<]+)<\/a>/);

      if (!nameMatch || !nameMatch[1] || !nameMatch[2]) continue;

      const id = nameMatch[1];
      const name = nameMatch[2].trim();

      // Extract party if available (might be in the same cell as the name)
      let party = "";
      const partyMatch = nameCell.match(/>([^<]+)<\/a>\s*\(([^)]+)\)/);
      if (partyMatch && partyMatch[2]) {
        party = partyMatch[2].trim();
      }

      details.members?.push({
        id: id,
        name: name,
        role: role || undefined,
        party: party || undefined
      });
    }
  }

  // Extract recent activities from the second table
  const tablesRegex = /<table[^>]*>[\s\S]*?<thead>[\s\S]*?<\/thead>[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/gi;
  let tableMatch;
  let tableCount = 0;
  let activitiesTableContent = "";

  // Find the second table (activities)
  while ((tableMatch = tablesRegex.exec(html)) !== null) {
    tableCount++;
    if (tableCount === 2 && tableMatch[1]) {
      activitiesTableContent = tableMatch[1];
      break;
    }
  }

  if (activitiesTableContent) {
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch;

    while ((rowMatch = rowRegex.exec(activitiesTableContent)) !== null) {
      if (!rowMatch[1]) continue;

      const rowContent = rowMatch[1];

      // Extract cells
      const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      const cells: string[] = [];
      let cellMatch;

      while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
        if (cellMatch[1]) {
          cells.push(cellMatch[1].trim());
        }
      }

      if (cells.length < 2) continue;

      // Extract date
      const date = cells[0] ? cells[0].replace(/<[^>]+>/g, "").trim() : "";
      if (!date) continue;

      // Extract title and link
      const titleCell = cells[1] || "";
      const titleMatch = titleCell.match(/<a href="(activiteit\.html\?nummer=([^"]+))">([^<]+)<\/a>/);

      if (!titleMatch || !titleMatch[1] || !titleMatch[3]) continue;

      const url = new URL(titleMatch[1], baseUrl).href;
      const title = titleMatch[3].trim();

      details.recentActivities?.push({
        title,
        date,
        url
      });
    }
  }

  return details;
}

/**
 * Extracts upcoming activities from the activities HTML page
 * @param html The HTML content of the activities page
 * @param baseUrl The base URL for resolving relative URLs
 * @returns Array of activity objects
 */
export function extractActivitiesFromHtml(html: string, baseUrl: string): Activity[] {
  if (!html) {
    return [];
  }

  const activities: Activity[] = [];

  // Extract the table containing activities
  const tableRegex = /<table[^>]*>[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/i;
  const tableMatch = html.match(tableRegex);

  if (!tableMatch || !tableMatch[1]) {
    return [];
  }

  const tableContent = tableMatch[1];

  // Extract each row (activity) from the table
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;

  while ((rowMatch = rowRegex.exec(tableContent)) !== null) {
    if (!rowMatch[1]) continue;

    const rowContent = rowMatch[1];

    // Extract cells
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const cells: string[] = [];
    let cellMatch;

    while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
      if (cellMatch[1]) {
        cells.push(cellMatch[1].trim());
      }
    }

    if (cells.length < 3) continue;

    // Extract date and time
    if (!cells[0]) continue;
    const dateCell = cells[0];
    const dateMatch = dateCell.match(/(\d{4}-\d{2}-\d{2})(?:\s+(\d{2}:\d{2}))?/);

    if (!dateMatch || !dateMatch[1]) continue;

    const date = dateMatch[1];
    const time = dateMatch[2] || undefined;

    // Extract title and link
    if (!cells[1]) continue;
    const titleCell = cells[1];
    const titleMatch = titleCell.match(/<a href="(activiteit\.html\?nummer=([^"]+))">([^<]+)<\/a>/);

    if (!titleMatch || !titleMatch[1] || !titleMatch[2] || !titleMatch[3]) continue;

    const id = titleMatch[2];
    const url = new URL(titleMatch[1], baseUrl).href;
    const title = titleMatch[3].trim();

    // Extract location if available
    let location: string | undefined = undefined;
    if (cells.length > 2 && cells[2]) {
      location = cells[2].replace(/<[^>]+>/g, "").trim() || undefined;
    }

    // Extract type if available
    let type: string | undefined = undefined;
    if (cells.length > 3 && cells[3]) {
      type = cells[3].replace(/<[^>]+>/g, "").trim() || undefined;
    }

    activities.push({
      id: id,
      title: title,
      date: date,
      time,
      location,
      type,
      url: url
    });
  }

  return activities;
}

/**
 * Extracts voting results from the stemmingen HTML page
 * @param html The HTML content of the stemmingen page
 * @param baseUrl The base URL for resolving relative URLs
 * @returns Array of voting result objects
 */
export function extractVotingResultsFromHtml(html: string, baseUrl: string): VotingResult[] {
  if (!html) {
    return [];
  }

  const votingResults: VotingResult[] = [];

  // Extract the table containing voting results
  const tableRegex = /<table[^>]*>[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/i;
  const tableMatch = html.match(tableRegex);

  if (!tableMatch || !tableMatch[1]) {
    return [];
  }

  const tableContent = tableMatch[1];

  // Extract each row (voting result) from the table
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;

  while ((rowMatch = rowRegex.exec(tableContent)) !== null) {
    if (!rowMatch[1]) continue;

    const rowContent = rowMatch[1];

    // Extract cells
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const cells: string[] = [];
    let cellMatch;

    while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
      if (cellMatch[1]) {
        cells.push(cellMatch[1].trim());
      }
    }

    if (cells.length < 3) continue;

    // Extract date
    if (!cells[0]) continue;
    const dateCell = cells[0];
    const date = dateCell.replace(/<[^>]+>/g, "").trim();

    // Extract title and link
    if (!cells[1]) continue;
    const titleCell = cells[1];
    const titleMatch = titleCell.match(/<a href="(zaak\.html\?nummer=([^"]+))">([^<]+)<\/a>/);

    if (!titleMatch || !titleMatch[1] || !titleMatch[2] || !titleMatch[3]) continue;

    const id = titleMatch[2];
    const url = new URL(titleMatch[1], baseUrl).href;
    const title = titleMatch[3].trim();

    // Extract result
    if (!cells[2]) continue;
    const resultCell = cells[2];
    const result = resultCell.replace(/<[^>]+>/g, "").trim();

    votingResults.push({
      id: id,
      title: title,
      date: date,
      result: result,
      url: url
    });
  }

  return votingResults;
}
