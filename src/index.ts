import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { apiService } from "./services/api.js";
import { extractDocumentLink } from "./utils/html-parser.js";
import { BASE_URL } from './config.js';
import { extractDocumentDetailsFromHtml } from './utils/html-parser.js';
import { Buffer } from "buffer";

const mcp = new McpServer({
  name: "opentk",
  version: "1.0.6",
  description: "Human‑friendly MCP toolkit for all tkconv endpoints",
});

/** 4. Birthdays today */
mcp.tool(
  "birthdays_today",
  "Lists all Members of Parliament celebrating their birthday today, including their names, political parties, and birth dates. Perfect for creating 'on this day' features, sending congratulations, or adding a personal touch to parliamentary interactions. This tool takes no parameters as it always returns today's birthdays.",
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
  "Provides a complete directory of current Members of Parliament with their IDs, names, titles, party affiliations, and faction memberships. Ideal for building lookup tables, creating contact lists, or getting an overview of the current parliament composition. This tool takes no parameters as it returns all current MPs.",
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
  "Performs a targeted search within a specific category of parliamentary data. Unlike the general search, this tool allows you to limit results to only documents, activities, or cases. Use this when you need more focused search results within a particular content type. Search syntax: Searching for 'Joe Biden' finds documents containing both 'Joe' and 'Biden' anywhere in the text. Searching for \"Joe Biden\" (with quotes) finds only documents where these words appear next to each other. Searching for 'Hubert NOT Bruls' finds documents containing 'Hubert' but not 'Bruls'. The capital letters in 'NOT' are important. You can also use 'OR' and 'NEAR()' operators.",
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
  "Retrieves metadata about a parliamentary document in a structured JSON format, without downloading the actual document content. Returns information including title, type, document number, dates, version number, and clickable links to both the PDF version and the official Tweede Kamer webpage. This tool is ideal for getting quick information about a document and obtaining the relevant links for further access. To actually download the document content, use the 'download_document' tool instead.",
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
  "Converts document URLs into clickable links. This tool takes either a direct PDF link or a Tweede Kamer webpage link and returns them as properly formatted clickable links. Use this after get_document_details to make the URLs clickable.",
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

// ———————————————————————————————————————————————
// Boot up the MCP server
async function main() {
  console.error("Starting OpenTK MCP server (v1.0.6)…");
  await mcp.connect(new StdioServerTransport());
}
main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
