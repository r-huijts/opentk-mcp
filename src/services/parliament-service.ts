import { apiService } from "./api.js";

/**
 * Service for accessing parliamentary data using the tkconv API
 */
export class ParliamentService {
  /**
   * Fetches a list of all current Members of Parliament
   * @returns Array of MP data
   */
  async getPersons(): Promise<any[]> {
    try {
      // Fetch the HTML page that contains the MP list
      const html = await apiService.fetchHtml("/kamerleden.html");
      
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
        const rowContent = rowMatch[1];
        
        // Extract the MP ID from the link
        const idRegex = /persoon\.html\?nummer=(\d+)/i;
        const idMatch = rowContent.match(idRegex);
        const id = idMatch ? parseInt(idMatch[1]) : null;
        
        if (!id) continue;
        
        // Extract the MP name
        const nameRegex = /<a[^>]*>([\s\S]*?)<\/a>/i;
        const nameMatch = rowContent.match(nameRegex);
        const fullName = nameMatch ? nameMatch[1].trim() : "";
        
        // Split the name into first and last name (simple approach)
        const nameParts = fullName.split(" ");
        const firstName = nameParts.length > 1 ? nameParts[0] : "";
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : fullName;
        
        // Extract the party
        const partyRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
        const cells = [];
        let cellMatch;
        
        while ((cellMatch = partyRegex.exec(rowContent)) !== null) {
          cells.push(cellMatch[1].trim());
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
      const html = await apiService.fetchHtml(`/persoon.html?nummer=${id}`);
      
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
      const fullName = titleMatch ? titleMatch[1].trim() : "";
      
      // Split the name into first and last name (simple approach)
      const nameParts = fullName.split(" ");
      const firstName = nameParts.length > 1 ? nameParts[0] : "";
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : fullName;
      
      // Extract the party
      const partyRegex = /<h4>([\s\S]*?)<\/h4>/i;
      const partyMatch = html.match(partyRegex);
      const party = partyMatch ? partyMatch[1].trim() : "";
      
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
}

// Export a singleton instance
export const parliamentService = new ParliamentService();
