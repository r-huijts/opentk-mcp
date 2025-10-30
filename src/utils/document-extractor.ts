/**
 * Utility for extracting text from various document formats
 * Using established libraries for better reliability
 */

// Using require for pdf-parse due to CommonJS module compatibility
const pdfParse = require('pdf-parse');
import * as mammoth from 'mammoth';
import * as natural from 'natural';

// Initialize TF-IDF for keyword extraction
const TfIdf = natural.TfIdf;

/**
 * Extracts text from a PDF document using pdf-parse library
 * @param data The PDF document as a Buffer
 * @returns The extracted text content
 */
export async function extractTextFromPdf(data: ArrayBuffer): Promise<string> {
  try {
    // Convert ArrayBuffer to Buffer for pdf-parse
    const buffer = Buffer.from(data);

    // Parse the PDF
    const result = await pdfParse(buffer);

    // Get the text content
    let extractedText = result.text || '';

    // Clean up the text
    extractedText = extractedText.replace(/\s+/g, ' ').trim();

    if (!extractedText || extractedText.length < 50) {
      return 'The document appears to be a PDF file, but no readable text content could be extracted. This might be due to the document structure, content format, or encryption. Please download the original document for full content.';
    }

    return extractedText;
  } catch (error) {
    return 'Failed to extract text from the PDF document. This might be due to the document structure, content format, or encryption. Please download the original document for full content.';
  }
}

/**
 * Extracts text from a DOCX document using mammoth library
 * @param data The DOCX document as an ArrayBuffer
 * @returns The extracted text content
 */
export async function extractTextFromDocx(data: ArrayBuffer): Promise<string> {
  try {
    // Convert ArrayBuffer to Buffer for mammoth
    const buffer = Buffer.from(data);

    // Extract text from the DOCX
    const result = await mammoth.extractRawText({ buffer });

    // Get the text content
    let extractedText = result.value || '';

    // Clean up the text
    extractedText = extractedText.replace(/\s+/g, ' ').trim();

    if (!extractedText || extractedText.length < 50) {
      return 'The document appears to be a Word file, but no readable text content could be extracted. This might be due to the document structure or content format. Please download the original document for full content.';
    }

    return extractedText;
  } catch (error) {
    return 'Failed to extract text from the DOCX document. This might be due to the document structure or content format. Please download the original document for full content.';
  }
}

/**
 * Summarizes the extracted text to a reasonable length
 * @param text The full extracted text
 * @param maxLength Maximum length of the summary (default: 8000 characters)
 * @param offset Starting position for extraction (default: 0)
 * @returns Object containing the summarized text and pagination info
 */
export function summarizeText(text: string, maxLength: number = 8000, offset: number = 0): {
  text: string;
  isTruncated: boolean;
  totalLength: number;
  currentOffset: number;
  nextOffset: number | null;
  remainingLength: number;
} {
  const totalLength = text.length;

  // Validate offset
  if (offset >= totalLength) {
    return {
      text: 'No more content available. You have reached the end of the document.',
      isTruncated: false,
      totalLength,
      currentOffset: offset,
      nextOffset: null,
      remainingLength: 0
    };
  }

  // Extract the portion of text from offset to offset + maxLength
  const endPosition = Math.min(offset + maxLength, totalLength);
  const extractedText = text.substring(offset, endPosition);
  const isTruncated = endPosition < totalLength;

  // Calculate next offset and remaining length
  const nextOffset = isTruncated ? endPosition : null;
  const remainingLength = totalLength - endPosition;

  return {
    text: extractedText + (isTruncated ? '... [Text truncated due to length]' : ''),
    isTruncated,
    totalLength,
    currentOffset: offset,
    nextOffset,
    remainingLength
  };
}

/**
 * Interface for person occurrence results
 */
export interface PersonOccurrence {
  lineStart: number;
  lineEnd: number;
  characterOffset: number;
  snippet: string;
  context: string;
}

/**
 * Finds all occurrences of a person's name in document text using fuzzy matching
 * @param text The full document text to search in
 * @param personName The name or part of a name to search for
 * @returns Array of occurrence objects with location and context information
 */
export function findPersonOccurrences(text: string, personName: string): PersonOccurrence[] {
  if (!text || !personName) {
    return [];
  }

  const occurrences: PersonOccurrence[] = [];
  
  // Split text into lines for line number tracking
  const lines = text.split(/\r?\n/);
  
  // Normalize the search name for fuzzy matching
  const normalizedSearchName = normalizeText(personName);
  
  // Track character positions for each line
  let currentCharOffset = 0;
  const lineOffsets: number[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    lineOffsets.push(currentCharOffset);
    const line = lines[i];
    if (line) {
      currentCharOffset += line.length + 1; // +1 for newline character
    }
  }

  // Search through each line for fuzzy matches
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    if (!line) continue;
    
    const normalizedLine = normalizeText(line);
    
    // Check if the normalized line contains the normalized search name
    if (normalizedLine.includes(normalizedSearchName)) {
      // Find the actual position in the original line
      const matchIndex = findFuzzyMatch(line, personName);
      
      if (matchIndex !== -1) {
        const lineOffset = lineOffsets[lineIndex];
        if (lineOffset !== undefined) {
          const characterOffset = lineOffset + matchIndex;
          
          // Create snippet (30 chars before and after the match)
          const snippetStart = Math.max(0, matchIndex - 30);
          const snippetEnd = Math.min(line.length, matchIndex + personName.length + 30);
          const snippet = line.substring(snippetStart, snippetEnd);
        
          // Create context (2 lines before and after)
          const contextStart = Math.max(0, lineIndex - 2);
          const contextEnd = Math.min(lines.length, lineIndex + 3);
          const context = lines.slice(contextStart, contextEnd).join('\n');
          
          occurrences.push({
            lineStart: lineIndex + 1, // Convert to 1-based line numbers
            lineEnd: lineIndex + 1,
            characterOffset,
            snippet: snippet.trim(),
            context: context.trim()
          });
        }
      }
    }
  }

  return occurrences;
}

/**
 * Finds all occurrences of a political party in document text using fuzzy matching
 * @param text The full document text to search in
 * @param partyName The party abbreviation or name to search for (e.g., 'VVD', 'PVV', 'CDA')
 * @returns Array of occurrence objects with location and context information
 */
export function findPartyOccurrences(text: string, partyName: string): PersonOccurrence[] {
  if (!text || !partyName) {
    return [];
  }

  const occurrences: PersonOccurrence[] = [];
  
  // Split text into lines for line number tracking
  const lines = text.split(/\r?\n/);
  
  // Normalize the search name for fuzzy matching
  const normalizedSearchName = normalizeText(partyName);
  
  // Track character positions for each line
  let currentCharOffset = 0;
  const lineOffsets: number[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    lineOffsets.push(currentCharOffset);
    const line = lines[i];
    if (line) {
      currentCharOffset += line.length + 1; // +1 for newline character
    }
  }

  // Search through each line for fuzzy matches
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    if (!line) continue;
    
    const normalizedLine = normalizeText(line);
    
    // Check if the normalized line contains the normalized search name
    if (normalizedLine.includes(normalizedSearchName)) {
      // Find the actual position in the original line
      const matchIndex = findFuzzyMatch(line, partyName);
      
      if (matchIndex !== -1) {
        const lineOffset = lineOffsets[lineIndex];
        if (lineOffset !== undefined) {
          const characterOffset = lineOffset + matchIndex;
          
          // Create snippet (30 chars before and after the match)
          const snippetStart = Math.max(0, matchIndex - 30);
          const snippetEnd = Math.min(line.length, matchIndex + partyName.length + 30);
          const snippet = line.substring(snippetStart, snippetEnd);
        
          // Create context (2 lines before and after)
          const contextStart = Math.max(0, lineIndex - 2);
          const contextEnd = Math.min(lines.length, lineIndex + 3);
          const context = lines.slice(contextStart, contextEnd).join('\n');
          
          occurrences.push({
            lineStart: lineIndex + 1, // Convert to 1-based line numbers
            lineEnd: lineIndex + 1,
            characterOffset,
            snippet: snippet.trim(),
            context: context.trim()
          });
        }
      }
    }
  }

  return occurrences;
}

/**
 * Find the start of a paragraph near the given position
 * Looks backwards for double newlines or start of text
 */
export function findParagraphStart(text: string, position: number): number {
  // Look backwards for paragraph boundary (double newline)
  for (let i = position; i >= 0; i--) {
    if (text[i] === '\n' && (i === 0 || text[i-1] === '\n')) {
      return i + 1; // Start after the newline
    }
  }
  return 0; // Start of document
}

/**
 * Find the end of a paragraph near the given position
 * Looks forwards for double newlines or end of text
 */
export function findParagraphEnd(text: string, position: number): number {
  // Look forwards for paragraph boundary
  for (let i = position; i < text.length; i++) {
    if (text[i] === '\n' && (i === text.length - 1 || text[i+1] === '\n')) {
      return i; // End at the newline
    }
  }
  return text.length; // End of document
}

/**
 * Normalizes text for fuzzy matching by removing accents, converting to lowercase, and cleaning up whitespace
 * @param text The text to normalize
 * @returns Normalized text
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD') // Decompose accented characters
    .replace(/[\u0300-\u036f]/g, '') // Remove accent marks
    .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Finds the position of a fuzzy match in the original text
 * @param originalText The original text to search in
 * @param searchName The name to search for
 * @returns The character index of the match, or -1 if not found
 */
function findFuzzyMatch(originalText: string, searchName: string): number {
  const normalizedOriginal = normalizeText(originalText);
  const normalizedSearch = normalizeText(searchName);
  
  const index = normalizedOriginal.indexOf(normalizedSearch);
  if (index === -1) {
    return -1;
  }
  
  // Find the corresponding position in the original text
  let originalIndex = 0;
  let normalizedIndex = 0;
  
  while (normalizedIndex < index && originalIndex < originalText.length) {
    const char = originalText[originalIndex];
    if (char) {
      const normalizedChar = normalizeText(char);
      
      if (normalizedChar.length > 0) {
        normalizedIndex += normalizedChar.length;
      }
    }
    originalIndex++;
  }
  
  return originalIndex;
}

/**
 * Interface for document analysis results
 */
export interface DocumentAnalysis {
  keywords: Array<{ term: string; score: number }>;
  entities: {
    persons: string[];
    parties: string[];
    organizations: string[];
  };
  statistics: {
    characterCount: number;
    wordCount: number;
    estimatedReadingTime: string;
    documentStructure: string;
  };
  topics: string[];
  relevanceScore?: number;
  preview: string;
}

/**
 * Analyzes document content to extract keywords, entities, topics, and statistics
 * @param text The full document text to analyze
 * @param searchTerms Optional array of search terms to calculate relevance score
 * @returns Comprehensive document analysis
 */
export async function analyzeDocumentContent(
  text: string,
  searchTerms?: string[]
): Promise<DocumentAnalysis> {
  // Extract keywords using TF-IDF
  const keywords = extractKeywords(text);
  
  // Extract entities
  const entities = extractEntities(text);
  
  // Calculate statistics
  const statistics = calculateStatistics(text);
  
  // Extract topics (derived from top keywords)
  const topics = deriveTopics(keywords);
  
  // Calculate relevance score if search terms provided
  let relevanceScore: number | undefined;
  if (searchTerms && searchTerms.length > 0) {
    relevanceScore = calculateRelevanceScore(text, keywords, searchTerms);
  }
  
  // Get preview (first ~500 characters)
  const preview = text.substring(0, 500).trim();
  
  return {
    keywords,
    entities,
    statistics,
    topics,
    relevanceScore,
    preview
  };
}

/**
 * Extracts top keywords from text using TF-IDF analysis
 * @param text The text to analyze
 * @returns Array of keywords with scores
 */
function extractKeywords(text: string): Array<{ term: string; score: number }> {
  const tfidf = new TfIdf();
  
  // Add the document to TF-IDF
  tfidf.addDocument(text);
  
  // Get all terms with their TF-IDF scores
  const terms: Array<{ term: string; score: number }> = [];
  
  tfidf.listTerms(0).forEach((item: any) => {
    // Filter out very short terms (likely not meaningful)
    if (item.term.length > 3) {
      terms.push({
        term: item.term,
        score: item.tfidf
      });
    }
  });
  
  // Sort by score and take top 15
  return terms
    .sort((a, b) => b.score - a.score)
    .slice(0, 15);
}

/**
 * Extracts named entities (persons, parties, organizations) from text
 * @param text The text to analyze
 * @returns Object containing arrays of entities
 */
function extractEntities(text: string): {
  persons: string[];
  parties: string[];
  organizations: string[];
} {
  const persons: Set<string> = new Set();
  const parties: Set<string> = new Set();
  const organizations: Set<string> = new Set();
  
  // Common Dutch titles and honorifics for person detection
  const personTitles = [
    'de heer',
    'mevrouw',
    'minister',
    'staatssecretaris',
    'premier',
    'minister-president',
    'voorzitter',
    'fractievoorzitter',
    'kamerlid'
  ];
  
  // Dutch political parties (comprehensive list)
  const dutchParties = [
    'VVD', 'PVV', 'CDA', 'D66', 'GroenLinks', 'GL',
    'PvdA', 'SP', 'PvdD', 'ChristenUnie', 'CU',
    'SGP', 'DENK', 'FvD', 'Forum voor Democratie',
    'JA21', 'Volt', 'BIJ1', 'BBB', 'BoerBurgerBeweging',
    'NSC', 'Nieuw Sociaal Contract', 'Omtzigt'
  ];
  
  // Extract persons using pattern matching
  personTitles.forEach(title => {
    // Match patterns like "de heer [Name]" or "minister [Name]"
    const regex = new RegExp(`${title}\\s+([A-Z][a-z]+(?:\\s+(?:van|de|den|der|te|tot)\\s+)?[A-Z][a-z]+)`, 'gi');
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      if (match[1]) {
        persons.add(match[1].trim());
      }
    }
  });
  
  // Also catch standalone capitalized names (2-3 words)
  const nameRegex = /\b([A-Z][a-z]+(?:\s+(?:van|de|den|der|te|tot)\s+)?[A-Z][a-z]+)\b/g;
  let nameMatch;
  while ((nameMatch = nameRegex.exec(text)) !== null) {
    const name = nameMatch[1];
    if (name) {
      // Only add if it appears multiple times (more likely to be a person)
      const occurrences = (text.match(new RegExp(name, 'g')) || []).length;
      if (occurrences >= 2) {
        persons.add(name.trim());
      }
    }
  }
  
  // Extract political parties
  dutchParties.forEach(party => {
    // Look for the party name with word boundaries
    const regex = new RegExp(`\\b${party}\\b`, 'gi');
    if (regex.test(text)) {
      parties.add(party);
    }
  });
  
  // Extract organizations (simplified - look for common patterns)
  // Match capitalized words followed by organization indicators
  const orgIndicators = ['ministerie', 'ministry', 'commissie', 'raad', 'stichting', 'organisatie'];
  orgIndicators.forEach(indicator => {
    const regex = new RegExp(`([A-Z][a-z]+(?:\\s+[A-Z][a-z]+)*)\\s+${indicator}`, 'gi');
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      if (match[0]) {
        organizations.add(match[0].trim());
      }
    }
  });
  
  return {
    persons: Array.from(persons).slice(0, 20), // Limit to top 20
    parties: Array.from(parties),
    organizations: Array.from(organizations).slice(0, 10) // Limit to top 10
  };
}

/**
 * Calculates basic statistics about the document
 * @param text The text to analyze
 * @returns Statistics object
 */
function calculateStatistics(text: string): {
  characterCount: number;
  wordCount: number;
  estimatedReadingTime: string;
  documentStructure: string;
} {
  const characterCount = text.length;
  
  // Count words (split by whitespace and filter empty strings)
  const words = text.split(/\s+/).filter(word => word.length > 0);
  const wordCount = words.length;
  
  // Estimate reading time (average 200-250 words per minute)
  const readingMinutes = Math.ceil(wordCount / 225);
  const estimatedReadingTime = readingMinutes === 1 
    ? '1 minute' 
    : `${readingMinutes} minutes`;
  
  // Determine document structure
  let documentStructure = 'Unknown';
  if (text.includes('Voorzitter:') || text.includes('De voorzitter:')) {
    documentStructure = 'Parliamentary debate transcript';
  } else if (text.includes('Geachte') || text.includes('Hoogachtend')) {
    documentStructure = 'Formal letter or correspondence';
  } else if (text.includes('Artikel') && text.includes('Wet')) {
    documentStructure = 'Legislative text';
  } else if (wordCount < 500) {
    documentStructure = 'Short document or summary';
  } else if (wordCount > 5000) {
    documentStructure = 'Extensive document or report';
  } else {
    documentStructure = 'Standard parliamentary document';
  }
  
  return {
    characterCount,
    wordCount,
    estimatedReadingTime,
    documentStructure
  };
}

/**
 * Derives main topics from keywords
 * @param keywords Array of keywords with scores
 * @returns Array of topic strings
 */
function deriveTopics(keywords: Array<{ term: string; score: number }>): string[] {
  // Topic categories based on common Dutch political themes
  const topicKeywords: Record<string, string[]> = {
    'Climate & Environment': ['klimaat', 'milieu', 'energie', 'duurzaam', 'co2', 'uitstoot', 'groen'],
    'Economy & Finance': ['economie', 'belasting', 'begroting', 'financien', 'economisch', 'geld', 'euro'],
    'Healthcare': ['zorg', 'gezondheidszorg', 'ziektekostenverzekering', 'medisch', 'patienten', 'ziekenhuis'],
    'Education': ['onderwijs', 'scholen', 'universiteit', 'studenten', 'leraren', 'opleiding'],
    'Immigration': ['immigratie', 'migratie', 'asiel', 'vluchtelingen', 'vreemdelingen'],
    'Housing': ['wonen', 'woningen', 'huur', 'huizen', 'volkshuisvesting', 'woningbouw'],
    'Security & Defense': ['veiligheid', 'defensie', 'politie', 'criminaliteit', 'terrorisme'],
    'Social Affairs': ['sociaal', 'uitkering', 'werk', 'werkloosheid', 'sociale zekerheid'],
    'Infrastructure': ['infrastructuur', 'verkeer', 'vervoer', 'wegen', 'spoor', 'transport'],
    'Agriculture': ['landbouw', 'boeren', 'stikstof', 'vee', 'mest', 'agrarie']
  };
  
  const detectedTopics: Set<string> = new Set();
  
  // Check each keyword against topic categories
  keywords.forEach(keyword => {
    const term = keyword.term.toLowerCase();
    
    Object.entries(topicKeywords).forEach(([topic, topicTerms]) => {
      if (topicTerms.some(topicTerm => term.includes(topicTerm) || topicTerm.includes(term))) {
        detectedTopics.add(topic);
      }
    });
  });
  
  // If no specific topics detected, use top keywords as topics
  if (detectedTopics.size === 0) {
    return keywords.slice(0, 5).map(k => k.term);
  }
  
  return Array.from(detectedTopics);
}

/**
 * Calculates relevance score based on search terms
 * @param text The full text
 * @param keywords Extracted keywords
 * @param searchTerms Array of search terms
 * @returns Relevance score from 0-100
 */
function calculateRelevanceScore(
  text: string,
  keywords: Array<{ term: string; score: number }>,
  searchTerms: string[]
): number {
  const normalizedText = normalizeText(text);
  const normalizedKeywords = keywords.map(k => normalizeText(k.term));
  
  let totalScore = 0;
  let maxPossibleScore = searchTerms.length * 100;
  
  searchTerms.forEach(searchTerm => {
    const normalizedSearchTerm = normalizeText(searchTerm);
    
    // Check if search term appears in text (case-insensitive)
    const occurrences = (normalizedText.match(new RegExp(normalizedSearchTerm, 'g')) || []).length;
    
    // Score based on occurrences (capped at 50 points)
    const occurrenceScore = Math.min(occurrences * 10, 50);
    
    // Score based on keyword matches (up to 50 points)
    const keywordMatch = normalizedKeywords.some(k => 
      k.includes(normalizedSearchTerm) || normalizedSearchTerm.includes(k)
    );
    const keywordScore = keywordMatch ? 50 : 0;
    
    totalScore += occurrenceScore + keywordScore;
  });
  
  // Calculate percentage and ensure it's between 0-100
  const relevanceScore = Math.min(Math.round((totalScore / maxPossibleScore) * 100), 100);
  
  return relevanceScore;
}
