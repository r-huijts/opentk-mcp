import fetch, { RequestInit } from "node-fetch";

export const BASE_URL = "https://berthub.eu/tkconv";

/**
 * API service for making requests to the tkconv API
 */
export class ApiService {
  /**
   * Fetches JSON data from the API, with HTML response detection
   * @param endpoint The API endpoint to fetch from
   * @param options Additional fetch options
   * @returns Parsed JSON data
   * @throws Error if the response is HTML or if the request fails
   */
  async fetchJson<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    try {
      // Sanitize the endpoint to avoid potential issues
      const sanitizedEndpoint = endpoint.replace(/[\s]+/g, ' ').trim();
      const url = `${BASE_URL}${sanitizedEndpoint}`;
      
      // Add default headers for better compatibility
      const res = await fetch(url, {
        headers: { 
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; OpenTK-MCP/1.0)',
          ...options.headers 
        },
        // We would add timeout here, but it's not supported in the RequestInit type
        ...options
      });

      // Handle common error status codes
      if (!res.ok) {
        // For 500 errors, try to return a default empty object
        if (res.status === 500) {
          console.error(`API returned 500 for endpoint: ${sanitizedEndpoint}`);
          return {} as T;
        }
        throw new Error(`API error: ${res.status} ${res.statusText}`);
      }

      // Check if the response is HTML (contains <!DOCTYPE)
      const text = await res.text();
      if (text.trim().startsWith('<!DOCTYPE')) {
        console.error(`The API returned HTML instead of JSON for endpoint: ${sanitizedEndpoint}`);
        return {} as T;
      }

      // If we got JSON, parse it
      try {
        return JSON.parse(text) as T;
      } catch (error) {
        console.error(`Failed to parse JSON for endpoint: ${sanitizedEndpoint}`, error);
        return {} as T;
      }
    } catch (error) {
      console.error(`Unexpected error in fetchJson: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Fetches HTML content from the API
   * @param endpoint The API endpoint to fetch from
   * @param options Additional fetch options
   * @returns HTML content as string
   * @throws Error if the request fails
   */
  async fetchHtml(endpoint: string, options: RequestInit = {}): Promise<string> {
    try {
      // Sanitize the endpoint to avoid potential issues
      const sanitizedEndpoint = endpoint.replace(/[\s]+/g, ' ').trim();
      const url = `${BASE_URL}${sanitizedEndpoint}`;
      
      // Add default headers for better compatibility
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; OpenTK-MCP/1.0)',
          ...options.headers
        },
        // We would add timeout here, but it's not supported in the RequestInit type
        ...options
      });

      if (!res.ok) {
        throw new Error(`API error: ${res.status} ${res.statusText}`);
      }

      return await res.text();
    } catch (error) {
      console.error(`Error fetching HTML from ${endpoint}: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Fetches binary data from the API
   * @param endpoint The API endpoint to fetch from
   * @param options Additional fetch options
   * @returns Binary data as ArrayBuffer and content type
   * @throws Error if the request fails
   */
  async fetchBinary(endpoint: string, options: RequestInit = {}): Promise<{ data: ArrayBuffer, contentType: string }> {
    try {
      // Sanitize the endpoint to avoid potential issues
      const sanitizedEndpoint = endpoint.replace(/[\s]+/g, ' ').trim();
      const url = `${BASE_URL}${sanitizedEndpoint}`;
      
      // Add default headers for better compatibility
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; OpenTK-MCP/1.0)',
          ...options.headers
        },
        // We would add timeout here, but it's not supported in the RequestInit type
        ...options
      });

      if (!res.ok) {
        throw new Error(`API error: ${res.status} ${res.statusText}`);
      }

      // Check if the response is HTML (which would be an error for binary data)
      let contentType = res.headers.get("content-type") || "application/octet-stream";

      // Normalize PDF content types
      if (contentType.includes("pdf") || endpoint.includes(".pdf") || endpoint.includes("getraw")) {
        contentType = "application/pdf";
      }

      // Get the data first
      const data = await res.arrayBuffer();
      const buffer = Buffer.from(data);

      // Check if we got HTML instead of binary data
      if (contentType.includes("text/html")) {
        // Try to detect if it's actually a PDF by checking the first few bytes
        if (buffer.length > 4 && buffer.toString('ascii', 0, 4) === '%PDF') {
          // It's a PDF despite the content type
          contentType = "application/pdf";
        } else {
          throw new Error(`The API returned HTML instead of binary data for endpoint: ${sanitizedEndpoint}`);
        }
      }
      return { data, contentType };
    } catch (error) {
      console.error(`Error fetching binary data from ${endpoint}: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Performs a search using the API
   * @param query The search query
   * @param options Additional options like twomonths flag
   * @returns Search results
   * @throws Error if the request fails or returns HTML
   */
  async search<T>(query: string, options: { twomonths?: boolean, soorten?: string } = {}): Promise<T> {
    try {
      // Sanitize the query to avoid special characters that might cause issues
      const sanitizedQuery = query.replace(/[\"\'\\]/g, ' ').trim();

      // Create form data for POST request (the API expects multipart/form-data)
      const formData = new URLSearchParams();
      formData.append('q', sanitizedQuery);
      formData.append('twomonths', options.twomonths ? "true" : "false");
      formData.append('soorten', options.soorten || "");

      const res = await fetch(`${BASE_URL}/search`, {
        method: "POST",
        headers: {
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
          // Note: Content-Type is set automatically by FormData
        },
        body: formData,
        // We would add timeout here, but it's not supported in the RequestInit type
      });

      if (!res.ok) {
        // If we get a 500 error, try to use a simplified query instead
        if (res.status === 500) {
          console.error(`Search API returned 500 for query: ${sanitizedQuery}`);

          // Try to simplify the query by taking just the first term
          const simplifiedQuery = sanitizedQuery.split(/\s+/)[0];

          if (simplifiedQuery && simplifiedQuery !== sanitizedQuery) {
            console.log(`Retrying with simplified query: ${simplifiedQuery}`);

            // Create new form data with the simplified query
            const simplifiedForm = new URLSearchParams();
            simplifiedForm.append('q', simplifiedQuery);
            simplifiedForm.append('twomonths', options.twomonths ? "true" : "false");
            simplifiedForm.append('soorten', options.soorten || "");

            const retryRes = await fetch(`${BASE_URL}/search`, {
              method: "POST",
              headers: {
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
                // Note: Content-Type is set automatically by FormData
              },
              body: simplifiedForm
            });

            if (retryRes.ok) {
              const retryText = await retryRes.text();
              try {
                const retryData = JSON.parse(retryText);
                return retryData as T;
              } catch (e) {
                // If parsing fails, fall back to empty results
              }
            }
          }

          // If retry failed or wasn't attempted, return empty results with a message
          return { 
            results: [], 
            error: `The search query '${sanitizedQuery}' caused an error in the search API. Try simplifying your query.` 
          } as T;
        }
        throw new Error(`API error: ${res.status} ${res.statusText}`);
      }

      // Check if the response is HTML
      const text = await res.text();
      if (text.trim().startsWith('<!DOCTYPE')) {
        console.error(`The search API returned HTML instead of JSON for query: ${sanitizedQuery}`);
        return { results: [] } as T;
      }

      // Parse JSON
      try {
        return JSON.parse(text) as T;
      } catch (error) {
        console.error(`Failed to parse JSON for query: ${sanitizedQuery}`, error);
        return { results: [] } as T;
      }
    } catch (error) {
      console.error(`Unexpected error in search: ${(error as Error).message}`);
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
          }
        });
        
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
        console.log(`Direct external reference resolution failed: ${(directError as Error).message}`);
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
        console.log(`HTML approach for external reference failed: ${(htmlError as Error).message}`);
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
        // We would add timeout here, but it's not supported in the RequestInit type
      });
      
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
}

// Export a singleton instance
export const apiService = new ApiService();
