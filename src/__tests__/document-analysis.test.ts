/**
 * Tests for document analysis functionality
 */

import { analyzeDocumentContent } from '../utils/document-extractor';

describe('Document Analysis', () => {
  describe('analyzeDocumentContent', () => {
    it('should extract keywords from Dutch parliamentary text', async () => {
      const sampleText = `
        De minister van Klimaat en Energie heeft vandaag een nieuwe wet voorgesteld 
        over de energietransitie. De VVD-fractie steunt het voorstel, terwijl de 
        PVV kritisch is. Het gaat om belasting op CO2-uitstoot en investeringen in 
        duurzame energie zoals windmolens en zonnepanelen. Minister Jetten benadrukt 
        het belang van klimaatdoelstellingen en de noodzaak om de uitstoot te verminderen.
        De Tweede Kamer zal volgende week stemmen over dit belangrijke klimaatbeleid.
      `.repeat(5); // Repeat to get more meaningful TF-IDF scores

      const analysis = await analyzeDocumentContent(sampleText);

      expect(analysis).toHaveProperty('keywords');
      expect(analysis.keywords).toBeInstanceOf(Array);
      expect(analysis.keywords.length).toBeGreaterThan(0);
      expect(analysis.keywords.length).toBeLessThanOrEqual(15);
      
      // Each keyword should have term and score
      analysis.keywords.forEach(keyword => {
        expect(keyword).toHaveProperty('term');
        expect(keyword).toHaveProperty('score');
        expect(typeof keyword.term).toBe('string');
        expect(typeof keyword.score).toBe('number');
      });
    });

    it('should extract political parties from text', async () => {
      const sampleText = `
        De VVD-fractie en de PVV hebben vandaag een debat gevoerd met D66 en GroenLinks.
        Ook de CDA en de PvdA waren aanwezig. De BBB en NSC stemden tegen het voorstel.
      `;

      const analysis = await analyzeDocumentContent(sampleText);

      expect(analysis.entities.parties).toBeInstanceOf(Array);
      expect(analysis.entities.parties).toContain('VVD');
      expect(analysis.entities.parties).toContain('PVV');
      expect(analysis.entities.parties).toContain('D66');
      expect(analysis.entities.parties).toContain('GroenLinks');
      expect(analysis.entities.parties).toContain('CDA');
      expect(analysis.entities.parties).toContain('PvdA');
    });

    it('should extract person names from text', async () => {
      const sampleText = `
        Minister Jetten sprak vandaag over het klimaatbeleid. De heer Wilders reageerde 
        kritisch op het voorstel. Mevrouw Yeşilgöz verdedigde het standpunt van de VVD.
        Premier Schoof leidde het debat. Staatssecretaris Van der Burg was ook aanwezig.
      `.repeat(2); // Repeat so names appear multiple times

      const analysis = await analyzeDocumentContent(sampleText);

      expect(analysis.entities.persons).toBeInstanceOf(Array);
      expect(analysis.entities.persons.length).toBeGreaterThan(0);
      
      // Check if at least some common names are detected
      const allPersons = analysis.entities.persons.join(' ');
      expect(allPersons).toMatch(/Jetten|Wilders|Yeşilgöz|Schoof|Van der Burg/i);
    });

    it('should calculate document statistics correctly', async () => {
      const sampleText = 'Dit is een test document. '.repeat(100);

      const analysis = await analyzeDocumentContent(sampleText);

      expect(analysis.statistics).toHaveProperty('characterCount');
      expect(analysis.statistics).toHaveProperty('wordCount');
      expect(analysis.statistics).toHaveProperty('estimatedReadingTime');
      expect(analysis.statistics).toHaveProperty('documentStructure');
      
      expect(analysis.statistics.characterCount).toBeGreaterThan(0);
      expect(analysis.statistics.wordCount).toBeGreaterThan(0);
      expect(typeof analysis.statistics.estimatedReadingTime).toBe('string');
      expect(typeof analysis.statistics.documentStructure).toBe('string');
    });

    it('should identify debate transcript structure', async () => {
      const debateText = `
        De voorzitter: We beginnen met het debat over klimaat.
        
        Minister Jetten: Dank u, voorzitter. Ik wil graag toelichten...
        
        De heer Wilders: Voorzitter, ik heb een vraag aan de minister.
      `;

      const analysis = await analyzeDocumentContent(debateText);

      expect(analysis.statistics.documentStructure).toBe('Parliamentary debate transcript');
    });

    it('should identify formal letter structure', async () => {
      const letterText = `
        Geachte leden van de Tweede Kamer,
        
        Hierbij deel ik u mee dat...
        
        Hoogachtend,
        De Minister van Financiën
      `;

      const analysis = await analyzeDocumentContent(letterText);

      expect(analysis.statistics.documentStructure).toBe('Formal letter or correspondence');
    });

    it('should extract topics from keywords', async () => {
      const climateText = `
        Het klimaat verandert snel. We moeten investeren in duurzame energie.
        De CO2-uitstoot moet omlaag. Windmolens en zonnepanelen zijn belangrijk.
        De energietransitie kost geld maar is noodzakelijk voor het milieu.
      `.repeat(10);

      const analysis = await analyzeDocumentContent(climateText);

      expect(analysis.topics).toBeInstanceOf(Array);
      expect(analysis.topics.length).toBeGreaterThan(0);
      
      // Should detect climate-related topics
      const allTopics = analysis.topics.join(' ');
      expect(allTopics).toMatch(/Climate|Environment|Energy/i);
    });

    it('should provide a preview of the document', async () => {
      const longText = 'A'.repeat(1000);

      const analysis = await analyzeDocumentContent(longText);

      expect(analysis.preview).toBeDefined();
      expect(typeof analysis.preview).toBe('string');
      expect(analysis.preview.length).toBeLessThanOrEqual(500);
    });

    it('should calculate relevance score when search terms provided', async () => {
      const text = `
        Het klimaatbeleid is belangrijk. We moeten de energietransitie versnellen.
        Duurzame energie is de toekomst. CO2-uitstoot moet omlaag.
      `.repeat(5);

      const analysis = await analyzeDocumentContent(text, ['klimaat', 'energie', 'duurzaam']);

      expect(analysis.relevanceScore).toBeDefined();
      expect(typeof analysis.relevanceScore).toBe('number');
      expect(analysis.relevanceScore).toBeGreaterThanOrEqual(0);
      expect(analysis.relevanceScore).toBeLessThanOrEqual(100);
      
      // Should have high relevance since search terms are present
      expect(analysis.relevanceScore).toBeGreaterThan(50);
    });

    it('should have low relevance score for unrelated search terms', async () => {
      const text = `
        Het onderwijsstelsel moet worden hervormd. Scholen hebben meer budget nodig.
        Leraren verdienen betere arbeidsvoorwaarden. Studenten hebben last van studieschulden.
      `.repeat(5);

      const analysis = await analyzeDocumentContent(text, ['klimaat', 'energie', 'CO2']);

      expect(analysis.relevanceScore).toBeDefined();
      expect(typeof analysis.relevanceScore).toBe('number');
      
      // Should have low relevance since search terms are not present
      expect(analysis.relevanceScore).toBeLessThan(20);
    });

    it('should not calculate relevance score when no search terms provided', async () => {
      const text = 'This is a test document about various topics.';

      const analysis = await analyzeDocumentContent(text);

      expect(analysis.relevanceScore).toBeUndefined();
    });

    it('should handle empty text gracefully', async () => {
      const analysis = await analyzeDocumentContent('');

      expect(analysis).toHaveProperty('keywords');
      expect(analysis).toHaveProperty('entities');
      expect(analysis).toHaveProperty('statistics');
      expect(analysis).toHaveProperty('topics');
      expect(analysis).toHaveProperty('preview');
    });

    it('should handle text with special characters', async () => {
      const text = `
        De minister sprak over €1.5 miljard voor de energietransitie.
        De CO₂-uitstoot moet met 50% omlaag. Dit is een must-have voor ons land.
      `.repeat(3);

      const analysis = await analyzeDocumentContent(text);

      expect(analysis.keywords.length).toBeGreaterThan(0);
      expect(analysis.statistics.wordCount).toBeGreaterThan(0);
    });

    it('should limit the number of keywords to 15', async () => {
      const longText = `
        Dit document bevat vele verschillende onderwerpen zoals economie, klimaat,
        onderwijs, gezondheidszorg, defensie, landbouw, immigratie, huisvesting,
        infrastructuur, belastingen, pensioenen, werkgelegenheid, sociale zekerheid,
        cultuur, sport, innovatie, digitalisering, cybersecurity, privacy en meer.
      `.repeat(20);

      const analysis = await analyzeDocumentContent(longText);

      expect(analysis.keywords.length).toBeLessThanOrEqual(15);
    });

    it('should handle Dutch diacritics correctly', async () => {
      const text = `
        Mevrouw Yeşilgöz sprak over de situatie. De heer Öztürk reageerde.
        Minister Kaag was ook aanwezig bij het debat over de crèche-regeling.
      `.repeat(3);

      const analysis = await analyzeDocumentContent(text);

      // Should detect names with diacritics
      expect(analysis.entities.persons.length).toBeGreaterThan(0);
    });

    it('should detect healthcare-related topics', async () => {
      const healthcareText = `
        De gezondheidszorg heeft meer budget nodig. Ziekenhuizen kampen met tekorten.
        Patiënten moeten lang wachten. De zorgkosten stijgen. Verpleegkundigen zijn 
        overbelast. Medische zorg moet toegankelijker worden.
      `.repeat(10);

      const analysis = await analyzeDocumentContent(healthcareText);

      const allTopics = analysis.topics.join(' ');
      expect(allTopics).toMatch(/Healthcare/i);
    });

    it('should detect economy-related topics', async () => {
      const economyText = `
        De economie groeit langzaam. De belastingen zijn te hoog. De begroting moet 
        worden aangepast. Financiële zekerheid is belangrijk. Het economisch beleid 
        moet worden herzien. Investeringen in de economie zijn noodzakelijk.
      `.repeat(10);

      const analysis = await analyzeDocumentContent(economyText);

      const allTopics = analysis.topics.join(' ');
      expect(allTopics).toMatch(/Economy|Finance/i);
    });
  });
});

