import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { apiService } from "./services/api.js";
import { odataService } from "./services/odata.js";
import { extractDocumentLink } from "./utils/html-parser.js";

// Import Buffer for base64 encoding
import { Buffer } from "buffer";

const mcp = new McpServer({
  name: "opentk",
  version: "1.0.6",
  description: "Human‑friendly MCP toolkit for all tkconv endpoints",
});

/** 1. Full activity info */
mcp.tool(
  "get_activity",
  "Provides comprehensive details about a parliamentary activity including its date, title, type, participants, agenda items, attached documents, and any debate video links. Use this when you need complete information about a specific parliamentary session, debate, or committee meeting. The activity ID can be found in search results or other parliamentary references.",
  { id: z.string().describe("Activity ID in format like 2025A02517. This is a unique identifier for a parliamentary activity such as a debate, committee meeting, or voting session.") },
  async ({ id }) => {
    try {
      const data = await apiService.fetchJson(`/activiteit/${encodeURIComponent(id)}`);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    } catch (error: any) {
      return {
        content: [{
          type: "text",
          text: `Error fetching activity: ${error.message || 'Unknown error'}`
        }]
      };
    }
  }
);

/** 2. Debate video link */
mcp.tool(
  "get_activity_video",
  "Retrieves just the video URL for a parliamentary activity, allowing direct access to debate recordings without loading all activity details. Useful when you only need to watch or share the video of a parliamentary session. Returns an empty string if no video is available.",
  { id: z.string().describe("Activity ID in format like 2025A02517. This identifies the parliamentary session or debate for which you want the video link.") },
  async ({ id }) => {
    try {
      const data = await apiService.fetchJson<{ videourl?: string }>(`/activiteit/${encodeURIComponent(id)}`);
      return { content: [{ type: "text", text: data.videourl || "" }] };
    } catch (error: any) {
      return {
        content: [{
          type: "text",
          text: `Error fetching activity video: ${error.message || 'Unknown error'}`
        }]
      };
    }
  }
);

/** 3. Committee overview */
mcp.tool(
  "get_committee",
  "Provides detailed information about a parliamentary committee, including its name, abbreviation, current members with their roles, recent cases handled by the committee, and upcoming meetings. Use this when researching specific committees, their composition, or their recent work.",
  { id: z.string().describe("Committee ID - a unique identifier for a parliamentary committee such as the Finance Committee, Foreign Affairs Committee, etc.") },
  async ({ id }) => {
    try {
      const data = await apiService.fetchJson(`/commissie/${encodeURIComponent(id)}`);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    } catch (error: any) {
      return {
        content: [{
          type: "text",
          text: `Error fetching committee: ${error.message || 'Unknown error'}`
        }]
      };
    }
  }
);

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
      // Use the official OData API instead of the tkconv endpoint
      const persons = await odataService.getPersons();

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
  { query: z.string().describe("Search keyword or phrase - can be any term, name, policy area, or exact quote you want to find in parliamentary records. Use quotes for exact phrases, 'NOT' to exclude terms, 'OR' for alternatives, and 'NEAR()' for proximity searches.") },
  async ({ query }) => {
    try {
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

      // Return the sorted results
      return { content: [{ type: "text", text: JSON.stringify(sortedResults, null, 2) }] };
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
  },
  async ({ query, type }) => {
    try {
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

      // Return the sorted and filtered results
      return { content: [{ type: "text", text: JSON.stringify(sortedResults, null, 2) }] };
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

/** 8. Download document file */
mcp.tool(
  "download_document",
  "Downloads the actual file content of a parliamentary document (usually PDF). This tool retrieves the binary content of official documents like reports, letters, motions, or bills. Use this when you need to access the full text of a document rather than just its metadata.",
  { docId: z.string().describe("Document number, e.g. 2025D18037 - this is the unique identifier for a parliamentary document that you want to download") },
  async ({ docId }) => {
    try {
      // First try the direct download path
      try {
        const { data, contentType } = await apiService.fetchBinary(`/get/${encodeURIComponent(docId)}`);
        const base64 = Buffer.from(data).toString("base64");
        return {
          content: [
            {
              type: "resource",
              resource: {
                uri: `document://${docId}`,
                blob: base64,
                mimeType: contentType.includes('pdf') ? 'application/pdf' : contentType
              }
            }
          ]
        };
      } catch (directError: any) {
        console.log(`Direct download failed, trying document page: ${directError.message || 'Unknown error'}`);

        // If direct download fails, try to get the document page and extract the link
        const html = await apiService.fetchHtml(`/document.html?nummer=${encodeURIComponent(docId)}`);
        const documentLink = extractDocumentLink(html);

        if (documentLink) {
          // Found a link to the document, now fetch it
          const { data, contentType } = await apiService.fetchBinary(`/${documentLink}`);
          const base64 = Buffer.from(data).toString("base64");
          return {
            content: [
              {
                type: "resource",
                resource: {
                  uri: `document://${docId}`,
                  blob: base64,
                  mimeType: contentType.includes('pdf') ? 'application/pdf' : contentType
                }
              }
            ]
          };
        } else {
          // No document link found in the HTML
          throw new Error(`Could not find document link in the document page`);
        }
      }
    } catch (error: any) {
      return {
        content: [{
          type: "text",
          text: `Error downloading document: ${error.message || 'Unknown error'}`
        }]
      };
    }
  }
);

/** 9. MP portrait */
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

/** 10. Yearly URL overview */
mcp.tool(
  "get_sitemap_year",
  "Provides a comprehensive list of all parliamentary content URLs published during a specific year. This tool returns a sitemap of links to documents, activities, and cases, organized chronologically. Useful for archival research, data mining, or creating year-in-review summaries of parliamentary activities.",
  { year: z.string().regex(/^\d{4}$/).describe("Four‑digit year, e.g. 2025 - the calendar year for which you want to retrieve the parliamentary content sitemap") },
  async ({ year }) => {
    try {
      const urls = await apiService.fetchSitemap(`sitemap-${year}.txt`);
      return { content: [{ type: "text", text: JSON.stringify(urls, null, 2) }] };
    } catch (error: any) {
      return {
        content: [{
          type: "text",
          text: `Error fetching yearly sitemap: ${error.message || 'Unknown error'}`
        }]
      };
    }
  }
);

/** 11. Half‑year URL overview */
mcp.tool(
  "get_sitemap_half_year",
  "Provides a list of all parliamentary content URLs published during a specific half-year period. Similar to the yearly sitemap but with a more focused timeframe, allowing for more manageable data sets. Useful for seasonal analysis or when the full year's data would be too large to process efficiently.",
  {
    year: z.string().regex(/^\d{4}$/).describe("Year - the calendar year for the half-year period you're interested in"),
    half: z.union([z.literal("1"), z.literal("2")]).describe("1 = Jan–Jun (first half of year), 2 = Jul–Dec (second half of year)"),
  },
  async ({ year, half }) => {
    try {
      const urls = await apiService.fetchSitemap(`sitemap-${year}-H${half}.txt`);
      return { content: [{ type: "text", text: JSON.stringify(urls, null, 2) }] };
    } catch (error: any) {
      return {
        content: [{
          type: "text",
          text: `Error fetching half-year sitemap: ${error.message || 'Unknown error'}`
        }]
      };
    }
  }
);

/** 12. Monthly URL overview */
mcp.tool(
  "get_sitemap_month",
  "Provides a list of all parliamentary content URLs published during a specific month. This is the most granular time-based sitemap available, offering a focused view of parliamentary activity within a single month. Ideal for monthly reports, tracking recent developments, or analyzing parliamentary productivity across different months.",
  {
    ym: z
      .string()
      .regex(/^\d{4}-\d{2}$/)
      .describe("Year‑month in format 'YYYY-MM', e.g. '2025-04' for April 2025. This specifies the exact month for which you want the parliamentary content sitemap."),
  },
  async ({ ym }) => {
    try {
      const urls = await apiService.fetchSitemap(`sitemap-${ym}.txt`);
      return { content: [{ type: "text", text: JSON.stringify(urls, null, 2) }] };
    } catch (error: any) {
      return {
        content: [{
          type: "text",
          text: `Error fetching monthly sitemap: ${error.message || 'Unknown error'}`
        }]
      };
    }
  }
);

/** 13. Resolve external reference */
mcp.tool(
  "resolve_external",
  "Converts official parliamentary reference IDs into direct URLs that can be accessed in a browser. This tool helps translate formal document references found in official texts into actual web links. Useful when working with citations, references in parliamentary documents, or when you need to provide direct access to a specific resource.",
  { extid: z.string().describe("Official external ID - a formal reference code used in parliamentary documents, such as dossier numbers, document IDs, or activity references") },
  async ({ extid }) => {
    try {
      const url = await apiService.resolveExternal(extid);
      return { content: [{ type: "text", text: url }] };
    } catch (error: any) {
      return {
        content: [{
          type: "text",
          text: `Error resolving external reference: ${error.message || 'Unknown error'}`
        }]
      };
    }
  }
);

/** 14. MP profile page */
mcp.tool(
  "get_member_details",
  "Retrieves the complete profile page for a specific Member of Parliament, including their biographical information, party affiliation, committee memberships, voting history, and recent activities. This provides a comprehensive overview of an MP's parliamentary work and background in HTML format. Use this when you need detailed information about a specific parliamentarian.",
  { nummer: z.string().describe("MP's numeric ID - the unique identifier for the Member of Parliament whose profile you want to retrieve") },
  async ({ nummer }) => {
    try {
      const text = await apiService.fetchHtml(`/persoon.html?nummer=${encodeURIComponent(nummer)}`);
      return { content: [{ type: "text", text }] };
    } catch (error: any) {
      return {
        content: [{
          type: "text",
          text: `Error fetching MP details: ${error.message || 'Unknown error'}`
        }]
      };
    }
  }
);

/** 15. Pledge (toezegging) page */
mcp.tool(
  "get_toezegging",
  "Retrieves detailed information about a specific pledge ('toezegging') made by a government official during parliamentary proceedings. These are formal commitments made by ministers or state secretaries to take certain actions or provide information. This tool returns the pledge details in HTML format, including who made it, when, to whom, and the current status.",
  { nummer: z.string().describe("Pledge number - the unique identifier for the governmental pledge or commitment you want information about") },
  async ({ nummer }) => {
    try {
      const text = await apiService.fetchHtml(`/toezegging.html?nummer=${encodeURIComponent(nummer)}`);
      return { content: [{ type: "text", text }] };
    } catch (error: any) {
      return {
        content: [{
          type: "text",
          text: `Error fetching pledge details: ${error.message || 'Unknown error'}`
        }]
      };
    }
  }
);

/** 16. Case (zaak) page */
mcp.tool(
  "get_case",
  "Retrieves comprehensive information about a parliamentary case ('zaak'), which could be a legislative proposal, motion, amendment, or other formal parliamentary procedure. Returns the case details in HTML format, including its status, related documents, voting results, and procedural history. Use this when you need to understand the complete lifecycle of a parliamentary initiative.",
  { nummer: z.string().describe("Case number - the unique identifier for the parliamentary case, motion, or legislative proposal you want information about") },
  async ({ nummer }) => {
    try {
      const text = await apiService.fetchHtml(`/zaak.html?nummer=${encodeURIComponent(nummer)}`);
      return { content: [{ type: "text", text }] };
    } catch (error: any) {
      return {
        content: [{
          type: "text",
          text: `Error fetching case details: ${error.message || 'Unknown error'}`
        }]
      };
    }
  }
);

/** 17. Document overview */
mcp.tool(
  "get_document_metadata",
  "Retrieves detailed metadata about a parliamentary document without downloading the actual file content. Returns information such as the document title, type, date, authors, related cases, and procedural context. Use this when you need to understand what a document is about before deciding to download it, or when you only need the contextual information rather than the full content.",
  { docId: z.string().describe("Document number, e.g. 2025D18037 - the unique identifier for the parliamentary document whose metadata you want to retrieve") },
  async ({ docId }) => {
    try {
      const data = await apiService.fetchJson(`/document.html?nummer=${encodeURIComponent(docId)}`, {
        headers: { Accept: "application/json" }
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    } catch (error: any) {
      return {
        content: [{
          type: "text",
          text: `Error fetching document metadata: ${error.message || 'Unknown error'}`
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
