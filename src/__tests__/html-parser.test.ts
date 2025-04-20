import { extractDocumentLink } from '../utils/html-parser.js';

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
    
    it('should extract iframe source when direct link is not available', () => {
      const html = `
        <html>
          <body>
            <iframe width='95%' height='1024' src='./getraw/2024D39058'></iframe>
          </body>
        </html>
      `;
      
      const result = extractDocumentLink(html);
      
      expect(result).toEqual('getraw/2024D39058');
    });
    
    it('should handle iframe source with full path', () => {
      const html = `
        <html>
          <body>
            <iframe width='95%' height='1024' src='/getraw/2024D39058'></iframe>
          </body>
        </html>
      `;
      
      const result = extractDocumentLink(html);
      
      expect(result).toEqual('getraw/2024D39058');
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
});
