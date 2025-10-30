# OpenTK Model Context Protocol Server

> **Important Attribution**: This MCP server is built as a wrapper around the excellent [OpenTK project](https://berthub.eu/tkconv/) created by [Bert Hubert](https://berthub.eu/). The OpenTK project provides unprecedented access to Dutch parliamentary data through a user-friendly interface. Learn more about the project in Bert's article: [Welkom bij OpenTK](https://berthub.eu/articles/posts/welkom-bij-opentk/). All credit for the underlying data access and processing goes to Bert Hubert and his contributions to open government data.

A bridge between large language models (LLMs) and Dutch parliamentary data through a standardized interface. This MCP server provides access to Dutch parliamentary documents, debates, and member information from the Tweede Kamer.

<a href="https://glama.ai/mcp/servers/@r-huijts/opentk-mcp">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/@r-huijts/opentk-mcp/badge" alt="OpenTK Model Context Protocol Server MCP server" />
</a>

## Real-World Natural Language Interaction Examples

## Example 1: Comparing Party Positions on AI Policies
User Query: "When comparing the activities of opposition parties PvdA, GroenLinks, and Volt with government party BBB in the Dutch House of Representatives in the field of AI, what are actions they can undertake together in the short term that align with the positions and views they have demonstrated over the past year? Please use sources from OpenTK."

## Example 2: Researching Parliamentary Discussions on Climate Policy
User Query: "I'd like to analyze recent parliamentary debates on climate policy and emission reduction targets in the Netherlands. Can you help me identify key discussions and the main positions taken by different parties over the past six months?"

## Example 3: Information About a Specific MP's Voting Record
User Query: "What is MP Pieter Omtzigt's voting record on healthcare reform legislation, and how does his position differ from other independent members? Has he introduced any motions on this topic?"

## Example 4: Finding Recent Housing Legislation Developments
User Query: "What are the most significant parliamentary documents and debates about affordable housing legislation from the past year? I'm particularly interested in proposals addressing the rental market crisis."

## Example 5: Efficiently Triaging Multiple Documents (NEW - Smart Analysis)
User Query: "I found 15 documents about climate policy from the last month. Can you quickly identify which 3 documents are most relevant to renewable energy subsidies and wind power legislation, without reading all of them in full?"

## Example 6: Extracting Key Topics from Parliamentary Documents (NEW - Smart Analysis)
User Query: "What are the main topics, keywords, and political parties mentioned in document 2024D39058? I want to understand what it's about before diving into the full text."

## Example 7: Finding MPs with Specific Committee Memberships
User Query: "Which MPs currently serve on both the Finance Committee and the Economic Affairs Committee? What parties do they represent, and have they recently submitted any joint initiatives?"

## Example 8: Identifying Upcoming Parliamentary Activities on Digital Security
User Query: "Are there any scheduled committee meetings or debates about cybersecurity and digital infrastructure planned for the next month? Which ministers will be participating and what specific topics will be addressed?"

## Project Concept

The OpenTK project is a Model Context Protocol (MCP) server that provides access to Dutch parliamentary data through a standardized interface. It serves as a bridge between large language models (LLMs) and the Dutch Parliament's information systems, allowing AI assistants to search, retrieve, and analyze parliamentary documents, debates, and member information.

The server uses the `@modelcontextprotocol/sdk` to implement the MCP specification, which enables structured communication between AI models and external data sources. By exposing parliamentary data through well-defined tools and endpoints, OpenTK makes it possible for AI assistants to:

1. Search for parliamentary documents using complex queries
2. Access information about Members of Parliament
3. Retrieve official documents in various formats and read the full content of the documents
4. Analyze parliamentary activities and proceedings
5. Track legislative cases and government pledges
6. **Intelligently analyze document relevance using NLP before loading full content** (NEW in v1.0.16)
7. **Extract keywords, entities, and topics for efficient document triage** (NEW in v1.0.16)

The project leverages Bert Hubert's tkconv service as its primary data source, which provides a more accessible API than the official Dutch Parliament APIs.

## Features

### Core Parliamentary Data Access
- Search parliamentary documents with advanced query capabilities (quotes, NOT, OR, NEAR operators)
- Access comprehensive MP information and committee memberships
- Retrieve full document content (PDF, Word) with smart chunking
- Track legislative cases, government activities, and voting results
- Real-time access to parliamentary proceedings and upcoming activities

### Smart Document Analysis (NEW in v1.0.16) 🎯
- **NLP-Powered Relevance Analysis**: Intelligently analyze documents before loading full content
- **TF-IDF Keyword Extraction**: Identify the top 10-15 most important terms in any document
- **Dutch-Optimized Entity Recognition**: Automatically detect persons (MPs, ministers), political parties (VVD, PVV, CDA, D66, etc.), and organizations
- **Topic Categorization**: Classify documents across 10 major political themes (Climate, Economy, Healthcare, Education, etc.)
- **Relevance Scoring**: Rank documents by relevance to specific search terms (0-100 score)
- **Context-Efficient Triage**: Reduce context window usage by 80-90% when evaluating multiple documents

### Advanced Document Navigation
- Find specific person occurrences with fuzzy matching
- Find party mentions with fuzzy matching
- Navigate large documents efficiently with character offsets
- Sequential reading with pagination support

## Available Tools

OpenTK provides 17 specialized tools for accessing Dutch parliamentary data:

### Overview & Discovery
- **`get_overview`**: Comprehensive overview of recent parliamentary activities and MP birthdays (paginated)
- **`birthdays_today`**: List MPs celebrating birthdays today
- **`list_persons`**: Complete directory of current MPs with party affiliations

### Search & Filter
- **`search_tk`**: Comprehensive search across all parliamentary data with advanced query syntax
- **`search_tk_filtered`**: Search within specific categories (Document, Activiteit, Zaak)
- **`search_by_category`**: Search for specific document types (questions, motions, all)

### Document Intelligence (NEW) 🎯
- **`analyze_document_relevance`**: NLP-powered document analysis with keyword extraction, entity recognition, and relevance scoring
- **`get_document_content`**: Retrieve document content (PDF/DOCX) with three reading modes (targeted, sequential, full)
- **`find_person_in_document`**: Locate all occurrences of a person in a document with fuzzy matching
- **`find_party_in_document`**: Locate all occurrences of a political party in a document

### Document Metadata
- **`get_document_details`**: Retrieve structured metadata about documents
- **`get_document_links`**: Convert document URLs to clickable markdown links

### Parliamentary Structure
- **`get_committees`**: List all parliamentary committees
- **`get_committee_details`**: Detailed information about specific committees

### Activities & Voting
- **`get_upcoming_activities`**: Upcoming parliamentary debates and meetings
- **`get_voting_results`**: Recent voting results with party positions

### Media
- **`get_photo`**: Retrieve official MP portrait photographs

## Installation

### 1. Quick Start with NPM Package (Recommended)

The fastest way to get started is using the published npm package:

```bash
npx @r-huijts/opentk-mcp
```

### 2. Using Claude Desktop with NPM Package

Update your Claude configuration file (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "opentk": {
      "command": "npx",
      "args": [
        "-y",
        "@r-huijts/opentk-mcp"
      ]
    }
  }
}
```

**Alternative configurations:**

For MultiServerMCPClient (Python):
```python
mcp_client = MultiServerMCPClient({
    "opentk": {
        "command": "npx",
        "args": ["-y", "@r-huijts/opentk-mcp"],
        "transport": "stdio",
    }
})
```

### 3. From Source (Development)

If you want to modify the code or contribute to development:

**Clone Repository:**
```bash
git clone https://github.com/r-huijts/opentk-mcp.git
cd opentk-mcp
```

**Install Dependencies:**
```bash
npm install
```

**Build the Project:**
```bash
npm run build
```

**Start the Server:**
```bash
npm start
```

**Configure Claude Desktop for local development:**

Update your Claude configuration file:

```json
{
  "mcpServers": {
    "opentk-local": {
      "command": "node",
      "args": [
        "/absolute/path/to/your/opentk-mcp/dist/index.js"
      ]
    }
  }
}
```

Make sure to replace `/absolute/path/to/your/opentk-mcp/` with the actual path to your installation.

### 4. Publishing (for maintainers)

To publish a new version of the scoped package:

```bash
npm run build
npm publish --access=public
```

Note: Scoped packages require the `--access=public` flag to be publicly available.

## Search Functionality

The search functionality is particularly sophisticated, supporting:

- Simple keyword searches: `kunstmatige intelligentie`
- Exact phrase searches: `"kunstmatige intelligentie"`
- Exclusion searches: `Hubert NOT Bruls`
- Boolean operators: `OR`, `NEAR()`

The implementation handles various edge cases:
- Preserves quotes in search queries
- Uses proper content type headers
- Implements fallback mechanisms for API errors
- Provides meaningful error messages

## Error Handling

The API service includes robust error handling:
- Graceful handling of API errors (4xx, 5xx)
- Fallback to simplified queries when complex ones fail
- Detailed error messages for debugging
- Proper logging to stderr (not stdout, which would break the stdio transport)

## Configuration

The server connects to Bert Hubert's [tkconv service](https://berthub.eu/tkconv/) as its primary data source, which provides a more accessible API than the official Dutch Parliament APIs. This service, created by Bert Hubert, does the heavy lifting of collecting, organizing, and making available Dutch parliamentary data in a developer-friendly format. Our MCP server builds upon this foundation to create a standardized interface for AI assistants to interact with this valuable data.

## License

MIT

## Conclusion

The OpenTK MCP server provides a robust and well-structured interface to Dutch parliamentary data, making it accessible to AI assistants through the Model Context Protocol. Its modular design, comprehensive API, NLP-powered document analysis (v1.0.16), and thorough testing ensure reliable access to parliamentary information for AI-assisted research, analysis, and information retrieval.

Once configured, Claude will be able to access Dutch parliamentary data through the OpenTK MCP server using all 17 specialized tools for search, document analysis, MP information, committee tracking, voting results, and more.