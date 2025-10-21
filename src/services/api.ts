import { BASE_URL } from '../config.js';
import { extractOverviewFromHtml } from '../utils/html-parser.js';
import https from 'https';

/**
 * Extended RequestInit to support Node.js-specific options like agent
 */
interface NodeRequestInit extends RequestInit {
  agent?: https.Agent;
}

/**
 * Service for interacting with the tkconv API
 */
export class ApiService {
  /**
   * Static HTTPS agent for connection pooling
   * Reuses connections across requests for better performance
   */
  private static agent = new https.Agent({
    keepAlive: true,
    keepAliveMsecs: 30000, // Keep connections alive for 30 seconds
    maxSockets: 10, // Maximum 10 concurrent connections
    maxFreeSockets: 5, // Keep up to 5 idle connections ready
    timeout: 60000 // 60 second socket timeout
  });
  /**
   * Fetches JSON data from the API
   * @param path The API path to fetch
   * @param options Additional fetch options
   * @returns Parsed JSON data
   * @throws Error if the request fails or returns HTML
   */
  async fetchJson<T>(path: string, options: RequestInit = {}): Promise<T> {
    try {
      // Ensure the path starts with a slash
      const normalizedPath = path.startsWith('/') ? path : `/${path}`;

      // Set default headers if not provided
      const headers = {
        'User-Agent': 'Mozilla/5.0 (compatible; OpenTK-MCP/1.0)',
        ...options.headers
      };

      const res = await fetch(`${BASE_URL}${normalizedPath}`, {
        ...options,
        headers,
        agent: ApiService.agent
      } as NodeRequestInit);

      if (!res.ok) {
        throw new Error(`API error: ${res.status} ${res.statusText}`);
      }

      const text = await res.text();

      // Check if the response is HTML
      if (text.trim().startsWith('<!DOCTYPE')) {
        console.error(`The API returned HTML instead of JSON for path: ${normalizedPath}`);
        return {} as T;
      }

      // Parse JSON
      try {
        return JSON.parse(text) as T;
      } catch (error) {
        console.error(`Failed to parse JSON for path: ${normalizedPath}`, error);
        return {} as T;
      }
    } catch (error) {
      console.error(`Error fetching JSON: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Fetches HTML content from the API
   * @param path The API path to fetch
   * @param options Additional fetch options
   * @returns HTML content as string
   * @throws Error if the request fails
   */
  async fetchHtml(path: string, options: RequestInit = {}): Promise<string> {
    try {
      // Ensure the path starts with a slash
      const normalizedPath = path.startsWith('/') ? path : `/${path}`;

      // Set default headers if not provided
      const headers = {
        'User-Agent': 'Mozilla/5.0 (compatible; OpenTK-MCP/1.0)',
        ...options.headers
      };

      const res = await fetch(`${BASE_URL}${normalizedPath}`, {
        ...options,
        headers,
        agent: ApiService.agent
      } as NodeRequestInit);

      if (!res.ok) {
        throw new Error(`API error: ${res.status} ${res.statusText}`);
      }

      return await res.text();
    } catch (error) {
      console.error(`Error fetching HTML: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Fetches binary data from the API
   * @param path The API path to fetch
   * @param options Additional fetch options
   * @returns Binary data as ArrayBuffer and content type
   * @throws Error if the request fails
   */
  async fetchBinary(path: string, options: RequestInit = {}): Promise<{ data: ArrayBuffer, contentType: string }> {
    try {
      // Ensure the path starts with a slash
      const normalizedPath = path.startsWith('/') ? path : `/${path}`;

      // Set default headers if not provided
      const headers = {
        'User-Agent': 'Mozilla/5.0 (compatible; OpenTK-MCP/1.0)',
        ...options.headers
      };

      const res = await fetch(`${BASE_URL}${normalizedPath}`, {
        ...options,
        headers,
        agent: ApiService.agent
      } as NodeRequestInit);

      if (!res.ok) {
        throw new Error(`API error: ${res.status} ${res.statusText}`);
      }

      const data = await res.arrayBuffer();
      const contentType = res.headers.get('content-type') || 'application/octet-stream';

      return { data, contentType };
    } catch (error) {
      console.error(`Error fetching binary data: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Searches for documents in the tkconv API
   * @param query The search query
   * @param options Additional options like twomonths flag
   * @returns Search results
   * @throws Error if the request fails or returns HTML
   */
  async search<T>(query: string, options: { twomonths?: boolean, soorten?: string } = {}): Promise<T> {
    try {
      // Don't sanitize quotes as they're important for exact phrase searches
      // Only sanitize backslashes which could cause issues
      const sanitizedQuery = query.replace(/\\/g, ' ').trim();

      // Use FormData for multipart/form-data
      const formData = new FormData();
      formData.append('q', sanitizedQuery);
      formData.append('twomonths', options.twomonths ? "true" : "false");
      formData.append('soorten', options.soorten || "alles"); // Default to 'alles'

      const res = await fetch(`${BASE_URL}/search`, {
        method: "POST",
        headers: {
          // Remove explicit Content-Type, fetch will set it for FormData
          'Accept': '*/*',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
          'Referer': `${BASE_URL}/search.html?q=${encodeURIComponent(sanitizedQuery)}&twomonths=${options.twomonths ? "true" : "false"}&soorten=${options.soorten || "alles"}`,
          'Origin': BASE_URL,
          'Host': 'berthub.eu',
          'Connection': 'keep-alive',
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'same-origin',
          'sec-ch-ua': '"Chromium";v="135", "Not-A.Brand";v="8"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"macOS"'
        },
        body: formData, // Pass FormData object directly
        agent: ApiService.agent
      } as NodeRequestInit);

      if (!res.ok) {
        // If we get a 500 error, try to use a simplified query instead
        if (res.status === 500) {
          // API returned 500 error - let's investigate before simplifying
          let actualErrorContent = await res.text().catch(() => "Could not read error response body");
          let errorMessage = `Initial request failed with 500: ${res.statusText}. Response: ${actualErrorContent.substring(0, 200)}...`; // Limit length
          console.error(errorMessage); // Log the initial error details

          // Optional: Try simplifying only if the error content suggests it,
          // otherwise, maybe just report the initial 500 error.
          // For now, we'll still try simplifying but provide better final message.

          const simplifiedQuery = sanitizedQuery.split(/\\s+/)[0];

          // Initialize retry error message
          let retryErrorMessage = "Simplification/Retry not attempted or failed.";

          if (simplifiedQuery && simplifiedQuery !== sanitizedQuery) {
            // Retry with simplified query
            console.error(`Retrying search with simplified query: '${simplifiedQuery}'`);

            // Use FormData for the retry as well
            const simplifiedFormData = new FormData();
            simplifiedFormData.append('q', simplifiedQuery);
            simplifiedFormData.append('twomonths', options.twomonths ? "true" : "false");
            simplifiedFormData.append('soorten', options.soorten || "alles"); // Default to 'alles'

            try {
              const retryRes = await fetch(`${BASE_URL}/search`, {
                method: "POST",
                headers: { // Use same headers as initial, without Content-Type
                  'Accept': '*/*',
                  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
                  'Referer': `${BASE_URL}/search.html?q=${encodeURIComponent(simplifiedQuery)}&twomonths=${options.twomonths ? "true" : "false"}&soorten=${options.soorten || "alles"}`,
                  'Origin': BASE_URL,
                  'Host': 'berthub.eu',
                  'Connection': 'keep-alive',
                  'Sec-Fetch-Dest': 'empty',
                  'Sec-Fetch-Mode': 'cors',
                  'Sec-Fetch-Site': 'same-origin',
                  'sec-ch-ua': '"Chromium";v="135", "Not-A.Brand";v="8"',
                  'sec-ch-ua-mobile': '?0',
                  'sec-ch-ua-platform': '"macOS"'
                },
                body: simplifiedFormData, // Pass FormData object
                agent: ApiService.agent
              } as NodeRequestInit);

              if (retryRes.ok) {
                const retryText = await retryRes.text();
                // Check for HTML in retry response too
                if (retryText.trim().startsWith('<!DOCTYPE')) {
                   retryErrorMessage = "Retry attempt returned HTML instead of JSON.";
                   console.error(retryErrorMessage);
                } else {
                  try {
                    const retryData = JSON.parse(retryText);
                    console.error(`Successfully retrieved results with simplified query: '${simplifiedQuery}'. Original query failed.`);
                    // Return only the parsed data, matching the expected type T
                    return retryData as T;
                  } catch (e) {
                    retryErrorMessage = `Retry succeeded but failed to parse JSON response: ${e instanceof Error ? e.message : String(e)}. Response: ${retryText.substring(0, 200)}...`;
                    console.error(retryErrorMessage);
                  }
                }
              } else {
                // Capture retry failure details
                const retryErrorBody = await retryRes.text().catch(() => "Could not read retry error body");
                retryErrorMessage = `Retry with simplified query failed with status: ${retryRes.status} ${retryRes.statusText}. Response: ${retryErrorBody.substring(0, 200)}...`;
                console.error(retryErrorMessage);
              }
            } catch (retryFetchError) {
                 retryErrorMessage = `Fetch error during retry attempt: ${retryFetchError instanceof Error ? retryFetchError.message : String(retryFetchError)}`;
                 console.error(retryErrorMessage);
            }
          } else {
             retryErrorMessage = "Original query was already simple; retry not attempted.";
             console.error(retryErrorMessage);
          }

          // If retry failed or wasn't applicable, return empty results with a more informative error
          // Combine initial error reason and retry outcome.
          const finalErrorMessage = `Search failed for query '${sanitizedQuery}'. Initial error: ${res.status} ${res.statusText}. ${retryErrorMessage}`;
          return {
            results: [],
            error: finalErrorMessage
          } as T;
        }
        // Handle non-500 errors
        const errorBody = await res.text().catch(() => "Could not read error response body");
        throw new Error(`API error: ${res.status} ${res.statusText}. Response: ${errorBody.substring(0, 200)}...`);
      }

      // Check if the response is HTML
      const text = await res.text();
      if (text.trim().startsWith('<!DOCTYPE')) {
        // The API returned HTML instead of JSON
        return { results: [] } as T;
      }

      // Parse JSON
      try {
        return JSON.parse(text) as T;
      } catch (error) {
        // Failed to parse JSON
        return { results: [] } as T;
      }
    } catch (error) {
      // Unexpected error in search
      throw error;
    }
  }

  /**
   * Resolves an external reference to a URL
   * @param extId The external ID to resolve
   * @returns The resolved URL or empty string if not found
   */
  async resolveExternal(extId: string): Promise<string> {
    try {
      // Sanitize the external ID
      const sanitizedExtId = extId.replace(/[\s]+/g, ' ').trim();

      // First try the direct approach with the /op/ endpoint
      try {
        const res = await fetch(`${BASE_URL}/op/${encodeURIComponent(sanitizedExtId)}`, {
          redirect: "manual",
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; OpenTK-MCP/1.0)'
          },
          agent: ApiService.agent
        } as NodeRequestInit);

        // Even if the response is not OK, we still want to check for a location header
        const location = res.headers.get("location") || "";

        // If we didn't get a location header but the response was OK, try to extract from body
        if (!location && res.ok) {
          const text = await res.text();
          // Look for a redirect URL in the response body (simple heuristic)
          const match = text.match(/window\.location\s*=\s*['"]([^'"]+)['"]/);
          if (match && match[1]) {
            return match[1];
          }
        }

        if (location) {
          return location;
        }
      } catch (directError) {
        console.error(`Direct external reference resolution failed: ${(directError as Error).message}`);
      }

      // If the direct approach failed, try to get the document page and extract the link
      try {
        const html = await this.fetchHtml(`/document.html?nummer=${encodeURIComponent(sanitizedExtId)}`);

        // Look for the link to the Tweede Kamer site
        const tkLinkMatch = html.match(/href="(https:\/\/www\.tweedekamer\.nl\/kamerstukken\/[^"]+)"/);
        if (tkLinkMatch && tkLinkMatch[1]) {
          return tkLinkMatch[1];
        }

        // If we couldn't find a TK link, look for any external link
        const anyLinkMatch = html.match(/href="(https?:\/\/[^"]+)"/);
        if (anyLinkMatch && anyLinkMatch[1]) {
          return anyLinkMatch[1];
        }
      } catch (htmlError) {
        console.error(`HTML approach for external reference failed: ${(htmlError as Error).message}`);
      }

      // If all else fails, construct a link to the document page
      return `${BASE_URL}/document.html?nummer=${encodeURIComponent(sanitizedExtId)}`;
    } catch (error) {
      console.error(`Error resolving external reference: ${(error as Error).message}`);
      // Return a fallback URL to the document page
      return `${BASE_URL}/document.html?nummer=${encodeURIComponent(extId)}`;
    }
  }

  /**
   * Fetches a sitemap of URLs for a specific time period
   * @param path The sitemap path (e.g., sitemap-2025.txt)
   * @returns Array of URLs
   */
  async fetchSitemap(path: string): Promise<string[]> {
    try {
      // Sanitize the path
      const sanitizedPath = path.replace(/[\s]+/g, ' ').trim();

      const res = await fetch(`${BASE_URL}/${sanitizedPath}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; OpenTK-MCP/1.0)'
        },
        agent: ApiService.agent
        // We would add timeout here, but it's not supported in the RequestInit type
      } as NodeRequestInit);

      if (!res.ok) {
        // For 404 errors, return an empty array instead of failing
        if (res.status === 404) {
          console.error(`Sitemap not found: ${sanitizedPath}`);
          return [];
        }
        throw new Error(`API error: ${res.status} ${res.statusText}`);
      }

      const text = await res.text();

      // Check if the response is HTML (which would be an error for a sitemap)
      if (text.trim().startsWith('<!DOCTYPE')) {
        console.error(`The API returned HTML instead of a sitemap for path: ${sanitizedPath}`);
        return [];
      }

      return text.trim().split(/\r?\n/).filter(line => line.trim() !== '');
    } catch (error) {
      console.error(`Error fetching sitemap: ${(error as Error).message}`);
      throw error;
    }
  }
  /**
   * Fetches a list of all current Members of Parliament
   * @returns Array of MP data
   */
  async getPersons(): Promise<any[]> {
    try {
      // Fetch the HTML page that contains the MP list
      const html = await this.fetchHtml("/kamerleden.html");

      // Extract MP data from the HTML
      const persons = this.extractPersonsFromHtml(html);

      return persons;
    } catch (error) {
      console.error(`Error fetching persons: ${(error as Error).message}`);
      return [];
    }
  }

  /**
   * Extracts MP data from the HTML of the kamerleden.html page
   * @param html The HTML content of the kamerleden.html page
   * @returns Array of MP data
   */
  private extractPersonsFromHtml(html: string): any[] {
    const persons: any[] = [];

    try {
      // Extract the table rows containing MP data
      const tableRegex = /<table[^>]*>[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/gi;
      const tableMatch = tableRegex.exec(html);

      if (!tableMatch || !tableMatch[1]) {
        console.error("Could not find MP table in HTML");
        return [];
      }

      const tableContent = tableMatch[1];

      // Extract each row (MP) from the table
      const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
      let rowMatch;

      while ((rowMatch = rowRegex.exec(tableContent)) !== null) {
        if (!rowMatch[1]) continue;
        const rowContent = rowMatch[1];

        // Extract the MP ID from the link
        const idRegex = /persoon\.html\?nummer=(\d+)/i;
        const idMatch = rowContent.match(idRegex);
        const id = idMatch?.[1] ? parseInt(idMatch[1], 10) : null;

        if (!id) continue;

        // Extract the MP name
        const nameRegex = /<a[^>]*>([\s\S]*?)<\/a>/i;
        const nameMatch = rowContent.match(nameRegex);
        const fullName = nameMatch?.[1]?.trim() || "";

        // Split the name into first and last name (simple approach)
        const nameParts = fullName.split(" ");
        const firstName = nameParts.length > 1 ? nameParts[0] : "";
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : fullName;

        // Extract the party
        const partyRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
        const cells = [];
        let cellMatch;

        while ((cellMatch = partyRegex.exec(rowContent)) !== null) {
          if (cellMatch[1]) {
            cells.push(cellMatch[1].trim());
          }
        }

        // Party is typically in the second or third cell
        const party = cells.length > 2 ? cells[2] : (cells.length > 1 ? cells[1] : "");

        // Create the person object
        persons.push({
          Id: id,
          Persoonsnummer: id,
          Voornaam: firstName,
          Achternaam: lastName,
          Fullname: fullName,
          Fractie: party,
          FractieAfkorting: party,
          Functie: "Tweede Kamerlid", // Assuming all are MPs
          Links: {
            self: `/persoon.html?nummer=${id}`
          }
        });
      }

      return persons;
    } catch (error) {
      console.error(`Error extracting persons from HTML: ${(error as Error).message}`);
      return [];
    }
  }

  /**
   * Fetches details for a specific Member of Parliament
   * @param id The ID of the MP to fetch
   * @returns MP data or null if not found
   */
  async getPerson(id: number): Promise<any | null> {
    try {
      // Fetch the HTML page for the specific MP
      const html = await this.fetchHtml(`/persoon.html?nummer=${id}`);

      // Extract the MP data from the HTML
      const person = this.extractPersonFromHtml(html, id);

      return person;
    } catch (error) {
      console.error(`Error fetching person with ID ${id}: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Extracts MP data from the HTML of the persoon.html page
   * @param html The HTML content of the persoon.html page
   * @param id The ID of the MP
   * @returns MP data or null if not found
   */
  private extractPersonFromHtml(html: string, id: number): any | null {
    try {
      // Extract the MP name from the title
      const titleRegex = /<title>([\s\S]*?)<\/title>/i;
      const titleMatch = html.match(titleRegex);
      const fullName = titleMatch?.[1]?.trim() || "";

      // Split the name into first and last name (simple approach)
      const nameParts = fullName.split(" ");
      const firstName = nameParts.length > 1 ? nameParts[0] : "";
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : fullName;

      // Extract the party
      const partyRegex = /<h4>([\s\S]*?)<\/h4>/i;
      const partyMatch = html.match(partyRegex);
      const party = partyMatch?.[1]?.trim() || "";

      // Create the person object
      return {
        Id: id,
        Persoonsnummer: id,
        Voornaam: firstName,
        Achternaam: lastName,
        Fullname: fullName,
        Fractie: party,
        FractieAfkorting: party,
        Functie: "Tweede Kamerlid", // Assuming all are MPs
        Links: {
          self: `/persoon.html?nummer=${id}`
        }
      };
    } catch (error) {
      console.error(`Error extracting person from HTML: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Fetches overview data from the main tkconv page
   * @param page The page number to retrieve (default: 1)
   * @returns Overview data including recent documents and birthdays
   */
  async getOverview(page: number = 1): Promise<any> {
    try {
      // Validate page number
      const validatedPage = Math.max(1, page);

      // Fetch the HTML of the main page
      const html = await this.fetchHtml("/");

      // Extract overview data from the HTML with pagination
      const overviewData = extractOverviewFromHtml(html, BASE_URL, validatedPage);

      return overviewData;
    } catch (error) {
      console.error(`Error fetching overview: ${(error as Error).message}`);
      return {
        recentDocuments: [],
        birthdays: [],
        lastUpdated: new Date().toISOString(),
        pagination: {
          currentPage: page,
          hasMoreDocuments: false,
          totalDocumentsRetrieved: 0
        },
        error: (error as Error).message || 'Unknown error'
      };
    }
  }
}

// Export a singleton instance
export const apiService = new ApiService();
