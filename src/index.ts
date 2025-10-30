#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { apiService } from "./services/api.js";
import { extractDocumentLink } from "./utils/html-parser.js";
import { BASE_URL } from './config.js';
import {
  extractDocumentDetailsFromHtml,
  extractCommitteesFromHtml,
  extractCommitteeDetailsFromHtml,
  extractActivitiesFromHtml,
  extractVotingResultsFromHtml
} from './utils/html-parser.js';
import { extractTextFromPdf, extractTextFromDocx, summarizeText, findPersonOccurrences, findPartyOccurrences, findParagraphStart, findParagraphEnd, analyzeDocumentContent } from './utils/document-extractor.js';
import { Buffer } from "buffer";

const mcp = new McpServer({
  name: "opentk",
  version: "1.0.17",
  description: "Human‑friendly MCP toolkit for all tkconv endpoints",
});

/** 1. Overview */
mcp.tool(
  "get_overview",
  "Provides a comprehensive overview of recent parliamentary activities, including the most recent documents and MPs celebrating birthdays today. The response contains structured data with two main sections: 'recentDocuments' (listing the latest parliamentary documents with their IDs, titles, types, dates, and URLs) and 'birthdays' (listing MPs celebrating birthdays today). The results are paginated with 10 documents per page. The tool supports iterative pagination - check the pagination.hasMoreDocuments field in the response to determine if additional pages are available. The response includes pagination information showing the current page, whether more documents are available, and the total number of documents retrieved. Applicable when general information about recent parliamentary activities is needed.",
  {
    page: z.number().optional().describe("Page number for paginated results (default: 1). Each page contains 10 documents.")
  },
  async ({ page = 1 }) => {
    try {
      // Validate page number
      const validatedPage = Math.max(1, page);

      // Get overview data with pagination
      const overview = await apiService.getOverview(validatedPage);

      return {
        content: [{
          type: "text",
          text: JSON.stringify(overview, null, 2)
        }]
      };
    } catch (error: any) {
      return {
        content: [{
          type: "text",
          text: `Error fetching overview: ${error.message || 'Unknown error'}`
        }]
      };
    }
  }
);

/** 4. Birthdays today */
mcp.tool(
  "birthdays_today",
  "Lists all Members of Parliament celebrating their birthday today, including their names, political parties, and birth dates. The response is a JSON array where each entry contains the MP's ID, name, party affiliation, and other details. This tool takes no parameters as it always returns today's birthdays. Applicable when information about MPs' birthdays is needed.",
  {},
  async () => {
    try {
      const data = await apiService.fetchJson(`/jarig-vandaag`);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    } catch (error: any) {
      return {
        content: [{
          type: "text",
          text: `Error fetching birthdays: ${error.message || 'Unknown error'}`
        }]
      };
    }
  }
);

/** 5. All MPs directory */
mcp.tool(
  "list_persons",
  "Provides a complete directory of current Members of Parliament with their IDs, names, titles, party affiliations, and faction memberships. The response is a JSON array where each entry contains an MP's full details including unique MP IDs that can be referenced by other tools. This tool takes no parameters as it returns all current MPs. Applicable when comprehensive information about all MPs is needed or when analyzing the composition of parliament by party.",
  {},
  async () => {
    try {
      // Use the tkconv API to get the MP list
      const persons = await apiService.getPersons();

      if (persons.length === 0) {
        return {
          content: [{
            type: "text",
            text: "No MPs found or there was an error retrieving the MP list. Please try again later."
          }]
        };
      }

      return { content: [{ type: "text", text: JSON.stringify(persons, null, 2) }] };
    } catch (error: any) {
      return {
        content: [{
          type: "text",
          text: `Error fetching MP list: ${error.message || 'Unknown error'}`
        }]
      };
    }
  }
);

/** 6. Keyword search */
mcp.tool(
  "search_tk",
  "Performs a comprehensive search across all parliamentary data including documents, activities, and cases. Returns results matching the provided keyword or phrase. Use this for general searches when you need information on any topic discussed in parliament, regardless of document type or context. Search syntax: Searching for 'Joe Biden' finds documents containing both 'Joe' and 'Biden' anywhere in the text. Searching for \"Joe Biden\" (with quotes) finds only documents where these words appear next to each other. Searching for 'Hubert NOT Bruls' finds documents containing 'Hubert' but not 'Bruls'. The capital letters in 'NOT' are important. You can also use 'OR' and 'NEAR()' operators.",
  {
    query: z.string().describe("Search keyword or phrase - can be any term, name, policy area, or exact quote you want to find in parliamentary records. Use quotes for exact phrases, 'NOT' to exclude terms, 'OR' for alternatives, and 'NEAR()' for proximity searches."),
    page: z.number().optional().describe("Page number for paginated results (default: 1)"),
    limit: z.number().optional().describe("Maximum number of results to return per page (default: 20, max: 100)"),
    format: z.enum(["full", "summary"]).optional().describe("Format of the results: 'full' for complete data or 'summary' for a condensed version (default: 'summary')")
  },
  async ({ query, page = 1, limit = 20, format = "summary" }) => {
    try {
      // Validate and cap the limit
      const validatedLimit = Math.min(Math.max(1, limit), 100);
      const validatedPage = Math.max(1, page);

      const data = await apiService.search<{ results: any[], error?: string }>(query);

      // Check if there's an error message in the response
      if (data.error) {
        return {
          content: [
            { type: "text", text: data.error },
            { type: "text", text: JSON.stringify(data.results, null, 2) }
          ]
        };
      }

      // If no results were found
      if (!data.results || data.results.length === 0) {
        return {
          content: [{
            type: "text",
            text: `No results found for query: ${query}. Try using different keywords or simplifying your search.`
          }]
        };
      }

      // Sort results by date (most recent first)
      const sortedResults = [...data.results].sort((a, b) => {
        // Parse dates from the 'datum' field (format: YYYY-MM-DDT00:00:00)
        const dateA = new Date(a.datum);
        const dateB = new Date(b.datum);
        return dateB.getTime() - dateA.getTime(); // Descending order (newest first)
      });

      // Calculate pagination
      const totalResults = sortedResults.length;
      const totalPages = Math.ceil(totalResults / validatedLimit);
      const startIndex = (validatedPage - 1) * validatedLimit;
      const endIndex = Math.min(startIndex + validatedLimit, totalResults);
      const paginatedResults = sortedResults.slice(startIndex, endIndex);

      // Create pagination info
      const paginationInfo = {
        query,
        totalResults,
        page: validatedPage,
        limit: validatedLimit,
        totalPages,
        hasNextPage: validatedPage < totalPages,
        hasPreviousPage: validatedPage > 1
      };

      // Format the results based on the requested format
      let formattedResults;
      if (format === "summary") {
        // Create a summary version with only essential fields
        formattedResults = paginatedResults.map(item => ({
          id: item.id,
          title: item.title,
          category: item.category,
          datum: item.datum,
          url: item.url
        }));
      } else {
        // Use the full data
        formattedResults = paginatedResults;
      }

      // Return the paginated results with pagination info
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            pagination: paginationInfo,
            results: formattedResults
          }, null, 2)
        }]
      };
    } catch (error: any) {
      return {
        content: [{
          type: "text",
          text: `Error searching: ${error.message || 'Unknown error'}`
        }]
      };
    }
  }
);

/** 7. Search filtered by type */
mcp.tool(
  "search_tk_filtered",
  "Performs a search within a specific category of parliamentary data, allowing results to be limited to only documents, activities, or cases. Returns paginated results sorted by date (most recent first). Search syntax supports: keyword searches ('Joe Biden' finds both terms), exact phrase searches (\"Joe Biden\" with quotes finds the exact phrase), exclusion ('Hubert NOT Bruls' excludes documents with 'Bruls'), and boolean operators ('OR', 'NEAR()'). Results can be returned in 'full' or 'summary' format.",
  {
    query: z.string().describe("Search term - any keyword, name, policy area, or quote you want to find in parliamentary records. Use quotes for exact phrases, 'NOT' to exclude terms, 'OR' for alternatives, and 'NEAR()' for proximity searches."),
    type: z
      .enum(["Document", "Activiteit", "Zaak"])
      .describe("Category filter: 'Document' for official papers, reports and letters; 'Activiteit' for debates and committee meetings; 'Zaak' for legislative cases and motions"),
    page: z.number().optional().describe("Page number for paginated results (default: 1)"),
    limit: z.number().optional().describe("Maximum number of results to return per page (default: 20, max: 100)"),
    format: z.enum(["full", "summary"]).optional().describe("Format of the results: 'full' for complete data or 'summary' for a condensed version (default: 'summary')")
  },
  async ({ query, type, page = 1, limit = 20, format = "summary" }) => {
    try {
      // Validate and cap the limit
      const validatedLimit = Math.min(Math.max(1, limit), 100);
      const validatedPage = Math.max(1, page);

      const data = await apiService.search<{ results: any[], error?: string }>(query);

      // Check if there's an error message in the response
      if (data.error) {
        return {
          content: [
            { type: "text", text: data.error },
            { type: "text", text: "[]" }
          ]
        };
      }

      // Filter the results by category
      const filtered = data.results ? data.results.filter((r: any) => r.category === type) : [];

      // If no results were found after filtering
      if (filtered.length === 0) {
        return {
          content: [{
            type: "text",
            text: `No results found for query: ${query} with filter: ${type}. Try using different keywords or a different filter.`
          }]
        };
      }

      // Sort filtered results by date (most recent first)
      const sortedResults = [...filtered].sort((a, b) => {
        // Parse dates from the 'datum' field (format: YYYY-MM-DDT00:00:00)
        const dateA = new Date(a.datum);
        const dateB = new Date(b.datum);
        return dateB.getTime() - dateA.getTime(); // Descending order (newest first)
      });

      // Calculate pagination
      const totalResults = sortedResults.length;
      const totalPages = Math.ceil(totalResults / validatedLimit);
      const startIndex = (validatedPage - 1) * validatedLimit;
      const endIndex = Math.min(startIndex + validatedLimit, totalResults);
      const paginatedResults = sortedResults.slice(startIndex, endIndex);

      // Create pagination info
      const paginationInfo = {
        query,
        type,
        totalResults,
        page: validatedPage,
        limit: validatedLimit,
        totalPages,
        hasNextPage: validatedPage < totalPages,
        hasPreviousPage: validatedPage > 1
      };

      // Format the results based on the requested format
      let formattedResults;
      if (format === "summary") {
        // Create a summary version with only essential fields
        formattedResults = paginatedResults.map(item => ({
          id: item.id,
          title: item.title,
          category: item.category,
          datum: item.datum,
          url: item.url
        }));
      } else {
        // Use the full data
        formattedResults = paginatedResults;
      }

      // Return the paginated results with pagination info
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            pagination: paginationInfo,
            results: formattedResults
          }, null, 2)
        }]
      };
    } catch (error: any) {
      return {
        content: [{
          type: "text",
          text: `Error searching with filter: ${error.message || 'Unknown error'}`
        }]
      };
    }
  }
);

/** . MP portrait */
mcp.tool(
  "get_photo",
  "Retrieves the official portrait photograph of a Member of Parliament. Returns the image as a binary resource that can be displayed or saved. Use this when you need to include a visual representation of an MP in reports, presentations, or profiles.",
  { personId: z.string().describe("MP's numeric ID - the unique identifier for the Member of Parliament whose photo you want to retrieve") },
  async ({ personId }) => {
    try {
      const { data } = await apiService.fetchBinary(`/personphoto/${encodeURIComponent(personId)}`);
      const base64 = Buffer.from(data).toString("base64");
      return {
        content: [
          {
            type: "resource",
            resource: {
              uri: `photo://${personId}`,
              blob: base64,
              mimeType: "image/jpeg"
            }
          }
        ]
      };
    } catch (error: any) {
      return {
        content: [{
          type: "text",
          text: `Error fetching MP photo: ${error.message || 'Unknown error'}`
        }]
      };
    }
  }
);

/** Document details with structured data */
mcp.tool(
  "get_document_details",
  "Retrieves metadata about a parliamentary document in a structured JSON format, without downloading the actual document content. Returns information including title, type, document number, dates, version number, and links to both the PDF version and the official Tweede Kamer webpage.",
  {
    nummer: z.string().describe("Document number (e.g., '2024D39058') - the unique identifier for the parliamentary document you want information about")
  },
  async ({ nummer }) => {
    try {
      const html = await apiService.fetchHtml(`/document.html?nummer=${encodeURIComponent(nummer)}`);
      if (!html) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ error: `No content found for document ${nummer}` })
          }]
        };
      }

      const details = extractDocumentDetailsFromHtml(html, BASE_URL);
      if (!details) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ error: `Failed to parse details for document ${nummer}` })
          }]
        };
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify(details, null, 2)
        }]
      };
    } catch (error: any) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            error: `Error fetching document details: ${error.message || 'Unknown error'}`
          })
        }]
      };
    }
  }
);

/** Generate clickable document links */
mcp.tool(
  "get_document_links",
  "Converts document URLs into clickable markdown-formatted links. This tool takes either a direct PDF link or a Tweede Kamer webpage link and returns them as properly formatted clickable links.",
  {
    pdfUrl: z.string().optional().describe("Direct link to the PDF document"),
    tkUrl: z.string().optional().describe("Link to the document page on Tweede Kamer website")
  },
  async ({ pdfUrl, tkUrl }) => {
    const links: string[] = [];

    if (pdfUrl) {
      links.push(`[Download PDF](${pdfUrl})`);
    }

    if (tkUrl) {
      // Remove any HTML entities from the URL
      const cleanTkUrl = tkUrl.replace(/&amp;/g, '&');
      links.push(`[View on Tweede Kamer website](${cleanTkUrl})`);
    }

    if (links.length === 0) {
      return {
        content: [{
          type: "text",
          text: "No valid links provided"
        }]
      };
    }

    return {
      content: [{
        type: "text",
        text: links.join("\n")
      }]
    };
  }
);

/** Get committees */
mcp.tool(
  "get_committees",
  "Retrieves a list of all parliamentary committees with their IDs, names, and URLs. The response is a JSON array where each entry represents a committee with its unique identifier and name. Committees are specialized groups of MPs that focus on specific domains like defense, healthcare, or finance. This tool takes no parameters as it returns all active committees.",
  {},
  async () => {
    try {
      const html = await apiService.fetchHtml("/commissies.html");
      const committees = extractCommitteesFromHtml(html, BASE_URL);

      if (committees.length === 0) {
        return {
          content: [{
            type: "text",
            text: "No committees found or there was an error retrieving the committee list. Please try again later."
          }]
        };
      }

      return { content: [{ type: "text", text: JSON.stringify(committees, null, 2) }] };
    } catch (error: any) {
      return {
        content: [{
          type: "text",
          text: `Error fetching committees: ${error.message || 'Unknown error'}`
        }]
      };
    }
  }
);

/** Get committee details */
mcp.tool(
  "get_committee_details",
  "Retrieves detailed information about a specific parliamentary committee, including its members, recent activities, and description. This provides deeper insight into the committee's composition, leadership roles, and recent work. Use this when you need comprehensive information about a particular committee's structure and activities.",
  {
    committeeId: z.string().describe("Committee ID - the unique identifier for the parliamentary committee you want information about")
  },
  async ({ committeeId }) => {
    try {
      const html = await apiService.fetchHtml(`/commissie.html?id=${encodeURIComponent(committeeId)}`);
      const committeeDetails = extractCommitteeDetailsFromHtml(html, BASE_URL, committeeId);

      if (!committeeDetails) {
        // If we couldn't extract details from the HTML, return a simplified response with just the name and ID
        const titleRegex = /<title>([^<]+)<\/title>/i;
        const titleMatch = html.match(titleRegex);
        const name = titleMatch?.[1]?.trim() || "Unknown Committee";

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              id: committeeId,
              name: name,
              url: `${BASE_URL}/commissie.html?id=${encodeURIComponent(committeeId)}`,
              note: "This committee uses dynamic content rendering. Only basic information is available."
            }, null, 2)
          }]
        };
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify(committeeDetails, null, 2)
        }]
      };
    } catch (error: any) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            error: `Error fetching committee details: ${error.message || 'Unknown error'}`
          })
        }]
      };
    }
  }
);

/** Get upcoming activities */
mcp.tool(
  "get_upcoming_activities",
  "Retrieves a list of upcoming parliamentary activities including debates, committee meetings, and other events. The response contains a structured JSON object with both a chronological list of activities and activities grouped by date. Each activity includes details like date, time, location, committee, type, and a URL for more information. The results are sorted by date with the most imminent activities first. The optional 'limit' parameter controls the number of results returned (default: 20, max: 100).",
  {
    limit: z.number().optional().describe("Maximum number of activities to return (default: 20, max: 100)")
  },
  async ({ limit = 20 }) => {
    try {
      // Validate and cap the limit
      const validatedLimit = Math.min(Math.max(1, limit), 100);

      const html = await apiService.fetchHtml("/activiteiten.html");
      const activities = extractActivitiesFromHtml(html, BASE_URL);

      if (activities.length === 0) {
        // If we couldn't extract activities from the HTML, return a simplified response
        // This could happen if the page structure changes or uses dynamic content
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              error: "No upcoming activities found or there was an error retrieving the activities list.",
              note: "The activities page may use dynamic content rendering. Please try again later or check the website directly.",
              url: `${BASE_URL}/activiteiten.html`
            }, null, 2)
          }]
        };
      }

      // Sort activities by date (most recent first) and limit the results
      const sortedActivities = [...activities].sort((a, b) => {
        const dateA = new Date(a.date + (a.time ? ` ${a.time}` : ''));
        const dateB = new Date(b.date + (b.time ? ` ${b.time}` : ''));
        return dateA.getTime() - dateB.getTime(); // Ascending order (upcoming first)
      }).slice(0, validatedLimit);

      // Group activities by date for better organization
      const groupedActivities: Record<string, any[]> = {};
      sortedActivities.forEach(activity => {
        const date = activity.date || 'unknown';
        if (!groupedActivities[date]) {
          groupedActivities[date] = [];
        }
        groupedActivities[date].push(activity);
      });

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            total: activities.length,
            limit: validatedLimit,
            groupedByDate: groupedActivities,
            activities: sortedActivities
          }, null, 2)
        }]
      };
    } catch (error: any) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            error: `Error fetching upcoming activities: ${error.message || 'Unknown error'}`,
            url: `${BASE_URL}/activiteiten.html`
          }, null, 2)
        }]
      };
    }
  }
);

/** Get voting results */
mcp.tool(
  "get_voting_results",
  "Retrieves recent voting results on parliamentary motions and bills. The response contains a structured JSON object with voting results sorted by date (newest first). Each result includes detailed information such as the title of the motion/bill, the date of the vote, the submitter, whether it was accepted or rejected, the vote counts (for/against), and which political parties voted for or against. The 'limit' parameter controls the number of results (default: 20, max: 100) and 'format' parameter allows choosing between 'full' or 'summary' format. The 'summary' format provides a more structured representation with renamed fields, while both formats include complete party voting information.",
  {
    limit: z.number().optional().describe("Maximum number of voting results to return (default: 20, max: 100)"),
    format: z.enum(["full", "summary"]).optional().describe("Format of the results: 'full' for complete data or 'summary' for a more structured version with renamed fields (default: 'full'). Both formats include party information.")
  },
  async ({ limit = 20, format = "full" }) => {
    try {
      // Validate and cap the limit
      const validatedLimit = Math.min(Math.max(1, limit), 100);

      const html = await apiService.fetchHtml("/stemmingen.html");
      const votingResults = extractVotingResultsFromHtml(html, BASE_URL);

      if (votingResults.length === 0) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              error: "No voting results found or there was an error retrieving the voting results list. Please try again later.",
              url: `${BASE_URL}/stemmingen.html`
            }, null, 2)
          }]
        };
      }

      // Sort voting results by date (most recent first) and limit the results
      const sortedResults = [...votingResults].sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return dateB.getTime() - dateA.getTime(); // Descending order (newest first)
      }).slice(0, validatedLimit);

      // Format the results based on the requested format
      let formattedResults;
      if (format === "summary") {
        // Create a summary version with only essential fields
        formattedResults = sortedResults.map(item => ({
          id: item.id,
          title: item.title,
          date: item.date,
          result: item.result,
          submitter: item.submitter,
          votes: item.votes ? {
            voorAantal: item.votes.voorAantal,
            tegenAantal: item.votes.tegenAantal,
            voorPartijen: item.votes.voor,
            tegenPartijen: item.votes.tegen
          } : undefined,
          url: item.url
        }));
      } else {
        // Use the full data
        formattedResults = sortedResults;
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            total: votingResults.length,
            limit: validatedLimit,
            format,
            results: formattedResults
          }, null, 2)
        }]
      };
    } catch (error: any) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            error: `Error fetching voting results: ${error.message || 'Unknown error'}`,
            url: `${BASE_URL}/stemmingen.html`
          }, null, 2)
        }]
      };
    }
  }
);

/** Search documents by category */
mcp.tool(
  "search_by_category",
  "Performs a search for documents of a certain category, such as questions ('vragen'), motions ('moties'), or all document types ('alles'). The response contains a structured JSON object with paginated results and metadata. The search syntax supports advanced queries: 'Joe Biden' finds documents with both terms anywhere, '\"Joe Biden\"' (with quotes) finds exact phrases, 'Hubert NOT Bruls' finds documents with 'Hubert' but not 'Bruls' (capital NOT is required), and 'OR' for alternatives. Results are sorted by date with the most recent documents first.",
  {
    query: z.string().describe("Search term - any keyword, name, policy area, or quote you want to find in parliamentary records"),
    category: z.enum(["vragen", "moties", "alles"]).describe("Document category: 'vragen' for questions, 'moties' for motions, 'alles' for all document types"),
    page: z.number().optional().describe("Page number for paginated results (default: 1)"),
    limit: z.number().optional().describe("Maximum number of results to return per page (default: 20, max: 100)")
  },
  async ({ query, category, page = 1, limit = 20 }) => {
    try {
      // Validate and cap the limit
      const validatedLimit = Math.min(Math.max(1, limit), 100);
      const validatedPage = Math.max(1, page);

      const data = await apiService.search<{ results: any[], error?: string }>(query, { soorten: category });

      // Check if there's an error message in the response
      if (data.error) {
        return {
          content: [
            { type: "text", text: data.error },
            { type: "text", text: JSON.stringify(data.results || [], null, 2) }
          ]
        };
      }

      // If no results were found
      if (!data.results || data.results.length === 0) {
        return {
          content: [{
            type: "text",
            text: `No results found for query: ${query} with category: ${category}. Try using different keywords or a different category.`
          }]
        };
      }

      // Sort results by date (most recent first)
      const sortedResults = [...data.results].sort((a, b) => {
        // Parse dates from the 'datum' field (format: YYYY-MM-DDT00:00:00)
        const dateA = new Date(a.datum);
        const dateB = new Date(b.datum);
        return dateB.getTime() - dateA.getTime(); // Descending order (newest first)
      });

      // Calculate pagination
      const totalResults = sortedResults.length;
      const totalPages = Math.ceil(totalResults / validatedLimit);
      const startIndex = (validatedPage - 1) * validatedLimit;
      const endIndex = Math.min(startIndex + validatedLimit, totalResults);
      const paginatedResults = sortedResults.slice(startIndex, endIndex);

      // Create pagination info
      const paginationInfo = {
        query,
        category,
        totalResults,
        page: validatedPage,
        limit: validatedLimit,
        totalPages,
        hasNextPage: validatedPage < totalPages,
        hasPreviousPage: validatedPage > 1
      };

      // Create a summary version with only essential fields
      const formattedResults = paginatedResults.map(item => ({
        id: item.id,
        title: item.title,
        category: item.category,
        datum: item.datum,
        url: item.url
      }));

      // Return the paginated results with pagination info
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            pagination: paginationInfo,
            results: formattedResults
          }, null, 2)
        }]
      };
    } catch (error: any) {
      return {
        content: [{
          type: "text",
          text: `Error searching by category: ${error.message || 'Unknown error'}`
        }]
      };
    }
  }
);

/** Get document content */
mcp.tool(
  "get_document_content",
  "Retrieves the content of a parliamentary document (PDF or DOCX). This tool supports three modes of operation depending on parameters provided:\n\n1. TARGETED RETRIEVAL (with offset): Provide docId + offset (+ optional maxLength, default 3000). Returns text centered around the offset position, extracting approximately 1,500 chars before and 1,500 chars after the offset. Finds natural paragraph boundaries for clean extraction.\n\n2. SEQUENTIAL READING (with maxLength, no offset): Provide docId + maxLength (no offset). Returns first maxLength characters from document start. Includes nextOffset for pagination to continue reading.\n\n3. FULL DOCUMENT RETRIEVAL (no offset, no maxLength): Provide docId only. Returns complete document text (may be 100KB+). Note: May use significant context window space.\n\nPARAMETERS:\n- docId: Document ID to retrieve (required)\n- offset (optional): Character position to center extraction around. Can be obtained from find_person_in_document or from the nextOffset value in previous responses.\n- maxLength (optional): Maximum characters to return. Default is 3000 when offset is provided, no limit when offset is not provided.\n\nRESPONSE FORMAT:\n- text: Extracted document content\n- textLength: Length of returned text\n- offset: Starting position in full document\n- nextOffset: Position to continue reading (null if at end)\n- prevOffset: Position to read backwards (null if at start)\n- hasMoreBefore: Boolean indicating more content exists before\n- hasMoreAfter: Boolean indicating more content exists after\n- note: Instructions for retrieving more content",
  {
    docId: z.string().describe("Document ID (e.g., '2024D39058') - the unique identifier for the parliamentary document you want to download and extract text from"),
    offset: z.number().optional().describe("Optional starting position for text extraction. Use this to retrieve content from a specific position in the document. When provided with maxLength, extracts text centered around this position."),
    maxLength: z.number().optional().describe("Maximum number of characters to return. Default: 3000 when offset is provided, no limit when offset is not provided. Set to a higher value if you need more context, but be mindful of context window limits.")
  },
  async ({ docId, offset, maxLength }) => {
    try {
      // First try to get the document page to extract the link
      const html = await apiService.fetchHtml(`/document.html?nummer=${encodeURIComponent(docId)}`);

      // Check if the document exists
      if (html.includes('Found nothing in document.html!!')) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              error: `Document not found: ${docId}`,
              suggestion: "The document ID may be incorrect or the document doesn't exist in the tkconv database. Try a different document ID or use the search tool to find relevant documents.",
              searchUrl: `${BASE_URL}/search.html`
            }, null, 2)
          }]
        };
      }

      // Get document details for metadata
      const details = extractDocumentDetailsFromHtml(html, BASE_URL);

      // Extract the document link
      const documentLink = extractDocumentLink(html);

      if (documentLink === 'NOT_FOUND') {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              error: `Document not found: ${docId}`,
              suggestion: "The document ID may be incorrect or the document doesn't exist in the tkconv database. Try a different document ID or use the search tool to find relevant documents.",
              searchUrl: `${BASE_URL}/search.html`
            }, null, 2)
          }]
        };
      } else if (!documentLink) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              error: `Could not find document link for document ${docId}`,
              suggestion: "The document exists but no download link was found. Try using get_document_details to verify the document ID is correct.",
              documentUrl: `${BASE_URL}/document.html?nummer=${encodeURIComponent(docId)}`
            }, null, 2)
          }]
        };
      }

      // Download the document
      const { data, contentType } = await apiService.fetchBinary(`/${documentLink}`);

      // Extract text based on document type
      let extractedText = '';
      let documentType = '';

      if (contentType.includes('pdf')) {
        // Handle PDF documents using pdf-parse library
        extractedText = await extractTextFromPdf(data);
        documentType = 'PDF';
      } else if (contentType.includes('wordprocessingml.document') || contentType.includes('msword') || documentLink.endsWith('.docx') || documentLink.endsWith('.doc')) {
        // Handle Word documents (DOCX/DOC) using mammoth library
        extractedText = await extractTextFromDocx(data);
        documentType = 'Word';
      } else {
        // Unsupported document type
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              error: `Unsupported document type (content type: ${contentType})`,
              suggestion: "This tool currently only supports PDF and Word (DOCX) documents.",
              documentLink: details?.directLinkPdf || null
            }, null, 2)
          }]
        };
      }

      // Implement smart chunking logic based on parameters
      let chunk: string;
      let actualStart: number;
      let actualEnd: number;
      let hasMoreBefore: boolean;
      let hasMoreAfter: boolean;
      let nextOffset: number | null;
      let prevOffset: number | null;

      if (offset !== undefined) {
        // SCENARIO 1: Targeted retrieval with offset
        const maxLen = maxLength || 3000;
        const halfLength = Math.floor(maxLen / 2);
        
        // Calculate extraction window centered around offset
        const startPos = Math.max(0, offset - halfLength);
        const endPos = Math.min(extractedText.length, offset + halfLength);
        
        // Find natural paragraph boundaries
        actualStart = findParagraphStart(extractedText, startPos);
        actualEnd = findParagraphEnd(extractedText, endPos);
        
        // Extract the chunk
        chunk = extractedText.substring(actualStart, actualEnd);
        
        // Calculate pagination info
        hasMoreBefore = actualStart > 0;
        hasMoreAfter = actualEnd < extractedText.length;
        nextOffset = hasMoreAfter ? actualEnd : null;
        prevOffset = hasMoreBefore ? Math.max(0, actualStart - maxLen) : null;
        
      } else if (maxLength !== undefined) {
        // SCENARIO 2: Controlled reading from start
        const maxLen = maxLength;
        const endPos = Math.min(extractedText.length, maxLen);
        const endBoundary = findParagraphEnd(extractedText, endPos);
        
        chunk = extractedText.substring(0, endBoundary);
        actualStart = 0;
        actualEnd = endBoundary;
        hasMoreBefore = false;
        hasMoreAfter = endBoundary < extractedText.length;
        nextOffset = hasMoreAfter ? endBoundary : null;
        prevOffset = null;
        
      } else {
        // SCENARIO 3: Full document retrieval (original behavior)
        chunk = extractedText;
        actualStart = 0;
        actualEnd = extractedText.length;
        hasMoreBefore = false;
        hasMoreAfter = false;
        nextOffset = null;
        prevOffset = null;
      }

      // Return the document content along with metadata and pagination info
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            docId,
            title: details?.title || "Unknown title",
            type: details?.type || "Unknown type",
            date: details?.datum || "Unknown date",
            documentFormat: documentType,
            
            // Text content
            text: chunk,
            textLength: chunk.length,
            
            // Pagination info
            offset: actualStart,
            nextOffset: nextOffset,
            prevOffset: prevOffset,
            hasMoreBefore: hasMoreBefore,
            hasMoreAfter: hasMoreAfter,
            
            // Usage instructions
            note: hasMoreAfter 
              ? `This is a ${chunk.length}-character excerpt. To read more, call get_document_content({docId: '${docId}', offset: ${actualEnd}, maxLength: ${maxLength || 3000}})`
              : "This is the complete section.",
            
            documentLink: details?.directLinkPdf || null
          }, null, 2)
        }]
      };
    } catch (error: any) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            error: `Error extracting document content: ${error.message || 'Unknown error'}`,
            suggestion: "Try using get_document_details to verify the document exists and is accessible.",
            documentLink: `${BASE_URL}/document.html?nummer=${encodeURIComponent(docId)}`
          }, null, 2)
        }]
      };
    }
  }
);

/** Find person occurrences in document */
mcp.tool(
  "find_person_in_document",
  "Searches for all occurrences of a person's name within a parliamentary document and returns their precise locations. This tool efficiently navigates large documents by identifying where specific persons speak, are mentioned, or are referenced without loading the entire document.\n\nThe tool uses fuzzy matching, so partial names work well:\n- Searching for \"Wilders\" will find \"Geert Wilders\", \"de heer Wilders\", \"Minister Wilders\", etc.\n- Searching for \"Rutte\" will find \"Mark Rutte\", \"Premier Rutte\", \"Minister-president Rutte\", etc.\n- Searching for \"Van der\" will find \"Van der Staaij\", \"Van der Plas\", etc.\n\nThe response includes:\n- Total number of occurrences found\n- For each occurrence:\n  - Line range (e.g., lines 45-47) showing where in the document the name appears\n  - Character offset in the full document text (can be used with get_document_content)\n  - A brief snippet (preview) of the surrounding text to verify context\n\nParticularly valuable for debate transcripts, committee meetings, and lengthy parliamentary documents where multiple people speak.",
  {
    docId: z.string().describe("Document ID (e.g., '2024D39058') - the unique identifier for the parliamentary document you want to search in"),
    personName: z.string().describe("Name or part of a name to search for - can be a first name, last name, or full name. The tool uses fuzzy matching, so partial names work well (e.g., 'Wilders' will find 'Geert Wilders', 'de heer Wilders', etc.)")
  },
  async ({ docId, personName }) => {
    try {
      // First try to get the document page to extract the link
      const html = await apiService.fetchHtml(`/document.html?nummer=${encodeURIComponent(docId)}`);

      // Check if the document exists
      if (html.includes('Found nothing in document.html!!')) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              error: `Document not found: ${docId}`,
              suggestion: "The document ID may be incorrect or the document doesn't exist in the tkconv database. Try a different document ID or use the search tool to find relevant documents.",
              searchUrl: `${BASE_URL}/search.html`
            }, null, 2)
          }]
        };
      }

      // Get document details for metadata
      const details = extractDocumentDetailsFromHtml(html, BASE_URL);

      // Extract the document link
      const documentLink = extractDocumentLink(html);

      if (documentLink === 'NOT_FOUND') {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              error: `Document not found: ${docId}`,
              suggestion: "The document ID may be incorrect or the document doesn't exist in the tkconv database. Try a different document ID or use the search tool to find relevant documents.",
              searchUrl: `${BASE_URL}/search.html`
            }, null, 2)
          }]
        };
      } else if (!documentLink) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              error: `Could not find document link for document ${docId}`,
              suggestion: "The document exists but no download link was found. Try using get_document_details to verify the document ID is correct.",
              documentUrl: `${BASE_URL}/document.html?nummer=${encodeURIComponent(docId)}`
            }, null, 2)
          }]
        };
      }

      // Download the document
      const { data, contentType } = await apiService.fetchBinary(`/${documentLink}`);

      // Extract text based on document type
      let extractedText = '';
      let documentType = '';

      if (contentType.includes('pdf')) {
        // Handle PDF documents using pdf-parse library
        extractedText = await extractTextFromPdf(data);
        documentType = 'PDF';
      } else if (contentType.includes('wordprocessingml.document') || contentType.includes('msword') || documentLink.endsWith('.docx') || documentLink.endsWith('.doc')) {
        // Handle Word documents (DOCX/DOC) using mammoth library
        extractedText = await extractTextFromDocx(data);
        documentType = 'Word';
      } else {
        // Unsupported document type
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              error: `Unsupported document type (content type: ${contentType})`,
              suggestion: "This tool currently only supports PDF and Word (DOCX) documents.",
              documentLink: details?.directLinkPdf || null
            }, null, 2)
          }]
        };
      }

      // Find person occurrences in the extracted text
      const occurrences = findPersonOccurrences(extractedText, personName);

      // Return the results with metadata and usage suggestions
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            docId,
            title: details?.title || "Unknown title",
            type: details?.type || "Unknown type",
            date: details?.datum || "Unknown date",
            documentFormat: documentType,
            searchTerm: personName,
            totalOccurrences: occurrences.length,
            occurrences: occurrences,
            usageInstructions: {
              nextStep: "Use get_document_content with specific character offsets to retrieve relevant sections",
              example: `get_document_content({docId: '${docId}', offset: ${occurrences.length > 0 ? occurrences[0]?.characterOffset ?? 0 : 0}})`,
              note: "Each occurrence includes a characterOffset that you can use with get_document_content to read that specific section"
            },
            documentLink: details?.directLinkPdf || null
          }, null, 2)
        }]
      };
    } catch (error: any) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            error: `Error searching for person in document: ${error.message || 'Unknown error'}`,
            suggestion: "Try using get_document_details to verify the document exists and is accessible.",
            documentLink: `${BASE_URL}/document.html?nummer=${encodeURIComponent(docId)}`
          }, null, 2)
        }]
      };
    }
  }
);

/** Find party occurrences in document */
mcp.tool(
  "find_party_in_document",
  "Searches for all occurrences of a political party within a parliamentary document and returns their precise locations. This tool efficiently navigates large documents by identifying where specific political parties are mentioned, referenced, or their positions are discussed without loading the entire document.\n\nThe tool uses fuzzy matching with party abbreviations:\n- Searching for \"VVD\" will find \"VVD\", \"de VVD\", \"VVD-fractie\", \"VVD-kamerlid\", etc.\n- Searching for \"PVV\" will find \"PVV\", \"de PVV\", \"PVV-fractie\", \"PVV-kamerlid\", etc.\n- Searching for \"CDA\" will find \"CDA\", \"de CDA\", \"CDA-fractie\", \"CDA-kamerlid\", etc.\n- Searching for \"D66\" will find \"D66\", \"de D66\", \"D66-fractie\", \"D66-kamerlid\", etc.\n\nThe response includes:\n- Total number of occurrences found\n- For each occurrence:\n  - Line range (e.g., lines 45-47) showing where in the document the party appears\n  - Character offset in the full document text (can be used with get_document_content)\n  - A brief snippet (preview) of the surrounding text to verify context\n\nParticularly valuable for debate transcripts, committee meetings, and lengthy parliamentary documents where multiple parties' positions are discussed.",
  {
    docId: z.string().describe("Document ID (e.g., '2024D39058') - the unique identifier for the parliamentary document you want to search in"),
    partyName: z.string().describe("Party abbreviation to search for - can be official party abbreviations like 'VVD', 'PVV', 'CDA', 'D66', 'GroenLinks', 'PvdA', 'SP', etc. The tool uses fuzzy matching, so it will find variations like 'de VVD', 'VVD-fractie', etc.")
  },
  async ({ docId, partyName }) => {
    try {
      // First try to get the document page to extract the link
      const html = await apiService.fetchHtml(`/document.html?nummer=${encodeURIComponent(docId)}`);

      // Check if the document exists
      if (html.includes('Found nothing in document.html!!')) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              error: `Document not found: ${docId}`,
              suggestion: "The document ID may be incorrect or the document doesn't exist in the tkconv database. Try a different document ID or use the search tool to find relevant documents.",
              searchUrl: `${BASE_URL}/search.html`
            }, null, 2)
          }]
        };
      }

      // Get document details for metadata
      const details = extractDocumentDetailsFromHtml(html, BASE_URL);

      // Extract the document link
      const documentLink = extractDocumentLink(html);

      if (documentLink === 'NOT_FOUND') {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              error: `Document not found: ${docId}`,
              suggestion: "The document ID may be incorrect or the document doesn't exist in the tkconv database. Try a different document ID or use the search tool to find relevant documents.",
              searchUrl: `${BASE_URL}/search.html`
            }, null, 2)
          }]
        };
      } else if (!documentLink) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              error: `Could not find document link for document ${docId}`,
              suggestion: "The document exists but no download link was found. Try using get_document_details to verify the document ID is correct.",
              documentUrl: `${BASE_URL}/document.html?nummer=${encodeURIComponent(docId)}`
            }, null, 2)
          }]
        };
      }

      // Download the document
      const { data, contentType } = await apiService.fetchBinary(`/${documentLink}`);

      // Extract text based on document type
      let extractedText = '';
      let documentType = '';

      if (contentType.includes('pdf')) {
        // Handle PDF documents using pdf-parse library
        extractedText = await extractTextFromPdf(data);
        documentType = 'PDF';
      } else if (contentType.includes('wordprocessingml.document') || contentType.includes('msword') || documentLink.endsWith('.docx') || documentLink.endsWith('.doc')) {
        // Handle Word documents (DOCX/DOC) using mammoth library
        extractedText = await extractTextFromDocx(data);
        documentType = 'Word';
      } else {
        // Unsupported document type
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              error: `Unsupported document type (content type: ${contentType})`,
              suggestion: "This tool currently only supports PDF and Word (DOCX) documents.",
              documentLink: details?.directLinkPdf || null
            }, null, 2)
          }]
        };
      }

      // Find party occurrences in the extracted text
      const occurrences = findPartyOccurrences(extractedText, partyName);

      // Return the results with metadata and usage suggestions
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            docId,
            title: details?.title || "Unknown title",
            type: details?.type || "Unknown type",
            date: details?.datum || "Unknown date",
            documentFormat: documentType,
            searchTerm: partyName,
            totalOccurrences: occurrences.length,
            occurrences: occurrences,
            usageInstructions: {
              nextStep: "Use get_document_content with specific character offsets to retrieve relevant sections",
              example: `get_document_content({docId: '${docId}', offset: ${occurrences.length > 0 ? occurrences[0]?.characterOffset ?? 0 : 0}})`,
              note: "Each occurrence includes a characterOffset that you can use with get_document_content to read that specific section"
            },
            documentLink: details?.directLinkPdf || null
          }, null, 2)
        }]
      };
    } catch (error: any) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            error: `Error searching for party in document: ${error.message || 'Unknown error'}`,
            suggestion: "Try using get_document_details to verify the document exists and is accessible.",
            documentLink: `${BASE_URL}/document.html?nummer=${encodeURIComponent(docId)}`
          }, null, 2)
        }]
      };
    }
  }
);

/** Analyze document relevance */
mcp.tool(
  "analyze_document_relevance",
  "Performs intelligent pre-analysis of a parliamentary document to determine its relevance WITHOUT loading the full content into your context window. This is a lightweight reconnaissance tool that extracts key information about a document's content before you commit to reading the full text. Use this to efficiently assess whether a document is worth reading in detail, especially when you're uncertain about relevance or need to triage multiple documents.\n\n" +
  "WHAT THIS TOOL RETURNS:\n" +
  "- **Keywords**: Top 10-15 most important terms extracted via TF-IDF analysis, revealing the document's main subjects (e.g., 'klimaat', 'belasting', 'migratie', 'gezondheidszorg')\n" +
  "- **Named Entities**: Structured lists of people mentioned (MPs, ministers, officials), political parties (VVD, PVV, CDA, D66, GroenLinks, etc.), and organizations\n" +
  "- **Statistics**: Document length (character count, word count), estimated reading time, and structural information about the document format\n" +
  "- **Preview**: The first ~500 characters of the document for immediate context\n" +
  "- **Topics**: Main themes and subject areas identified through content analysis\n" +
  "- **Relevance Score** (optional): If you provide the searchTerms parameter, returns a 0-100 score indicating how well the document matches those specific terms, helping you rank multiple documents by relevance\n\n" +
  "WHEN TO USE THIS TOOL:\n" +
  "- When you need to understand what a document is about before reading it in full\n" +
  "- When you have multiple candidate documents and need to determine which ones are most relevant\n" +
  "- When you want to verify a document contains specific topics or entities before loading its full content\n" +
  "- When context window efficiency is important and you want to avoid loading large documents that may not be relevant\n" +
  "- When a user asks about document content but you're uncertain if it matches their query\n" +
  "- When you need to filter or triage search results before committing to detailed reading\n\n" +
  "WHEN NOT TO USE THIS TOOL:\n" +
  "- When the user explicitly requests the full content or specific quotes from a document\n" +
  "- When you already have high confidence the document is relevant and need to read it anyway\n" +
  "- When you specifically need to locate where a person appears in a document (find_person_in_document is optimized for this)\n" +
  "- When you only need structural metadata like title, date, and links\n\n" +
  "RELATIONSHIP TO OTHER DOCUMENT TOOLS:\n" +
  "- **get_document_content**: This analysis tool is lighter weight (~1-2KB) compared to reading full documents (10-50KB). Both tools access document content but serve different purposes: analysis for triage and overview, get_document_content for detailed reading.\n" +
  "- **find_person_in_document**: The analysis tool identifies IF a person is mentioned; find_person_in_document locates WHERE they appear with character offsets. Analysis provides presence information, find_person provides location information.\n" +
  "- **get_document_details**: Details provides structural metadata (title, type, date, links); this tool provides content intelligence (keywords, entities, topics). They offer complementary information about documents.\n" +
  "- **search_tk/search_tk_filtered**: Search identifies candidate documents; this tool provides detailed content analysis of those candidates.\n\n" +
  "CONTEXT WINDOW EFFICIENCY:\n" +
  "This tool returns approximately 1-2KB of analysis data versus 10-50KB for reading full documents. Using this tool before get_document_content can reduce context usage by 80-90% when documents turn out to be irrelevant. It's particularly valuable when evaluating multiple documents or when a user's query is exploratory rather than specific.\n\n" +
  "The searchTerms parameter is powerful for ranking documents by relevance: when provided, it calculates a 0-100 relevance score based on how well the document matches your search terms, allowing you to objectively compare multiple documents before deciding which to read in full.",
  {
    docId: z.string().describe("Document ID (e.g., '2024D39058') - the unique identifier for the parliamentary document you want to analyze"),
    searchTerms: z.array(z.string()).optional().describe("Optional: Array of terms or phrases to check relevance against (e.g., ['climate', 'energy', 'klimaat']). When provided, the tool calculates a relevance score (0-100) indicating how well the document matches these terms. Useful for comparing and ranking multiple documents.")
  },
  async ({ docId, searchTerms }) => {
    try {
      // First try to get the document page to extract the link
      const html = await apiService.fetchHtml(`/document.html?nummer=${encodeURIComponent(docId)}`);

      // Check if the document exists
      if (html.includes('Found nothing in document.html!!')) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              error: `Document not found: ${docId}`,
              suggestion: "The document ID may be incorrect or the document doesn't exist in the tkconv database. Try a different document ID or use the search tool to find relevant documents.",
              searchUrl: `${BASE_URL}/search.html`
            }, null, 2)
          }]
        };
      }

      // Get document details for metadata
      const details = extractDocumentDetailsFromHtml(html, BASE_URL);

      // Extract the document link
      const documentLink = extractDocumentLink(html);

      if (documentLink === 'NOT_FOUND') {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              error: `Document not found: ${docId}`,
              suggestion: "The document ID may be incorrect or the document doesn't exist in the tkconv database. Try a different document ID or use the search tool to find relevant documents.",
              searchUrl: `${BASE_URL}/search.html`
            }, null, 2)
          }]
        };
      } else if (!documentLink) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              error: `Could not find document link for document ${docId}`,
              suggestion: "The document exists but no download link was found. Try using get_document_details to verify the document ID is correct.",
              documentUrl: `${BASE_URL}/document.html?nummer=${encodeURIComponent(docId)}`
            }, null, 2)
          }]
        };
      }

      // Download the document
      const { data, contentType } = await apiService.fetchBinary(`/${documentLink}`);

      // Extract text based on document type
      let extractedText = '';
      let documentType = '';

      if (contentType.includes('pdf')) {
        // Handle PDF documents using pdf-parse library
        extractedText = await extractTextFromPdf(data);
        documentType = 'PDF';
      } else if (contentType.includes('wordprocessingml.document') || contentType.includes('msword') || documentLink.endsWith('.docx') || documentLink.endsWith('.doc')) {
        // Handle Word documents (DOCX/DOC) using mammoth library
        extractedText = await extractTextFromDocx(data);
        documentType = 'Word';
      } else {
        // Unsupported document type
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              error: `Unsupported document type (content type: ${contentType})`,
              suggestion: "This tool currently only supports PDF and Word (DOCX) documents.",
              documentLink: details?.directLinkPdf || null
            }, null, 2)
          }]
        };
      }

      // Analyze the document content
      const analysis = await analyzeDocumentContent(extractedText, searchTerms);

      // Return the analysis results with metadata
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            docId,
            title: details?.title || "Unknown title",
            type: details?.type || "Unknown type",
            date: details?.datum || "Unknown date",
            documentFormat: documentType,
            
            // Analysis results
            keywords: analysis.keywords,
            entities: analysis.entities,
            statistics: analysis.statistics,
            topics: analysis.topics,
            relevanceScore: analysis.relevanceScore,
            preview: analysis.preview,
            
            // Usage instructions
            nextSteps: analysis.relevanceScore && analysis.relevanceScore > 60
              ? "This document appears highly relevant. Consider using get_document_content or find_person_in_document to read specific sections."
              : analysis.relevanceScore && analysis.relevanceScore > 30
              ? "This document has moderate relevance. Review the keywords and entities to decide if it's worth reading in detail."
              : searchTerms && searchTerms.length > 0
              ? "This document has low relevance to your search terms. Consider analyzing other documents first."
              : "Review the keywords, entities, and topics to determine if this document is relevant to your needs.",
            
            documentLink: details?.directLinkPdf || null
          }, null, 2)
        }]
      };
    } catch (error: any) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            error: `Error analyzing document: ${error.message || 'Unknown error'}`,
            suggestion: "Try using get_document_details to verify the document exists and is accessible.",
            documentLink: `${BASE_URL}/document.html?nummer=${encodeURIComponent(docId)}`
          }, null, 2)
        }]
      };
    }
  }
);

// ———————————————————————————————————————————————
// Boot up the MCP server
async function main() {
  console.error("Starting OpenTK MCP server (v1.0.17)…");
  await mcp.connect(new StdioServerTransport());
}
main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
