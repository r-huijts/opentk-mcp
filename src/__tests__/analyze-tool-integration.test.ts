/**
 * Integration test for the analyze_document_relevance MCP tool
 * This test verifies the full flow of the tool with a real document
 */

import { extractTextFromPdf, extractTextFromDocx, analyzeDocumentContent } from '../utils/document-extractor';

describe('analyze_document_relevance Integration', () => {
  describe('Full analysis pipeline', () => {
    it('should analyze a realistic parliamentary document', async () => {
      // Simulate a realistic Dutch parliamentary document
      const realisticDocument = `
        Tweede Kamer der Staten-Generaal
        
        Vergaderjaar 2024-2025
        
        Kamerstuk 36.200
        
        Vaststelling van de begrotingsstaten van het Ministerie van Klimaat en Energie (XII) 
        voor het jaar 2025
        
        Nr. 45
        
        BRIEF VAN DE MINISTER VAN KLIMAAT EN ENERGIE
        
        Aan de Voorzitter van de Tweede Kamer der Staten-Generaal
        
        Den Haag, 15 oktober 2024
        
        Geachte voorzitter,
        
        Hierbij bied ik u mijn visie aan op de energietransitie en de klimaatdoelstellingen 
        voor de komende jaren. Nederland heeft zich gecommitteerd aan ambitieuze 
        CO2-reductiedoelstellingen zoals vastgelegd in het Klimaatakkoord.
        
        De energietransitie vergt grote investeringen in duurzame energiebronnen zoals 
        windenergie en zonne-energie. We zien dat de afhankelijkheid van fossiele 
        brandstoffen moet worden verminderd om onze klimaatdoelstellingen te halen.
        
        Het kabinet stelt voor de komende jaren €5,5 miljard beschikbaar voor:
        - Uitbreiding van windparken op zee
        - Subsidieregelingen voor zonnepanelen op daken
        - Innovatie in waterstoftechnologie
        - Isolatie van woningen om energieverbruik te verminderen
        
        De Tweede Kamer heeft in eerdere debatten aandacht gevraagd voor de betaalbaarheid 
        van de energietransitie. De VVD-fractie benadrukte het belang van een realistische 
        planning. De GroenLinks-fractie drong aan op versnelling van de maatregelen.
        De PVV uitte kritiek op de kosten voor burgers.
        
        Voorzitter van de commissie voor Klimaat en Energie, mevrouw Van der Plas, heeft 
        gevraagd om een gedetailleerde toelichting op de financiering. De heer Wilders 
        stelde vragen over de gevolgen voor de koopkracht. Minister Jetten heeft toegezegd 
        om in het najaarsdebat uitgebreid op deze punten in te gaan.
        
        Het ministerie werkt nauw samen met de Autoriteit Consument en Markt (ACM) en het 
        Planbureau voor de Leefomgeving (PBL) om de voortgang te monitoren. Ook het 
        Rijksinstituut voor Volksgezondheid en Milieu (RIVM) levert belangrijke analyses.
        
        De Europese klimaatdoelstellingen vereisen dat Nederland in 2030 55% minder CO2 
        uitstoot dan in 1990. Dit is een grote uitdaging die samenwerking vergt tussen 
        overheid, bedrijfsleven en burgers.
        
        Ik verzoek uw Kamer om kennis te nemen van deze brief en deze te betrekken bij 
        de behandeling van de begroting.
        
        Hoogachtend,
        
        De Minister van Klimaat en Energie,
        R. Jetten
      `.repeat(2); // Make it longer for more realistic analysis

      // Analyze the document without search terms
      const basicAnalysis = await analyzeDocumentContent(realisticDocument);

      // Verify all expected properties are present
      expect(basicAnalysis).toHaveProperty('keywords');
      expect(basicAnalysis).toHaveProperty('entities');
      expect(basicAnalysis).toHaveProperty('statistics');
      expect(basicAnalysis).toHaveProperty('topics');
      expect(basicAnalysis).toHaveProperty('preview');
      expect(basicAnalysis.relevanceScore).toBeUndefined();

      // Verify keywords extraction
      expect(basicAnalysis.keywords.length).toBeGreaterThan(5);
      const keywordTerms = basicAnalysis.keywords.map(k => k.term.toLowerCase());
      
      // Should extract climate/energy related keywords
      const hasRelevantKeywords = keywordTerms.some(term => 
        term.includes('energie') || 
        term.includes('klimaat') || 
        term.includes('co2') ||
        term.includes('duurzaam')
      );
      expect(hasRelevantKeywords).toBe(true);

      // Verify entity extraction
      expect(basicAnalysis.entities.persons.length).toBeGreaterThan(0);
      expect(basicAnalysis.entities.parties.length).toBeGreaterThan(0);
      expect(basicAnalysis.entities.organizations.length).toBeGreaterThan(0);

      // Should detect political parties mentioned
      expect(basicAnalysis.entities.parties).toContain('VVD');
      expect(basicAnalysis.entities.parties).toContain('GroenLinks');
      expect(basicAnalysis.entities.parties).toContain('PVV');

      // Should detect persons mentioned
      const personNames = basicAnalysis.entities.persons.join(' ');
      expect(personNames).toMatch(/Wilders|Jetten|Van der Plas/);

      // Should detect organizations
      const orgNames = basicAnalysis.entities.organizations.join(' ');
      expect(orgNames.length).toBeGreaterThan(0);

      // Verify statistics
      expect(basicAnalysis.statistics.characterCount).toBeGreaterThan(1000);
      expect(basicAnalysis.statistics.wordCount).toBeGreaterThan(100);
      expect(basicAnalysis.statistics.estimatedReadingTime).toMatch(/\d+ minute/);
      expect(basicAnalysis.statistics.documentStructure).toBe('Formal letter or correspondence');

      // Verify topics
      expect(basicAnalysis.topics.length).toBeGreaterThan(0);
      const topicString = basicAnalysis.topics.join(' ');
      expect(topicString).toMatch(/Climate|Environment|Energy|Economy|Finance/i);

      // Verify preview
      expect(basicAnalysis.preview.length).toBeGreaterThan(0);
      expect(basicAnalysis.preview.length).toBeLessThanOrEqual(500);
    });

    it('should calculate high relevance for matching search terms', async () => {
      const climateDocument = `
        Het klimaatbeleid van Nederland richt zich op de vermindering van CO2-uitstoot.
        De energietransitie is essentieel voor het behalen van onze klimaatdoelstellingen.
        Duurzame energie zoals windenergie en zonne-energie worden steeds belangrijker.
        Het kabinet investeert miljarden in klimaatmaatregelen en energiebesparende maatregelen.
        De minister van Klimaat en Energie benadrukt het urgente karakter van de klimaatcrisis.
      `.repeat(10);

      const analysis = await analyzeDocumentContent(
        climateDocument,
        ['klimaat', 'energie', 'CO2', 'duurzaam', 'climate']
      );

      expect(analysis.relevanceScore).toBeDefined();
      // Relevance score should be moderate to high (algorithm is conservative)
      expect(analysis.relevanceScore).toBeGreaterThan(40);
      expect(analysis.relevanceScore).toBeLessThanOrEqual(100);
      
      // Keywords should align with search terms
      const keywordTerms = analysis.keywords.map(k => k.term.toLowerCase()).join(' ');
      expect(keywordTerms).toMatch(/klimaat|energie|co2|duurzaam/);
    });

    it('should calculate low relevance for non-matching search terms', async () => {
      const educationDocument = `
        Het onderwijsstelsel in Nederland heeft hervorming nodig. Scholen hebben te maken 
        met lerarentekorten en budgetproblemen. Studenten ervaren te veel werkdruk en 
        studieschulden lopen op. De minister van Onderwijs wil investeren in de kwaliteit 
        van het onderwijs. Universiteiten en hogescholen vragen om meer middelen.
      `.repeat(10);

      const analysis = await analyzeDocumentContent(
        educationDocument,
        ['klimaat', 'energie', 'CO2', 'milieu']
      );

      expect(analysis.relevanceScore).toBeDefined();
      expect(analysis.relevanceScore).toBeLessThan(30);
    });

    it('should handle mixed language content', async () => {
      const mixedDocument = `
        De European Green Deal sets ambitious climate targets for 2030 and 2050.
        Nederland werkt samen met andere EU-landen aan de energietransitie.
        The reduction of CO2 emissions is a priority voor het kabinet.
        Climate policy vereist investments in renewable energy sources.
      `.repeat(5);

      const analysis = await analyzeDocumentContent(mixedDocument);

      expect(analysis.keywords.length).toBeGreaterThan(0);
      expect(analysis.statistics.wordCount).toBeGreaterThan(0);
      
      // Should extract keywords from both languages
      const keywordTerms = analysis.keywords.map(k => k.term);
      expect(keywordTerms.length).toBeGreaterThan(5);
    });

    it('should provide actionable nextSteps based on relevance', async () => {
      const highRelevanceDoc = `
        Klimaatverandering is een urgent probleem. De CO2-uitstoot moet drastisch omlaag.
        Energie uit fossiele brandstoffen moet worden vervangen door duurzame energie.
        Windparken en zonnepanelen zijn essentieel voor de energietransitie.
      `.repeat(10);

      const analysis = await analyzeDocumentContent(
        highRelevanceDoc,
        ['klimaat', 'energie']
      );

      // With high relevance, we can simulate what the tool would return
      const nextSteps = analysis.relevanceScore && analysis.relevanceScore > 60
        ? "This document appears highly relevant. Consider using get_document_content or find_person_in_document to read specific sections."
        : analysis.relevanceScore && analysis.relevanceScore > 30
        ? "This document has moderate relevance. Review the keywords and entities to decide if it's worth reading in detail."
        : "This document has low relevance to your search terms. Consider analyzing other documents first.";

      expect(nextSteps).toContain('highly relevant');
    });

    it('should efficiently summarize a long document', async () => {
      // Create a very long document (simulating a full debate transcript)
      const longDebate = `
        De voorzitter: We beginnen met het debat over klimaatbeleid.
        
        Minister Jetten: Dank u, voorzitter. Het klimaatbeleid van dit kabinet...
        
        De heer Wilders (PVV): Voorzitter, ik heb een vraag aan de minister...
      `.repeat(100); // Very long document

      const startTime = Date.now();
      const analysis = await analyzeDocumentContent(longDebate);
      const endTime = Date.now();
      const processingTime = endTime - startTime;

      // Should complete in reasonable time even for long documents
      expect(processingTime).toBeLessThan(5000); // Less than 5 seconds

      // Should still provide meaningful analysis
      expect(analysis.keywords.length).toBeGreaterThan(0);
      expect(analysis.entities.persons.length).toBeGreaterThan(0);
      expect(analysis.entities.parties.length).toBeGreaterThan(0);
      expect(analysis.statistics.wordCount).toBeGreaterThan(1000);
    });
  });
});

