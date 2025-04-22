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
import { extractTextFromPdf, summarizeText } from './utils/pdf-extractor.js';
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

/** Get committees */
mcp.tool(
  "get_committees",
  "Retrieves a list of all parliamentary committees with their IDs, names, and URLs. Committees are specialized groups of MPs that focus on specific policy areas like defense, healthcare, or finance. Use this tool to get an overview of all active committees in the Dutch Parliament.",
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
  "Retrieves a list of upcoming parliamentary activities including debates, committee meetings, and other events. Each activity includes details like date, time, location, committee, and type. This tool is ideal for tracking the parliamentary agenda and identifying opportunities to follow specific discussions or decisions.",
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
  "Retrieves recent voting results on parliamentary motions and bills. Each result includes the title of the motion/bill, the date of the vote, and whether it was accepted or rejected. This tool is valuable for tracking the outcome of parliamentary decisions and understanding which proposals have been approved or rejected.",
  {
    limit: z.number().optional().describe("Maximum number of voting results to return (default: 20, max: 100)")
  },
  async ({ limit = 20 }) => {
    try {
      // Validate and cap the limit
      const validatedLimit = Math.min(Math.max(1, limit), 100);

      const html = await apiService.fetchHtml("/stemmingen.html");
      const votingResults = extractVotingResultsFromHtml(html, BASE_URL);

      if (votingResults.length === 0) {
        return {
          content: [{
            type: "text",
            text: "No voting results found or there was an error retrieving the voting results list. Please try again later."
          }]
        };
      }

      // Sort voting results by date (most recent first) and limit the results
      const sortedResults = [...votingResults].sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return dateB.getTime() - dateA.getTime(); // Descending order (newest first)
      }).slice(0, validatedLimit);

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            total: votingResults.length,
            limit: validatedLimit,
            results: sortedResults
          }, null, 2)
        }]
      };
    } catch (error: any) {
      return {
        content: [{
          type: "text",
          text: `Error fetching voting results: ${error.message || 'Unknown error'}`
        }]
      };
    }
  }
);

/** Search documents by category */
mcp.tool(
  "search_by_category",
  "Performs a search specifically for documents of a certain category, such as questions, motions, or letters. This allows for more targeted searches when you're looking for a specific type of parliamentary document. The search syntax is the same as the general search: 'Joe Biden' finds documents with both terms anywhere, '\"Joe Biden\"' finds exact phrases, and 'Hubert NOT Bruls' finds documents with the first term but not the second.",
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
  "Downloads a parliamentary document and extracts its text content for use in the conversation. This tool retrieves the actual content of a document based on its ID, making it available for analysis, summarization, or direct reference in the conversation. The text is extracted from the PDF and returned in a readable format. Use this when you need to analyze or discuss the specific content of a document rather than just its metadata.",
  {
    docId: z.string().describe("Document ID (e.g., '2024D39058') - the unique identifier for the parliamentary document you want to download and extract text from")
  },
  async ({ docId }) => {
    try {
      // First try to get the document page to extract the link
      const html = await apiService.fetchHtml(`/document.html?nummer=${encodeURIComponent(docId)}`);

      // Get document details for metadata
      const details = extractDocumentDetailsFromHtml(html, BASE_URL);

      // Extract the document link
      const documentLink = extractDocumentLink(html);

      if (!documentLink) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              error: `Could not find document link for document ${docId}`,
              suggestion: "Try using get_document_details to verify the document ID is correct."
            }, null, 2)
          }]
        };
      }

      // Download the document
      const { data, contentType } = await apiService.fetchBinary(`/${documentLink}`);

      // Check if it's a PDF
      if (!contentType.includes('pdf')) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              error: `Document is not a PDF (content type: ${contentType})`,
              suggestion: "This tool currently only supports PDF documents."
            }, null, 2)
          }]
        };
      }

      // Extract text from the PDF
      const extractedText = await extractTextFromPdf(data);

      // Summarize the text if it's too long
      const summarizedText = summarizeText(extractedText);

      // Return the document content along with metadata
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            docId,
            title: details?.title || "Unknown title",
            type: details?.type || "Unknown type",
            date: details?.datum || "Unknown date",
            content: summarizedText,
            note: summarizedText.length < extractedText.length ?
              "The document content has been truncated due to length. Use the PDF link to view the full document." :
              "Full document content extracted successfully.",
            pdfLink: details?.directLinkPdf || null
          }, null, 2)
        }]
      };
    } catch (error: any) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            error: `Error extracting document content: ${error.message || 'Unknown error'}`,
            suggestion: "Try using get_document_details to verify the document exists and is accessible."
          }, null, 2)
        }]
      };
    }
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
