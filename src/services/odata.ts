import fetch from "node-fetch";

/**
 * Service for making requests to the official Dutch Parliament OData API
 */
export class ODataService {
  private readonly BASE_URL = "https://gegevensmagazijn.tweedekamer.nl/OData/v4/2.0";

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
}

// Export a singleton instance
export const odataService = new ODataService();
