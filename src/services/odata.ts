import fetch from "node-fetch";

/**
 * Service for making requests to the official Dutch Parliament OData API
 */
export class ODataService {
  private readonly BASE_URL = "https://gegevensmagazijn.tweedekamer.nl/OData/v4/2.0";

  /**
   * Maps old endpoint names to new ones
   * @param endpoint The original endpoint path
   * @returns The mapped endpoint path
   */
  private mapEndpoint(endpoint: string): string {
    // Map of old endpoint names to new ones
    const endpointMapping: Record<string, string> = {
      '/Personen': '/Persoon',
      '/Activiteiten': '/Activiteit',
      '/Zaken': '/Zaak',
      '/Documenten': '/Document',
      '/Vergaderingen': '/Vergadering',
      '/Verslagen': '/Verslag',
      '/Toezeggingen': '/Toezegging'
    };

    // Check if the endpoint starts with any of the old names
    for (const [oldPrefix, newPrefix] of Object.entries(endpointMapping)) {
      if (endpoint.startsWith(oldPrefix)) {
        return endpoint.replace(oldPrefix, newPrefix);
      }
    }

    return endpoint;
  }

  /**
   * Fetches a list of all current Members of Parliament
   * @returns Array of MP data
   */
  async getPersons(): Promise<any[]> {
    try {
      const res = await fetch(
        `${this.BASE_URL}/Persoon?$filter=Verwijderd eq false and (Functie eq 'Eerste Kamerlid' or Functie eq 'Tweede Kamerlid')`,
        {
          headers: {
            Accept: "application/json",
            'User-Agent': 'Mozilla/5.0 (compatible; OpenTK-MCP/1.0)'
          },
          // We would add timeout here, but it's not supported in the RequestInit type
        }
      );

      if (!res.ok) {
        console.error(`OData API error: ${res.status} ${res.statusText}`);
        return [];
      }

      const text = await res.text();

      try {
        const data = JSON.parse(text) as { value: any[] };
        return data.value || [];
      } catch (error) {
        console.error(`Failed to parse OData API response: ${(error as Error).message}`);
        return [];
      }
    } catch (error) {
      console.error(`Error fetching persons from OData API: ${(error as Error).message}`);
      return [];
    }
  }

  /**
   * Fetches a specific Member of Parliament by ID
   * @param id The ID of the MP to fetch
   * @returns MP data or null if not found
   */
  async getPerson(id: number): Promise<any | null> {
    try {
      // Try with the new endpoint first
      try {
        const res = await fetch(
          `${this.BASE_URL}/Persoon(${id})`,
          {
            headers: {
              Accept: "application/json",
              'User-Agent': 'Mozilla/5.0 (compatible; OpenTK-MCP/1.0)'
            }
          }
        );

        if (!res.ok) {
          throw new Error(`API error: ${res.status} ${res.statusText}`);
        }

        const data = await res.json();
        return data || null;
      } catch (error) {
        // If the new endpoint fails, try the old one as fallback
        console.log(`New endpoint failed, trying old endpoint: ${(error as Error).message}`);

        const fallbackRes = await fetch(
          `${this.BASE_URL}/Personen(${id})`,
          {
            headers: {
              Accept: "application/json",
              'User-Agent': 'Mozilla/5.0 (compatible; OpenTK-MCP/1.0)'
            }
          }
        );

        if (!fallbackRes.ok) {
          throw new Error(`API error: ${fallbackRes.status} ${fallbackRes.statusText}`);
        }

        const fallbackData = await fallbackRes.json();
        return fallbackData || null;
      }
    } catch (error) {
      console.error(`Error fetching person with ID ${id}: ${(error as Error).message}`);
      return null;
    }
  }
}

// Export a singleton instance
export const odataService = new ODataService();
