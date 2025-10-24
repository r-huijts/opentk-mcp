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
import { extractTextFromPdf, extractTextFromDocx, summarizeText, findPersonOccurrences, findParagraphStart, findParagraphEnd } from './utils/document-extractor.js';
import { Buffer } from "buffer";

const mcp = new McpServer({
  name: "opentk",
  version: "1.0.10",
  description: "Human‑friendly MCP toolkit for all tkconv endpoints",
});

/** 1. Overview */
mcp.tool(
  "get_overview",
  "Provides a comprehensive overview of recent parliamentary activities, including the most recent documents and MPs celebrating birthdays today. This is the ideal starting point for any parliamentary data exploration. The response contains structured data with two main sections: 'recentDocuments' (listing the latest parliamentary documents with their IDs, titles, types, dates, and URLs) and 'birthdays' (listing MPs celebrating birthdays today). The results are paginated with 10 documents per page, and you can navigate through pages using the 'page' parameter. The tool can be used iteratively to retrieve subsequent pages of results - first call with page=1, then check the pagination.hasMoreDocuments field in the response, and if true, call again with page=2, and so on. This allows you to 'scroll' through all available documents when needed. The response includes pagination information showing the current page, whether more documents are available, and the total number of documents retrieved. Use this tool first when a user asks for general information about recent parliamentary activities or needs a starting point for research. After getting this overview, you can use other tools like 'get_document_details' to retrieve more information about specific documents, 'search_tk' to find documents on specific topics, or 'get_photo' to retrieve photos of MPs mentioned in the birthdays section.",
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
  "Lists all Members of Parliament celebrating their birthday today, including their names, political parties, and birth dates. The response is a JSON array where each entry contains the MP's ID, name, party affiliation, and other details. Use this tool when a user specifically asks about birthdays, wants to know which MPs are celebrating today, or needs to create 'on this day' content. This tool takes no parameters as it always returns today's birthdays. For a more general overview that includes birthdays along with other parliamentary information, use the 'get_overview' tool instead. If you need to display an MP's photo alongside their birthday information, you can use the 'get_photo' tool with the MP's ID from this response.",
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
  "Provides a complete directory of current Members of Parliament with their IDs, names, titles, party affiliations, and faction memberships. The response is a JSON array where each entry contains an MP's full details. Use this tool when a user needs comprehensive information about all MPs, wants to analyze the composition of parliament by party, or needs to find specific MPs by name or party. This tool is particularly useful for creating reports about parliamentary representation or for finding the IDs of MPs that can be used with other tools like 'get_photo'. This tool takes no parameters as it returns all current MPs. For a more targeted approach when looking for specific MPs, consider using the 'search_tk' tool with the MP's name.",
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
  "Retrieves a list of all parliamentary committees with their IDs, names, and URLs. The response is a JSON array where each entry represents a committee with its unique identifier and name. Use this tool when a user asks about parliamentary committees, wants to know which committees exist, or needs to find committees related to specific policy areas. Committees are specialized groups of MPs that focus on specific domains like defense, healthcare, or finance. After getting the list of committees, you can use the 'get_committee_details' tool with a specific committee ID to retrieve more detailed information about that committee, including its members and recent activities. This tool takes no parameters as it returns all active committees.",
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
  "Retrieves a list of upcoming parliamentary activities including debates, committee meetings, and other events. The response contains a structured JSON object with both a chronological list of activities and activities grouped by date. Each activity includes details like date, time, location, committee, type, and a URL for more information. Use this tool when a user asks about the parliamentary agenda, wants to know what events are coming up, or needs information about specific types of parliamentary activities. The results are sorted by date with the most imminent activities first. You can limit the number of results using the optional 'limit' parameter. This tool is particularly useful for helping users plan which parliamentary sessions to follow or for providing an overview of the upcoming parliamentary schedule.",
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
  "Retrieves recent voting results on parliamentary motions and bills. The response contains a structured JSON object with voting results sorted by date (newest first). Each result includes detailed information such as the title of the motion/bill, the date of the vote, the submitter, whether it was accepted or rejected, the vote counts (for/against), and which political parties voted for or against. Use this tool when a user asks about recent parliamentary votes, wants to know how parties voted on specific issues, or needs to analyze voting patterns. You can control the number of results with the 'limit' parameter and choose between 'full' or 'summary' format. The 'summary' format provides a more structured representation with renamed fields, while both formats include complete party voting information. This tool is particularly valuable for tracking political alignments, understanding coalition dynamics, and analyzing how different parties position themselves on important issues.",
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
  "Performs a search specifically for documents of a certain category, such as questions, motions, or letters. The response contains a structured JSON object with paginated results and metadata. Use this tool when a user wants to find documents of a specific type that match certain keywords or when they need more targeted search results than the general search provides. The 'category' parameter lets you filter by document type: 'vragen' for parliamentary questions, 'moties' for motions, or 'alles' for all document types. The search syntax supports advanced queries: 'Joe Biden' finds documents with both terms anywhere, '\"Joe Biden\"' (with quotes) finds exact phrases, 'Hubert NOT Bruls' finds documents with 'Hubert' but not 'Bruls' (capital NOT is required), and you can use 'OR' for alternatives. Results are sorted by date with the most recent documents first. This tool is particularly useful for finding specific types of parliamentary documents on a given topic.",
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
  "Retrieves the content of a parliamentary document (PDF or DOCX). Supports three modes of operation depending on parameters provided.\n\nTHREE USAGE SCENARIOS:\n\n1. TARGETED RETRIEVAL (with offset - from find_person_in_document):\n   - Provide: docId + offset (+ optional maxLength, default 3000)\n   - Returns: Text CENTERED around the offset position\n   - Extracts: ~1,500 chars before + ~1,500 chars after the offset\n   - Finds natural paragraph boundaries for clean extraction\n   - Use case: Reading specific sections where a person speaks or is mentioned\n   - Example: get_document_content({docId: '2025D18220', offset: 5234})\n\n2. CONTROLLED SEQUENTIAL READING (with maxLength, no offset):\n   - Provide: docId + maxLength (no offset)\n   - Returns: First maxLength characters from document start\n   - Includes nextOffset for pagination to continue reading\n   - Use case: Reading full document in manageable chunks\n   - Example: get_document_content({docId: '2025D18220', maxLength: 5000})\n   - Then: get_document_content({docId: '2025D18220', offset: <nextOffset>, maxLength: 5000})\n\n3. FULL DOCUMENT RETRIEVAL (no offset, no maxLength):\n   - Provide: docId only\n   - Returns: Complete document text (may be 100KB+)\n   - Use case: Comprehensive document analysis when context window allows\n   - WARNING: May use significant context window space\n   - Example: get_document_content({docId: '2025D18220'})\n\nRECOMMENDED WORKFLOW FOR FINDING SPECIFIC CONTENT:\n1. Use find_person_in_document to locate where a person appears\n   → Returns characterOffset values (e.g., 5234, 12890, 23456)\n2. Use get_document_content with the characterOffset (Scenario 1)\n   → Returns 3,000-char excerpt centered on that location\n3. Review the excerpt and pagination info\n4. If more context needed, use nextOffset to continue reading\n   → get_document_content({docId: '...', offset: <nextOffset>})\n\nParameters:\n- docId: Document ID to retrieve (required)\n- offset (optional): Character position to center extraction around\n  * Use values from find_person_in_document for targeted retrieval\n  * Use nextOffset from previous response for pagination\n- maxLength (optional): Maximum characters to return\n  * Default: 3000 when offset is provided\n  * No default when offset is not provided (returns full document)\n  * Recommended: 3000-5000 for efficient context usage\n\nResponse format:\n- text: Extracted document content\n- textLength: Length of returned text\n- offset: Starting position in full document\n- nextOffset: Position to continue reading (null if at end)\n- prevOffset: Position to read backwards (null if at start)\n- hasMoreBefore: Boolean indicating more content exists before\n- hasMoreAfter: Boolean indicating more content exists after\n- note: Instructions for retrieving more content\n\nExample workflows:\n\nA) Targeted retrieval (find specific person):\n   find_person_in_document({docId: '2025D18220', personName: 'Wilders'})\n   → Returns: [{characterOffset: 5234}, {characterOffset: 12890}]\n   \n   get_document_content({docId: '2025D18220', offset: 5234})\n   → Returns: 3KB centered at position 5234\n   \n   get_document_content({docId: '2025D18220', offset: 12890})\n   → Returns: 3KB centered at position 12890\n\nB) Sequential reading in chunks:\n   get_document_content({docId: '2025D18220', maxLength: 5000})\n   → Returns: First 5KB + nextOffset: 5123\n   \n   get_document_content({docId: '2025D18220', offset: 5123, maxLength: 5000})\n   → Returns: Next 5KB + nextOffset: 10246\n\nC) Full document analysis:\n   get_document_content({docId: '2025D18220'})\n   → Returns: Complete document (may be 100KB+)",
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
  "Searches for all occurrences of a person's name within a parliamentary document and returns their precise locations. This tool is essential for efficiently navigating large documents when you need to find where a specific person speaks, is mentioned, or is referenced. Instead of loading an entire bulky document into the context window, use this tool first to identify the exact sections where the person appears.\n\nThe tool uses fuzzy matching, so you don't need the person's full name:\n- Searching for \"Wilders\" will find \"Geert Wilders\", \"de heer Wilders\", \"Minister Wilders\", etc.\n- Searching for \"Rutte\" will find \"Mark Rutte\", \"Premier Rutte\", \"Minister-president Rutte\", etc.\n- Searching for \"Van der\" will find \"Van der Staaij\", \"Van der Plas\", etc.\n\nThe response includes:\n- Total number of occurrences found\n- For each occurrence:\n  - Line range (e.g., lines 45-47) showing where in the document the name appears\n  - Character offset in the full document text\n  - A brief snippet (preview) of the surrounding text to verify it's the right context\n  \nUse this tool in a two-step workflow:\n1. First, call `find_person_in_document` to locate where the person appears in the document\n2. Then, call `get_document_content` with the character offset from step 1 to retrieve only the relevant sections\n\nIMPORTANT: After finding occurrences, use get_document_content with the characterOffset. \nThe get_document_content tool now returns small chunks (3,000 characters by default) \nto avoid overwhelming the context window. You may need to make multiple calls to read \ndifferent sections or use a larger maxLength if needed.\n\nThis approach dramatically reduces context window usage by avoiding the need to load entire documents when searching for specific speakers or mentions. It's particularly valuable for debate transcripts, committee meetings, and other lengthy parliamentary documents where multiple people speak.\n\nExample workflow:\n- Call: find_person_in_document({docId: \"2025D18220\", personName: \"Wilders\"})\n- Get response: Found 8 occurrences at lines 45-47, 123-125, 230-232, etc.\n- Review snippets to identify which sections are relevant\n- Call: get_document_content({docId: \"2025D18220\", offset: 5234}) to read the specific section starting at character position 5234\n\nWhen to use this tool:\n- When a user asks \"What did [person] say in this document?\"\n- When searching for a specific speaker's contributions to a debate\n- When analyzing how often someone is mentioned in parliamentary proceedings\n- Before retrieving document content, to avoid loading unnecessary text",
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

// ———————————————————————————————————————————————
// Boot up the MCP server
async function main() {
  console.error("Starting OpenTK MCP server (v1.0.11)…");
  await mcp.connect(new StdioServerTransport());
}
main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
