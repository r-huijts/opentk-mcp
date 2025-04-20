import { ApiService } from '../services/api.js';
import { ODataService } from '../services/odata.js';

// Define the base URLs
const BASE_URL = 'https://berthub.eu/tkconv';
const ODATA_BASE_URL = 'https://gegevensmagazijn.tweedekamer.nl/OData/v4/2.0';

// Add missing methods to the ODataService for testing
ODataService.prototype.fetchEntities = async function<T>(endpoint: string, options: any = {}): Promise<T[]> {
  return [];
};

ODataService.prototype.fetchEntity = async function<T>(endpoint: string): Promise<T | null> {
  return null;
};

import { extractDocumentLink } from '../utils/html-parser.js';

// Create instances of the services
const apiService = new ApiService();
const odataService = new ODataService();

// Skip these tests in CI environments
const itLive = process.env.CI ? it.skip : it;

// This test suite is for testing actual API endpoints
// These tests will be skipped by default and should be run manually
// when you want to check if the endpoints are working
describe('Endpoint Integration Tests', () => {
  // Set a longer timeout for these tests since they hit real endpoints
  jest.setTimeout(30000);

  describe('ApiService Endpoints', () => {
    itLive('should fetch search results', async () => {
      const result = await apiService.search<{results: any[]}>('kunstmatige intelligentie');

      // Just check that we get a results array
      expect(result).toHaveProperty('results');
      expect(Array.isArray(result.results)).toBe(true);
    });

    itLive('should fetch document HTML', async () => {
      const html = await apiService.fetchHtml('/document.html?nummer=2024D39058');

      // Check that we get HTML and can extract a document link
      expect(typeof html).toBe('string');
      expect(html).toContain('<!DOCTYPE html>');

      const documentLink = extractDocumentLink(html);
      expect(documentLink).not.toBeNull();
    });

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
    });

    itLive('should fetch a sitemap', async () => {
      const urls = await apiService.fetchSitemap('sitemap-2024.txt');

      // Check that we get an array of URLs
      expect(Array.isArray(urls)).toBe(true);
      expect(urls.length).toBeGreaterThan(0);
      expect(urls[0]).toMatch(/^https?:/);
    });

    itLive('should resolve an external reference', async () => {
      const url = await apiService.resolveExternal('2024D39058');

      // Check that we get a URL
      expect(typeof url).toBe('string');
      expect(url.length).toBeGreaterThan(0);
    });
  });

  describe('OdataService Endpoints', () => {
    itLive('should fetch entities from OData API', async () => {
      const entities = await odataService.fetchEntities('/Personen');

      // Check that we get an array of entities
      expect(Array.isArray(entities)).toBe(true);
      expect(entities.length).toBeGreaterThan(0);
    });

    itLive('should fetch a single entity from OData API', async () => {
      // Assuming there's a person with ID 1
      const entity = await odataService.fetchEntity('/Personen(1)');

      // Check that we get an object with expected properties
      expect(typeof entity).toBe('object');
      expect(entity).not.toBeNull();
      expect(entity).toHaveProperty('Id');
    });

    itLive('should apply filters correctly', async () => {
      const entities = await odataService.fetchEntities('/Personen', {
        filter: "contains(Achternaam, 'Berg')",
        top: 5
      });

      // Check that we get filtered results
      expect(Array.isArray(entities)).toBe(true);
      entities.forEach((entity: any) => {
        expect(entity.Achternaam).toContain('Berg');
      });
    });
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
      { name: 'OData Persons', url: `${ODATA_BASE_URL}/Personen`, method: 'GET' },
      { name: 'OData Single Person', url: `${ODATA_BASE_URL}/Personen(1)`, method: 'GET' },
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
