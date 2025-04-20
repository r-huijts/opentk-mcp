import nock from 'nock';
import { ODataService } from '../services/odata.js';

// Define the base URL for OData API
const ODATA_BASE_URL = 'https://gegevensmagazijn.tweedekamer.nl/OData/v4/2.0';

// Create a new instance of ODataService for testing
const odataService = new ODataService();

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

describe('OdataService', () => {
  describe('fetchEntities', () => {
    it('should fetch entities successfully', async () => {
      const mockData = {
        value: [
          { id: 1, name: 'Entity 1' },
          { id: 2, name: 'Entity 2' }
        ]
      };

      // Mock the API response
      nock(ODATA_BASE_URL)
        .get('/test-entities')
        .query(true) // Accept any query parameters
        .reply(200, mockData);

      const result = await odataService.fetchEntities('/test-entities');

      expect(result).toEqual(mockData.value);
    });

    it('should handle API errors gracefully', async () => {
      // Mock a 404 error
      nock(ODATA_BASE_URL)
        .get('/non-existent')
        .query(true)
        .reply(404, 'Not Found');

      await expect(odataService.fetchEntities('/non-existent')).rejects.toThrow('API error: 404 Not Found');
    });

    it('should handle empty responses', async () => {
      // Mock an empty response
      nock(ODATA_BASE_URL)
        .get('/empty')
        .query(true)
        .reply(200, { value: [] });

      const result = await odataService.fetchEntities('/empty');

      expect(result).toEqual([]);
    });

    it('should apply filters correctly', async () => {
      const mockData = {
        value: [
          { id: 1, name: 'Filtered Entity' }
        ]
      };

      // Mock the API response with filter
      nock(ODATA_BASE_URL)
        .get('/filtered-entities')
        .query((queryObject) => {
          return queryObject.$filter === "name eq 'Test'";
        })
        .reply(200, mockData);

      const result = await odataService.fetchEntities('/filtered-entities', { filter: "name eq 'Test'" });

      expect(result).toEqual(mockData.value);
    });

    it('should apply top parameter correctly', async () => {
      const mockData = {
        value: [
          { id: 1, name: 'Entity 1' }
        ]
      };

      // Mock the API response with top parameter
      nock(ODATA_BASE_URL)
        .get('/limited-entities')
        .query((queryObject) => {
          return queryObject.$top === '1';
        })
        .reply(200, mockData);

      const result = await odataService.fetchEntities('/limited-entities', { top: 1 });

      expect(result).toEqual(mockData.value);
    });
  });

  describe('fetchEntity', () => {
    it('should fetch a single entity successfully', async () => {
      const mockData = {
        id: 1,
        name: 'Single Entity'
      };

      // Mock the API response
      nock(ODATA_BASE_URL)
        .get('/entities/1')
        .reply(200, mockData);

      const result = await odataService.fetchEntity('/entities/1');

      expect(result).toEqual(mockData);
    });

    it('should handle API errors', async () => {
      // Mock a 404 error
      nock(ODATA_BASE_URL)
        .get('/entities/999')
        .reply(404, 'Not Found');

      await expect(odataService.fetchEntity('/entities/999')).rejects.toThrow('API error: 404 Not Found');
    });

    it('should handle null responses', async () => {
      // Mock an empty response
      nock(ODATA_BASE_URL)
        .get('/entities/null')
        .reply(200, {});

      const result = await odataService.fetchEntity('/entities/null');

      expect(result).toBeNull();
    });
  });
});
