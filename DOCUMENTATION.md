# OpenTK Model Context Protocol Server

## Real-World Natural Language Interaction Examples

### Example 1: Researching Parliamentary Discussions on Climate Policy

**User Query:** "I need to find recent parliamentary discussions about climate policy and carbon emissions targets in the Netherlands."

**AI Assistant Process:**
1. Uses `search_tk` tool with query "klimaatbeleid CO2 doelstellingen"
2. Analyzes results and identifies key documents
3. Uses `get_document_details` to retrieve metadata for the most relevant documents
4. Provides a summary of findings with `get_document_links` for further reading

**Response Example:**
"I found several recent parliamentary discussions on climate policy. The most significant is a debate from March 2025 where the Minister of Climate presented new carbon emission targets. Here are the key documents:
- [Committee Report on Climate Goals 2025-2030](https://www.tweedekamer.nl/...)
- [Minister's Letter on Updated CO2 Reduction Targets](https://www.tweedekamer.nl/...)
The documents show that the government is proposing a 60% reduction in emissions by 2030, which was debated extensively in the committee meeting on March 15th."

### Example 2: Information About a Specific MP

**User Query:** "Who is the current MP Pieter Omtzigt and what's his background?"

**AI Assistant Process:**
1. Uses `list_persons` to find Pieter Omtzigt's MP ID and basic information
2. Retrieves his photo using `get_photo`
3. Analyzes his recent parliamentary activities using `search_tk_filtered` with his name and type "Document"

**Response Example:**
"Pieter Omtzigt is a current Member of Parliament who leads the Nieuw Sociaal Contract (NSC) party. According to the parliamentary database, he has been in parliament since 2003 and is known for his work on government transparency and accountability. He played a key role in uncovering the childcare benefits scandal. Recently, he has been active in debates on constitutional reform and tax policy, with several parliamentary questions submitted in the past month. Here's his official parliamentary portrait: [Image]"

### Example 3: Finding Recent Housing Legislation

**User Query:** "What are the most recent parliamentary documents about housing legislation?"

**AI Assistant Process:**
1. Uses `search_tk_filtered` with type "Document" and query "woningwet"
2. Sorts results by date to focus on recent entries
3. Uses `get_document_details` to retrieve metadata for the most relevant documents
4. Provides clickable links with `get_document_links`

**Response Example:**
"I found several recent parliamentary documents related to housing legislation. The most recent is a letter from the Minister of Housing dated April 3, 2025, outlining proposed amendments to the Housing Act (Woningwet). The key changes include new regulations for affordable housing development and rent control measures. Here are links to the most relevant documents:

[Download Minister's Letter on Housing Act Amendments (PDF)](https://berthub.eu/tkconv/getraw/2025D12345)
[View on Tweede Kamer website](https://www.tweedekamer.nl/kamerstukken/brieven_regering/detail?id=2025Z12345)

The letter indicates that the formal bill will be submitted to parliament next month after the consultation period ends."

### Example 4: Finding MPs with Birthdays Today

**User Query:** "Are there any Dutch MPs celebrating their birthday today?"

**AI Assistant Process:**
1. Uses `birthdays_today` to retrieve MPs with birthdays on the current date
2. For each MP with a birthday, uses `get_photo` to retrieve their portrait

**Response Example:**
"Yes, there are two Members of Parliament celebrating their birthdays today:

1. **Judith van Swaaij** (D66) turns 42 today. She has been serving in parliament since 2021 and is currently on the Education Committee.

2. **Bart van Kent** (SP) turns 38 today. He is a member of the Social Affairs Committee and has been in parliament since 2017.

Here are their official parliamentary portraits: [Images]

Would you like me to find more information about either of these MPs?"

## Project Concept

The OpenTK project is a Model Context Protocol (MCP) server that provides access to Dutch parliamentary data through a standardized interface. It serves as a bridge between large language models (LLMs) and the Dutch Parliament's information systems, allowing AI assistants to search, retrieve, and analyze parliamentary documents, debates, and member information.

The server uses the `@modelcontextprotocol/sdk` to implement the MCP specification, which enables structured communication between AI models and external data sources. By exposing parliamentary data through well-defined tools and endpoints, OpenTK makes it possible for AI assistants to:

1. Search for parliamentary documents using complex queries
2. Access information about Members of Parliament
3. Retrieve official documents in various formats
4. Analyze parliamentary activities and proceedings
5. Track legislative cases and government pledges

The project leverages Bert Hubert's tkconv service as its primary data source, which provides a more accessible API than the official Dutch Parliament APIs.

## Project Structure

The project follows a modular structure:

```
opentk-mcp/
├── src/
│   ├── index.ts                # Main entry point and MCP tool definitions
│   ├── config.ts               # Configuration settings
│   ├── services/
│   │   └── api.ts              # Core API service for data fetching
│   ├── utils/
│   │   └── html-parser.js      # Utilities for parsing HTML responses
│   └── __tests__/              # Test files
│       ├── api-service.test.ts # Tests for API service
│       └── endpoint-integration.test.ts # Integration tests
├── dist/                       # Compiled JavaScript output
├── package.json                # Project dependencies and scripts
└── tsconfig.json               # TypeScript configuration
```

## API Service Methods

The `ApiService` class in `src/services/api.ts` provides the core functionality for interacting with the tkconv API. These methods are used internally by the MCP tools, and some are directly exposed as tools while others serve as supporting functions. Here are the key methods:

### 1. `fetchJson<T>(path: string, options?: RequestInit): Promise<T>` (Used by the `birthdays_today` tool)
- Fetches and parses JSON data from the API
- Handles error cases and content type validation
- Used for structured data endpoints

### 2. `fetchHtml(path: string, options?: RequestInit): Promise<string>` (Used by the `get_document_details` tool)
- Retrieves HTML content from the API
- Used for document pages, MP profiles, and other HTML-based content

### 3. `fetchBinary(path: string, options?: RequestInit): Promise<{ data: ArrayBuffer, contentType: string }>` (Used by the `get_photo` tool)
- Downloads binary data such as PDFs and images
- Returns both the data and content type for proper handling

### 4. `search<T>(query: string, options?: { twomonths?: boolean, soorten?: string }): Promise<T>` (Used by the `search_tk` and `search_tk_filtered` tools)
- Performs searches across parliamentary data
- Supports complex queries with quotes, NOT operators, etc.
- Includes fallback mechanisms for handling API errors

### 5. `resolveExternal(extId: string): Promise<string>` (API method, not exposed as a tool)
- Resolves external reference IDs to direct URLs
- Tries multiple approaches to find the correct URL

### 6. `fetchSitemap(path: string): Promise<string[]>` (API method, not exposed as a tool)
- Retrieves lists of URLs for specific time periods
- Supports yearly, half-yearly, and monthly sitemaps

### 7. `getPersons(): Promise<any[]>` (Used by the `list_persons` tool)
- Fetches a list of all current Members of Parliament
- Extracts structured data from HTML responses

### 8. `getPerson(id: number): Promise<any | null>` (API method, not exposed as a tool)
- Retrieves detailed information about a specific MP
- Parses HTML to extract structured data

## MCP Tools

The MCP server currently exposes the following tools to AI assistants:

### MP Information Tools
1. `birthdays_today` - Lists all Members of Parliament celebrating their birthday today
2. `list_persons` - Provides a complete directory of current Members of Parliament
3. `get_photo` - Retrieves an MP's official portrait photograph

### Search Tools
4. `search_tk` - Comprehensive search across all parliamentary data
5. `search_tk_filtered` - Search filtered by document type (Document, Activiteit, Zaak)

### Document Tools
6. `get_document_details` - Retrieves metadata about a parliamentary document
7. `get_document_links` - Converts document URLs into clickable links

### Note on Available Tools
The current implementation includes 7 tools, which is a subset of the tools that were originally planned or available in previous versions. Some API methods (like `resolveExternal`, `fetchSitemap`, and `getPerson`) are implemented in the codebase but not exposed as tools in the current version.

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

## Testing

The project includes comprehensive tests:
- Unit tests for API service methods
- Integration tests for actual endpoints
- Tests for complex search queries
- Tests for error handling

## Conclusion

The OpenTK MCP server provides a robust and well-structured interface to Dutch parliamentary data, making it accessible to AI assistants through the Model Context Protocol. Its modular design, comprehensive API, and thorough testing ensure reliable access to parliamentary information for AI-assisted research, analysis, and information retrieval.
