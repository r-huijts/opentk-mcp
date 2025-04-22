import { extractDocumentLink, extractDocumentDetailsFromHtml } from '../utils/html-parser.js';

describe('HTML Parser Utilities', () => {
  describe('extractDocumentLink', () => {
    it('should extract direct document link', () => {
      const html = `
        <html>
          <body>
            <p>
              <a href="getraw/2024D39058">Directe link naar document</a>
            </p>
          </body>
        </html>
      `;

      const result = extractDocumentLink(html);

      expect(result).toEqual('getraw/2024D39058');
    });

    it('should return null for iframe source when direct link is not available', () => {
      const html = `
        <html>
          <body>
            <iframe width='95%' height='1024' src='./getraw/2024D39058'></iframe>
          </body>
        </html>
      `;

      const result = extractDocumentLink(html);

      // Our updated implementation only extracts direct links
      expect(result).toBeNull();
    });

    it('should return null for iframe source with full path', () => {
      const html = `
        <html>
          <body>
            <iframe width='95%' height='1024' src='/getraw/2024D39058'></iframe>
          </body>
        </html>
      `;

      const result = extractDocumentLink(html);

      // Our updated implementation only extracts direct links
      expect(result).toBeNull();
    });

    it('should return null when no document link is found', () => {
      const html = `
        <html>
          <body>
            <p>No document link here</p>
          </body>
        </html>
      `;

      const result = extractDocumentLink(html);

      expect(result).toBeNull();
    });
  });

  describe('extractDocumentDetailsFromHtml', () => {
    it('should correctly format the PDF link with /tkconv/ path', () => {
      const html = `
        <html>
          <body>
            <hblock><h2>Test Document</h2></hblock>
            <p><em>Type: Test</em></p>
            <p>Nummer: <b>2024D12345</b>, datum: <b>2024-01-01</b>, bijgewerkt: <b>2024-01-02</b>, versie: 1</p>
            <p><a href="getraw/2024D12345">Directe link naar document</a></p>
          </body>
        </html>
      `;

      const baseUrl = 'https://berthub.eu';
      const result = extractDocumentDetailsFromHtml(html, baseUrl);

      expect(result).not.toBeNull();
      expect(result?.directLinkPdf).toEqual('https://berthub.eu/tkconv/getraw/2024D12345');
    });

    it('should correctly format the PDF link when baseUrl already includes /tkconv/', () => {
      const html = `
        <html>
          <body>
            <hblock><h2>Test Document</h2></hblock>
            <p><em>Type: Test</em></p>
            <p>Nummer: <b>2024D12345</b>, datum: <b>2024-01-01</b>, bijgewerkt: <b>2024-01-02</b>, versie: 1</p>
            <p><a href="getraw/2024D12345">Directe link naar document</a></p>
          </body>
        </html>
      `;

      const baseUrl = 'https://berthub.eu/tkconv';
      const result = extractDocumentDetailsFromHtml(html, baseUrl);

      expect(result).not.toBeNull();
      expect(result?.directLinkPdf).toEqual('https://berthub.eu/tkconv/getraw/2024D12345');
    });
  });
});
