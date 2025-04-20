import { ApiService } from '../services/api.js';
import { extractDocumentLink } from '../utils/html-parser.js';

// Define the base URL
const BASE_URL = 'https://berthub.eu/tkconv';

// Create an instance of the API service
const apiService = new ApiService();

// Skip these tests in CI environments
const itLive = process.env.CI ? it.skip : it;

// Set a longer timeout for these tests since they hit real endpoints

// This test suite is for testing actual API endpoints
// These tests will be skipped by default and should be run manually
// when you want to check if the endpoints are working
describe('Endpoint Integration Tests', () => {

  describe('ApiService Endpoints', () => {
    itLive('should fetch search results', async () => {
      const result = await apiService.search<{results: any[], error?: string}>('kunstmatige intelligentie');

      // Check that we get a results array without an error
      expect(result).toHaveProperty('results');
      expect(Array.isArray(result.results)).toBe(true);
      expect(result.error).toBeUndefined();
    }, 30000);

    itLive('should handle complex search queries with multiple terms', async () => {
      const result = await apiService.search<{results: any[], error?: string}>('kunstmatige intelligentie AI');

      // Check that we get search results without an error
      expect(result).toHaveProperty('results');
      expect(Array.isArray(result.results)).toBe(true);
      expect(result.error).toBeUndefined();
    }, 30000);

    itLive('should handle exact phrase search with quotes', async () => {
      const result = await apiService.search<{results: any[], error?: string}>("\"kunstmatige intelligentie\"");

      // Check that we get search results without an error
      expect(result).toHaveProperty('results');
      expect(Array.isArray(result.results)).toBe(true);
      expect(result.error).toBeUndefined();
    }, 30000);

    itLive('should fetch document HTML', async () => {
      const html = await apiService.fetchHtml('/document.html?nummer=2024D39058');

      // Check that we get HTML and can extract a document link
      expect(typeof html).toBe('string');
      expect(html).toContain('<!DOCTYPE html>');

      const documentLink = extractDocumentLink(html);
      expect(documentLink).not.toBeNull();
    }, 30000);

    itLive('should download a document', async () => {
      // First get the document page to extract the link
      const html = await apiService.fetchHtml('/document.html?nummer=2024D39058');
      const documentLink = extractDocumentLink(html);

      if (!documentLink) {
        throw new Error('Could not extract document link');
      }

      // Now download the actual document
      const { data, contentType } = await apiService.fetchBinary(`/${documentLink}`);

      // Check that we get binary data with the correct content type
      expect(data.byteLength).toBeGreaterThan(0);
      expect(contentType).toBe('application/pdf');
    }, 30000);

    itLive('should fetch a sitemap', async () => {
      const urls = await apiService.fetchSitemap('sitemap-2024.txt');

      // Check that we get an array of URLs
      expect(Array.isArray(urls)).toBe(true);
      expect(urls.length).toBeGreaterThan(0);
      expect(urls[0]).toMatch(/^https?:/);
    }, 30000);

    itLive('should resolve an external reference', async () => {
      const url = await apiService.resolveExternal('2024D39058');

      // Check that we get a URL
      expect(typeof url).toBe('string');
      expect(url.length).toBeGreaterThan(0);
    }, 30000);
  });

  describe('Parliament Endpoints', () => {
    itLive('should fetch MPs from tkconv API', async () => {
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

    itLive('should fetch a single MP from tkconv API', async () => {
      // Try to fetch MP with ID 49108 (a valid ID)
      const person = await apiService.getPerson(49108);

      // Check that we get an object with expected properties
      if (person) {
        expect(typeof person).toBe('object');
        expect(person).toHaveProperty('Id');
        expect(person).toHaveProperty('Fullname');
      }
    }, 30000);
  });
});

// Create a test report that can be used to check which endpoints are working
describe('Endpoint Status Report', () => {
  // This test just generates a report and always passes
  it('generates a report of endpoint statuses', () => {
    const endpoints = [
      { name: 'Search API', url: `${BASE_URL}/search`, method: 'POST' },
      { name: 'Document HTML', url: `${BASE_URL}/document.html?nummer=2024D39058`, method: 'GET' },
      { name: 'Document Download', url: `${BASE_URL}/getraw/2024D39058`, method: 'GET' },
      { name: 'Sitemap', url: `${BASE_URL}/sitemap-2024.txt`, method: 'GET' },
      { name: 'External Reference', url: `${BASE_URL}/op/2024D39058`, method: 'GET' },
      { name: 'Parliament Members', url: `${BASE_URL}/kamerleden.html`, method: 'GET' },
      { name: 'Single Parliament Member', url: `${BASE_URL}/persoon.html?nummer=49108`, method: 'GET' },
    ];

    console.log('\nEndpoint Status Report:');
    console.log('=====================');
    console.log('To check if these endpoints are working, run the integration tests with:');
    console.log('npm test -- -t "Endpoint Integration Tests" --testTimeout=30000');
    console.log('\nEndpoints to test:');
    endpoints.forEach(endpoint => {
      console.log(`- ${endpoint.name}: ${endpoint.method} ${endpoint.url}`);
    });

    // This test always passes
    expect(true).toBe(true);
  });
});
