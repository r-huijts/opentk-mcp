import { ParliamentService } from '../services/parliament-service.js';
import { ApiService } from '../services/api.js';

// Create a mock for the API service
const mockFetchHtml = jest.fn();

// Mock the apiService module
jest.mock('../services/api.js', () => ({
  apiService: {
    fetchHtml: mockFetchHtml
  }
}));

// Create a new instance of ParliamentService for testing
const parliamentService = new ParliamentService();

describe('ParliamentService', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.resetAllMocks();
  });

  describe('getPersons', () => {
    it('should extract MPs from HTML', async () => {
      // Mock the HTML response
      const mockHtml = `
        <html>
          <body>
            <table>
              <thead>
                <tr>
                  <th>Naam</th>
                  <th>Fractie</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><a href="persoon.html?nummer=123">John Doe</a></td>
                  <td>Party A</td>
                </tr>
                <tr>
                  <td><a href="persoon.html?nummer=456">Jane Smith</a></td>
                  <td>Party B</td>
                </tr>
              </tbody>
            </table>
          </body>
        </html>
      `;

      // Set up the mock to return our HTML
      mockFetchHtml.mockResolvedValue(mockHtml);

      // Call the method
      const result = await parliamentService.getPersons();

      // Check that the API was called correctly
      expect(mockFetchHtml).toHaveBeenCalledWith('/kamerleden.html');

      // Check the result
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        Id: 123,
        Persoonsnummer: 123,
        Voornaam: 'John',
        Achternaam: 'Doe',
        Fullname: 'John Doe',
        Fractie: 'Party A'
      });
      expect(result[1]).toMatchObject({
        Id: 456,
        Persoonsnummer: 456,
        Voornaam: 'Jane',
        Achternaam: 'Smith',
        Fullname: 'Jane Smith',
        Fractie: 'Party B'
      });
    });

    it('should handle empty or invalid HTML', async () => {
      // Mock an empty HTML response
      mockFetchHtml.mockResolvedValue('<html><body></body></html>');

      // Call the method
      const result = await parliamentService.getPersons();

      // Check that we get an empty array
      expect(result).toEqual([]);
    });

    it('should handle API errors', async () => {
      // Mock an API error
      mockFetchHtml.mockRejectedValue(new Error('API error'));

      // Call the method
      const result = await parliamentService.getPersons();

      // Check that we get an empty array
      expect(result).toEqual([]);
    });
  });

  describe('getPerson', () => {
    it('should extract MP details from HTML', async () => {
      // Mock the HTML response
      const mockHtml = `
        <html>
          <head>
            <title>John Doe</title>
          </head>
          <body>
            <h1>John Doe</h1>
            <h4>Party A</h4>
            <p>Some biographical information</p>
          </body>
        </html>
      `;

      // Set up the mock to return our HTML
      mockFetchHtml.mockResolvedValue(mockHtml);

      // Call the method
      const result = await parliamentService.getPerson(123);

      // Check that the API was called correctly
      expect(mockFetchHtml).toHaveBeenCalledWith('/persoon.html?nummer=123');

      // Check the result
      expect(result).toMatchObject({
        Id: 123,
        Persoonsnummer: 123,
        Voornaam: 'John',
        Achternaam: 'Doe',
        Fullname: 'John Doe',
        Fractie: 'Party A'
      });
    });

    it('should handle empty or invalid HTML', async () => {
      // Mock an empty HTML response
      mockFetchHtml.mockResolvedValue('<html><body></body></html>');

      // Call the method
      const result = await parliamentService.getPerson(123);

      // Check that we get a basic object with the ID
      expect(result).toMatchObject({
        Id: 123,
        Persoonsnummer: 123
      });
    });

    it('should handle API errors', async () => {
      // Mock an API error
      mockFetchHtml.mockRejectedValue(new Error('API error'));

      // Call the method
      const result = await parliamentService.getPerson(123);

      // Check that we get null
      expect(result).toBeNull();
    });
  });
});
