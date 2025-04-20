import nock from 'nock';
import { ApiService } from '../services/api.js';

// Define the base URL for API
const BASE_URL = 'https://berthub.eu/tkconv';

// Create a new instance of ApiService for testing
const apiService = new ApiService();

// Setup and teardown
beforeAll(() => {
  // Disable real HTTP requests during tests
  nock.disableNetConnect();
});

afterAll(() => {
  // Enable real HTTP requests after tests
  nock.enableNetConnect();
  // Clean up any pending mocks
  nock.cleanAll();
});

afterEach(() => {
  // Clean up mocks after each test
  nock.cleanAll();
});

describe('ApiService', () => {
  describe('fetchJson', () => {
    it('should fetch and parse JSON data successfully', async () => {
      const mockData = { key: 'value' };

      // Mock the API response
      nock(BASE_URL)
        .get('/test-endpoint')
        .reply(200, mockData);

      const result = await apiService.fetchJson('/test-endpoint');

      expect(result).toEqual(mockData);
    });

    it('should handle API errors gracefully', async () => {
      // Mock a 404 error
      nock(BASE_URL)
        .get('/non-existent')
        .reply(404, 'Not Found');

      await expect(apiService.fetchJson('/non-existent')).rejects.toThrow('API error: 404 Not Found');
    });

    it('should handle HTML responses', async () => {
      // Mock an HTML response
      nock(BASE_URL)
        .get('/html-response')
        .reply(200, '<!DOCTYPE html><html><body>HTML content</body></html>');

      const result = await apiService.fetchJson('/html-response');

      // Should return an empty object when HTML is detected
      expect(result).toEqual({});
    });

    it('should handle 500 errors by returning an empty object', async () => {
      // Mock a 500 error
      nock(BASE_URL)
        .get('/server-error')
        .reply(500, 'Internal Server Error');

      const result = await apiService.fetchJson('/server-error');

      // Should return an empty object for 500 errors
      expect(result).toEqual({});
    });
  });

  describe('fetchHtml', () => {
    it('should fetch HTML content successfully', async () => {
      const mockHtml = '<!DOCTYPE html><html><body>Test HTML</body></html>';

      // Mock the API response
      nock(BASE_URL)
        .get('/html-page')
        .reply(200, mockHtml);

      const result = await apiService.fetchHtml('/html-page');

      expect(result).toEqual(mockHtml);
    });

    it('should handle API errors', async () => {
      // Mock a 404 error
      nock(BASE_URL)
        .get('/non-existent-html')
        .reply(404, 'Not Found');

      await expect(apiService.fetchHtml('/non-existent-html')).rejects.toThrow('API error: 404 Not Found');
    });
  });

  describe('fetchBinary', () => {
    it('should fetch binary data successfully', async () => {
      const mockBinary = Buffer.from('Test binary data');

      // Mock the API response
      nock(BASE_URL)
        .get('/binary-data')
        .reply(200, mockBinary, { 'Content-Type': 'application/octet-stream' });

      const result = await apiService.fetchBinary('/binary-data');

      expect(Buffer.from(result.data)).toEqual(mockBinary);
      expect(result.contentType).toEqual('application/octet-stream');
    });

    it('should handle PDF content correctly', async () => {
      const mockPdf = Buffer.from('%PDF-1.5\nTest PDF content');

      // Mock the API response with incorrect content type
      nock(BASE_URL)
        .get('/pdf-data')
        .reply(200, mockPdf, { 'Content-Type': 'text/html' });

      const result = await apiService.fetchBinary('/pdf-data');

      expect(Buffer.from(result.data)).toEqual(mockPdf);
      expect(result.contentType).toEqual('application/pdf');
    });

    it('should handle API errors', async () => {
      // Mock a 404 error
      nock(BASE_URL)
        .get('/non-existent-binary')
        .reply(404, 'Not Found');

      await expect(apiService.fetchBinary('/non-existent-binary')).rejects.toThrow('API error: 404 Not Found');
    });
  });

  describe('search', () => {
    it('should perform a search successfully', async () => {
      const mockResults = {
        results: [
          { id: 1, title: 'Result 1' },
          { id: 2, title: 'Result 2' }
        ]
      };

      // Mock the search API response
      nock(BASE_URL)
        .post('/search')
        .reply(200, mockResults);

      const result = await apiService.search('test query');

      expect(result).toEqual(mockResults);
    });

    it('should handle search API errors', async () => {
      // Mock a 404 error
      nock(BASE_URL)
        .post('/search')
        .reply(404, 'Not Found');

      await expect(apiService.search('test query')).rejects.toThrow('API error: 404 Not Found');
    });

    it('should handle 500 errors by returning empty results', async () => {
      // Mock a 500 error
      nock(BASE_URL)
        .post('/search')
        .reply(500, 'Internal Server Error');

      const result = await apiService.search('test query');

      // Should return an object with empty results array for 500 errors
      expect(result).toEqual({
        results: [],
        error: "The search query 'test query' caused an error in the search API. Try simplifying your query."
      });
    });

    it('should handle HTML responses', async () => {
      // Mock an HTML response
      nock(BASE_URL)
        .post('/search')
        .reply(200, '<!DOCTYPE html><html><body>HTML content</body></html>');

      const result = await apiService.search('test query');

      // Should return an object with empty results array when HTML is detected
      expect(result).toEqual({
        results: [],
        error: "The search query 'test query' caused an error in the search API. Try simplifying your query."
      });
    });

    it('should retry with simplified query on 500 error', async () => {
      const mockResults = {
        results: [
          { id: 1, title: 'Result 1' }
        ]
      };

      // Mock a 500 error for the original query
      nock(BASE_URL)
        .post('/search')
        .reply(500, 'Internal Server Error');

      // Mock a successful response for the simplified query
      nock(BASE_URL)
        .post('/search')
        .reply(200, mockResults);

      const result = await apiService.search('complex query with multiple terms');

      // Should return the results from the simplified query
      expect(result).toEqual(mockResults);
    });
  });

  describe('resolveExternal', () => {
    it('should resolve external reference successfully', async () => {
      // Mock a redirect response
      nock(BASE_URL)
        .get('/op/test-ref')
        .reply(302, '', { Location: 'https://example.com/document' });

      const result = await apiService.resolveExternal('test-ref');

      expect(result).toEqual('https://example.com/document');
    });

    it('should handle missing location header', async () => {
      // Mock a response with no location header
      nock(BASE_URL)
        .get('/op/test-ref')
        .reply(200, 'window.location = "https://example.com/redirect"');

      const result = await apiService.resolveExternal('test-ref');

      // Should extract URL from window.location in the body
      expect(result).toEqual('https://example.com/redirect');
    });

    it('should return empty string when no location is found', async () => {
      // Mock a response with no location information
      nock(BASE_URL)
        .get('/op/test-ref')
        .reply(200, 'No redirect information');

      const result = await apiService.resolveExternal('test-ref');

      expect(result).toEqual('');
    });
  });

  describe('fetchSitemap', () => {
    it('should fetch sitemap successfully', async () => {
      const mockSitemap = 'https://example.com/page1\nhttps://example.com/page2\nhttps://example.com/page3';

      // Mock the API response
      nock(BASE_URL)
        .get('/sitemap-2025.txt')
        .reply(200, mockSitemap);

      const result = await apiService.fetchSitemap('sitemap-2025.txt');

      expect(result).toEqual([
        'https://example.com/page1',
        'https://example.com/page2',
        'https://example.com/page3'
      ]);
    });

    it('should handle 404 errors by returning an empty array', async () => {
      // Mock a 404 error
      nock(BASE_URL)
        .get('/sitemap-nonexistent.txt')
        .reply(404, 'Not Found');

      const result = await apiService.fetchSitemap('sitemap-nonexistent.txt');

      // Should return an empty array for 404 errors
      expect(result).toEqual([]);
    });

    it('should handle HTML responses', async () => {
      // Mock an HTML response
      nock(BASE_URL)
        .get('/sitemap-error.txt')
        .reply(200, '<!DOCTYPE html><html><body>HTML content</body></html>');

      const result = await apiService.fetchSitemap('sitemap-error.txt');

      // Should return an empty array when HTML is detected
      expect(result).toEqual([]);
    });
  });
});
