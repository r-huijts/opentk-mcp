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
  committee?: string;
  url: string;
  type?: string;
}

interface VotingResult {
  id: string;
  title: string;
  date: string;
  result: 'Aangenomen' | 'Verworpen' | 'Ingetrokken' | 'Aangehouden' | string;
  submitter?: string;
  votes?: {
    voor: string[];
    tegen: string[];
    voorAantal: number;
    tegenAantal: number;
  };
  url: string;
}

interface RecentDocument {
  id: string;
  title: string;
  type: string;
  date: string;
  updated: string;
  committee?: string;
  subject?: string;
  url: string;
}

interface BirthdayPerson {
  id: string;
  name: string;
  party?: string;
  url: string;
}

interface OverviewData {
  recentDocuments: RecentDocument[];
  birthdays: BirthdayPerson[];
  lastUpdated: string;
  pagination: {
    currentPage: number;
    hasMoreDocuments: boolean;
    totalDocumentsRetrieved: number;
  };
}

const extractValue = (html: string, regex: RegExp, group: number = 1): string | null => {
  const match = html.match(regex);
  return match && match[group] ? match[group].trim() : null;
};

export function extractDocumentLink(html: string): string | null {
  // Check if the document was not found
  if (html.includes('Found nothing in document.html!!')) {
    return 'NOT_FOUND';
  }

  const match = html.match(/<a href="([^"]+)"[^>]*>Directe link naar document<\/a>/i);
  if (match && match[1]) {
    // Make sure the link starts with 'tkconv/getraw' or 'getraw'
    const link = match[1];
    if (link.startsWith('getraw/')) {
      return link; // Return as is, will be resolved with baseUrl
    }
  }
  return null;
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
    // Ensure the URL includes the /tkconv/ path
    const rawPath = directLinkMatch[1];
    // If baseUrl already includes /tkconv/, this will work correctly
    // If not, we need to add it manually
    if (baseUrl.endsWith('/tkconv')) {
      details.directLinkPdf = `${baseUrl}/${rawPath}`;
    } else if (baseUrl.includes('/tkconv/')) {
      details.directLinkPdf = new URL(rawPath, baseUrl).href;
    } else {
      // Ensure we have /tkconv/ in the path
      details.directLinkPdf = `${baseUrl}/tkconv/${rawPath}`;
    }
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

    // Extract location (zaal) if available
    let location: string | undefined = undefined;
    if (cells.length > 1 && cells[1]) {
      location = cells[1].replace(/<[^>]+>/g, "").trim() || undefined;
    }

    // Extract committee if available
    let committee: string | undefined = undefined;
    if (cells.length > 2 && cells[2]) {
      committee = cells[2].replace(/<[^>]+>/g, "").trim() || undefined;
      // Extract committee name from abbr title if present
      const abbrMatch = cells[2].match(/<abbr title="([^"]+)">/i);
      if (abbrMatch && abbrMatch[1]) {
        committee = abbrMatch[1].trim();
      }
    }

    // Extract title and link from the subject column (index 3)
    if (cells.length <= 3 || !cells[3]) continue;
    const titleCell = cells[3];
    const titleMatch = titleCell.match(/<a href="(activiteit\.html\?nummer=([^"]+))">([^<]+)<\/a>/);

    if (!titleMatch || !titleMatch[1] || !titleMatch[2] || !titleMatch[3]) continue;

    const id = titleMatch[2];
    const url = new URL(titleMatch[1], baseUrl).href;
    const title = titleMatch[3].trim();

    // Extract type/description if available (index 4)
    let type: string | undefined = undefined;
    if (cells.length > 4 && cells[4]) {
      type = cells[4].replace(/<[^>]+>/g, "").trim() || undefined;
    }

    activities.push({
      id: id,
      title: title,
      date: date,
      time,
      location,
      committee,
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

  // Extract all tbody sections (each contains a voting result and its details)
  const tbodyRegex = /<tbody>([\s\S]*?)<\/tbody>/gi;
  let tbodyMatch: RegExpExecArray | null;

  while ((tbodyMatch = tbodyRegex.exec(html)) !== null) {
    if (!tbodyMatch[1]) continue;

    const tbodyContent = tbodyMatch[1];

    // Extract rows within this tbody
    const rows: string[] = [];
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch: RegExpExecArray | null;

    while ((rowMatch = rowRegex.exec(tbodyContent)) !== null) {
      if (rowMatch[1]) {
        rows.push(rowMatch[1]);
      }
    }

    // Need at least the main row and the parties row
    if (rows.length < 2) continue;

    // Process the main row (first row)
    const mainRowContent = rows[0];

    // Extract cells from the main row
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const cells: string[] = [];
    let cellMatch: RegExpExecArray | null;

    while ((cellMatch = cellRegex.exec(mainRowContent as string)) !== null) {
      if (cellMatch[1]) {
        cells.push(cellMatch[1].trim());
      }
    }

    // Need at least date, title, submitter, result, and vote counts
    if (cells.length < 5) continue;

    // Extract date
    const dateCell = cells[0] || "";
    const date = dateCell.replace(/<[^>]+>/g, "").trim();

    // Extract title and link
    const titleCell = cells[1] || "";
    const titleMatch = titleCell.match(/<a href="(zaak\.html\?nummer=([^"]+))">([^<]+)<\/a>/);

    if (!titleMatch || !titleMatch[1] || !titleMatch[2] || !titleMatch[3]) continue;

    const id = titleMatch[2];
    const url = new URL(titleMatch[1], baseUrl).href;
    const title = titleMatch[3].trim();

    // Extract submitter
    const submitter = cells[2] ? cells[2].replace(/<[^>]+>/g, "").trim() : null;

    // Extract result
    const resultCell = cells[3] || "";
    const result = resultCell.replace(/<[^>]+>/g, "").trim();

    // Extract vote counts
    const forVotes = cells[4] ? parseInt(cells[4].replace(/<[^>]+>/g, "").trim(), 10) : 0;
    const againstVotes = cells[5] ? parseInt(cells[5].replace(/<[^>]+>/g, "").trim(), 10) : 0;

    // Process the parties row (second row)
    const partiesRowContent = rows[1];

    // Extract cells from the parties row
    const partiesCells: string[] = [];
    let partiesCellMatch: RegExpExecArray | null;
    const partiesCellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;

    while ((partiesCellMatch = partiesCellRegex.exec(partiesRowContent as string)) !== null) {
      if (partiesCellMatch[1]) {
        partiesCells.push(partiesCellMatch[1].trim());
      }
    }

    // Extract parties that voted for and against
    let forParties: string[] = [];
    let againstParties: string[] = [];

    // Find the cell with "Voor" parties
    const forPartiesCell = partiesCells.find(cell => cell.includes("<b>Voor</b>:")) || "";
    if (forPartiesCell) {
      // Extract the text after "<b>Voor</b>:"
      const forPartiesMatch = forPartiesCell.match(/<b>Voor<\/b>:\s*(.*?)(?:<\/td>|$)/i);
      if (forPartiesMatch && forPartiesMatch[1]) {
        const forPartiesText = forPartiesMatch[1].trim();
        // Split by "|" and trim each party name
        forParties = forPartiesText.split("|").map(p => p.trim()).filter(p => p);
      }
    }

    // Find the cell with "Tegen" parties
    const againstPartiesCell = partiesCells.find(cell => cell.includes("<b>Tegen</b>:")) || "";
    if (againstPartiesCell) {
      // Extract the text after "<b>Tegen</b>:"
      const againstPartiesMatch = againstPartiesCell.match(/<b>Tegen<\/b>:\s*(.*?)(?:<\/td>|$)/i);
      if (againstPartiesMatch && againstPartiesMatch[1]) {
        const againstPartiesText = againstPartiesMatch[1].trim();
        // Split by "|" and trim each party name
        againstParties = againstPartiesText.split("|").map(p => p.trim()).filter(p => p);
      }
    }

    // Create the voting result object with all details
    votingResults.push({
      id,
      title,
      date,
      result,
      submitter: submitter || undefined,
      votes: {
        voor: forParties,
        tegen: againstParties,
        voorAantal: forVotes,
        tegenAantal: againstVotes
      },
      url
    });
  }

  return votingResults;
}

/**
 * Extracts overview information from the main tkconv page
 * @param html The HTML content of the main page
 * @param baseUrl The base URL for resolving relative URLs
 * @param page The page number to retrieve (default: 1)
 * @returns Overview data including recent documents and birthdays
 */
export function extractOverviewFromHtml(html: string, baseUrl: string, page: number = 1): OverviewData {
  if (!html) {
    return {
      recentDocuments: [],
      birthdays: [],
      lastUpdated: new Date().toISOString(),
      pagination: {
        currentPage: 1,
        hasMoreDocuments: false,
        totalDocumentsRetrieved: 0
      }
    };
  }

  const recentDocuments: RecentDocument[] = [];
  const birthdays: BirthdayPerson[] = [];
  let lastUpdated = new Date().toISOString();

  // Extract the table containing recent documents
  const tableRegex = /<table[^>]*>[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/i;
  const tableMatch = html.match(tableRegex);

  if (tableMatch && tableMatch[1]) {
    const tableContent = tableMatch[1];

    // Extract each row (document) from the table
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

      // Need at least date, updated, committee, subject, and title/type
      if (cells.length < 5) continue;

      // Extract date
      const date = cells[0] ? cells[0].replace(/<[^>]+>/g, "").trim() : "";
      if (!date) continue;

      // Extract updated date
      const updated = cells[1] ? cells[1].replace(/<[^>]+>/g, "").trim() : "";

      // Extract committee
      const committee = cells[2] ? cells[2].replace(/<[^>]+>/g, "").trim() : undefined;

      // Extract subject
      const subject = cells[3] ? cells[3].replace(/<[^>]+>/g, "").trim() : undefined;

      // Extract title, type, and document ID from the last cell
      const titleCell = cells[4] || "";

      // Extract document ID and title from the link if present
      const docLinkMatch = titleCell.match(/<a href="document\.html\?nummer=([^"]+)">([\s\S]*?)<\/a>/i);
      let id = "";
      let title = "";
      let url = "";

      if (docLinkMatch && docLinkMatch[1] && docLinkMatch[2]) {
        id = docLinkMatch[1];
        title = docLinkMatch[2].trim();
        url = new URL(`document.html?nummer=${id}`, baseUrl).href;
      } else {
        // If no link, just use the text content
        title = titleCell.replace(/<[^>]+>/g, "").trim();
        // Generate a placeholder ID
        id = `unknown-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        url = baseUrl;
      }

      // Extract document type (usually on the next line after the title)
      const typeMatch = titleCell.match(/<br\s*\/?>\s*(.*?)(?:<|$)/i);
      const type = typeMatch && typeMatch[1] ? typeMatch[1].trim() : "Unknown";

      // Add the document to the list
      recentDocuments.push({
        id,
        title,
        type,
        date,
        updated,
        committee,
        subject,
        url
      });

      // Limit to 20 documents to avoid overwhelming the response
      if (recentDocuments.length >= 20) break;
    }
  }

  // Extract birthdays
  const birthdayRegex = /Jarig vandaag\s*((?:<a[^>]*>[^<]*<\/a>\s*)+)/i;
  const birthdayMatch = html.match(birthdayRegex);

  if (birthdayMatch && birthdayMatch[1]) {
    const birthdayContent = birthdayMatch[1];
    const birthdayLinkRegex = /<a href="persoon\.html\?nummer=([^"]+)">([\s\S]*?)<\/a>/gi;
    let birthdayLinkMatch;

    while ((birthdayLinkMatch = birthdayLinkRegex.exec(birthdayContent)) !== null) {
      if (birthdayLinkMatch[1] && birthdayLinkMatch[2]) {
        const id = birthdayLinkMatch[1];
        const nameWithParty = birthdayLinkMatch[2].trim();

        // Extract name and party if in format "Name (Party)"
        const namePartyMatch = nameWithParty.match(/(.*?)\s*\((.*?)\)\s*$/);
        let name = nameWithParty;
        let party = undefined;

        if (namePartyMatch && namePartyMatch[1] && namePartyMatch[2]) {
          name = namePartyMatch[1].trim();
          party = namePartyMatch[2].trim();
        }

        const url = new URL(`persoon.html?nummer=${id}`, baseUrl).href;

        birthdays.push({
          id,
          name,
          party,
          url
        });
      }
    }
  }

  // For pagination, we would normally need to fetch different pages from the server
  // Since the tkconv site doesn't have explicit pagination, we're simulating it by
  // limiting the number of documents per page and tracking which ones we've shown

  const documentsPerPage = 10;
  const startIndex = (page - 1) * documentsPerPage;
  const endIndex = startIndex + documentsPerPage;

  // Get the documents for the current page
  const paginatedDocuments = recentDocuments.slice(startIndex, endIndex);

  // Check if there are more documents available
  const hasMoreDocuments = endIndex < recentDocuments.length;

  return {
    recentDocuments: paginatedDocuments,
    birthdays, // Birthdays are always shown regardless of page
    lastUpdated,
    pagination: {
      currentPage: page,
      hasMoreDocuments,
      totalDocumentsRetrieved: recentDocuments.length
    }
  };
}
