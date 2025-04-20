import { ApiService, apiService } from '../services/api.js';
import { extractDocumentLink } from '../utils/html-parser.js';

// Skip these tests in CI environments
const itLive = process.env.CI ? it.skip : it;

// Set a longer timeout for these tests since they hit real endpoints

describe('ApiService', () => {

  describe('fetchJson', () => {
    itLive('should fetch and parse JSON data', async () => {
      // Use the search endpoint which returns JSON
      const result = await apiService.search<{results: any[]}>('kunstmatige intelligentie');

      // Check that we get a valid response
      expect(result).toHaveProperty('results');
      expect(Array.isArray(result.results)).toBe(true);
    }, 30000);
  });

  describe('fetchHtml', () => {
    itLive('should fetch HTML content', async () => {
      // Fetch the main page
      const html = await apiService.fetchHtml('/');

      // Check that we get HTML
      expect(typeof html).toBe('string');
      expect(html).toContain('<!DOCTYPE html>');
    }, 30000);
  });

  describe('fetchBinary', () => {
    itLive('should fetch binary data', async () => {
      // First get a document page to extract a PDF link
      const html = await apiService.fetchHtml('/document.html?nummer=2024D39058');

      // Extract the document link using the utility function
      const documentLink = extractDocumentLink(html);

      if (!documentLink) {
        throw new Error('Could not extract document link');
      }

      // Now fetch the binary data
      const { data, contentType } = await apiService.fetchBinary(documentLink);

      // Check that we get binary data with the correct content type
      expect(data.byteLength).toBeGreaterThan(0);
      expect(contentType).toBe('application/pdf');
    }, 30000);
  });

  describe('search', () => {
    itLive('should search for documents', async () => {
      // Search for a common term
      const result = await apiService.search<{results: any[]}>('klimaat');

      // Check that we get search results
      expect(result).toHaveProperty('results');
      expect(Array.isArray(result.results)).toBe(true);
      // The search might return no results, so we don't check the length
    }, 30000);

    itLive('should handle search with options', async () => {
      // Search with the twomonths option
      const result = await apiService.search<{results: any[]}>('klimaat', { twomonths: true });

      // Check that we get search results
      expect(result).toHaveProperty('results');
      expect(Array.isArray(result.results)).toBe(true);
    }, 30000);
  });

  describe('resolveExternal', () => {
    itLive('should resolve an external reference', async () => {
      // Resolve a known document reference
      const url = await apiService.resolveExternal('2024D39058');

      // Check that we get a URL
      expect(typeof url).toBe('string');
      expect(url.length).toBeGreaterThan(0);
    }, 30000);
  });

  describe('fetchSitemap', () => {
    itLive('should fetch a sitemap', async () => {
      // Fetch the sitemap for the current year
      const currentYear = new Date().getFullYear();
      const urls = await apiService.fetchSitemap(`sitemap-${currentYear}.txt`);

      // Check that we get an array of URLs
      expect(Array.isArray(urls)).toBe(true);
      expect(urls.length).toBeGreaterThan(0);
      expect(urls[0]).toMatch(/^https?:/);
    }, 30000);
  });

  describe('getPersons', () => {
    itLive('should fetch a list of MPs', async () => {
      // Fetch the list of MPs
      const persons = await apiService.getPersons();

      // Check that we get an array of MPs
      expect(Array.isArray(persons)).toBe(true);
      expect(persons.length).toBeGreaterThan(0);

      // Check that each MP has the expected properties
      if (persons.length > 0) {
        const firstPerson = persons[0];
        expect(firstPerson).toHaveProperty('Id');
        expect(firstPerson).toHaveProperty('Fullname');
        expect(firstPerson).toHaveProperty('Fractie');
      }
    }, 30000);
  });

  describe('getPerson', () => {
    itLive('should fetch a single MP', async () => {
      // Fetch a specific MP (using a known ID)
      const person = await apiService.getPerson(49108);

      // Check that we get an MP with the expected properties
      expect(person).not.toBeNull();
      if (person) {
        expect(person).toHaveProperty('Id');
        expect(person).toHaveProperty('Fullname');
        expect(person).toHaveProperty('Fractie');
      }
    }, 30000);

    itLive('should handle non-existent MPs', async () => {
      // Try to fetch a non-existent MP
      const person = await apiService.getPerson(999999999);

      // This might return null or an empty object, depending on the implementation
      // We just check that it doesn't throw an error
      expect(person).toBeDefined();
    }, 30000);
  });
});
