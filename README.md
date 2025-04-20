# OpenTK MCP Server

A Model Context Protocol (MCP) server that provides access to the Dutch Parliament (Tweede Kamer) data through the tkconv API.

## Features

This MCP server provides 17 tools for accessing various aspects of the Dutch Parliament data:

1. `get_activity` - Full parliamentary activity information
2. `get_activity_video` - Debate video links
3. `get_committee` - Committee overview
4. `birthdays_today` - MPs celebrating birthdays today
5. `list_persons` - Complete directory of MPs
6. `search_tk` - Keyword search across all parliamentary records
7. `search_tk_filtered` - Search filtered by document type
8. `download_document` - Download document files
9. `get_photo` - MP portrait photos
10. `get_sitemap_year` - Yearly URL overview
11. `get_sitemap_half_year` - Half-year URL overview
12. `get_sitemap_month` - Monthly URL overview
13. `resolve_external` - Resolve external references
14. `get_member_details` - MP profile pages
15. `get_toezegging` - Pledge (toezegging) pages
16. `get_case` - Case (zaak) pages
17. `get_document_metadata` - Document overview

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd opentk-mcp

# Install dependencies
npm install
```

## Usage

```bash
# Build the TypeScript code
npm run build

# Start the MCP server
npm start
```

## Development

```bash
# Build and run in development mode
npm run dev
```

## Using with MCP Clients

This server can be used with any MCP client. For example, you can use it with Claude 3 Opus or Sonnet through the MCP integration.

### Example Queries

Here are some example queries you can try with the server:

1. "Show me the MPs celebrating their birthday today"
2. "Search for parliamentary documents about climate change"
3. "Get information about the Finance Committee"
4. "Find recent activities related to healthcare"
5. "Show me the profile of a specific MP"

### Enhanced Tool Descriptions

All tools have been equipped with detailed descriptions that explain:

- What the tool does and what information it provides
- When to use the tool (specific use cases)
- What the parameters mean and how to format them correctly

These enhanced descriptions help LLMs better understand when to use each tool based on user requests, improving the accuracy of tool selection and reducing the need for clarification questions.

### API Service Layer

The server includes a dedicated API service layer that abstracts all HTTP requests to the tkconv service. This provides several benefits:

- Centralized error handling for all API requests
- Consistent handling of HTML vs. JSON responses
- Specialized methods for different types of requests (JSON, HTML, binary, etc.)
- Easier maintenance and updates to API-related code
- Better code organization and separation of concerns

### Error Handling

The server includes robust error handling for API responses. If an endpoint returns HTML instead of the expected JSON (which can happen with some endpoints), the server will provide a clear error message rather than crashing. This makes the server more resilient to API changes or temporary issues.

All endpoints have been updated to handle HTML responses gracefully. The tkconv service by Bert Hubert sometimes returns HTML instead of JSON for certain endpoints, especially when the service is under heavy load or when there are temporary issues. The server will detect this and provide a clear error message to the user.

### Enhanced API Robustness

All API interactions have been improved to be more robust and resilient:

- **Input Sanitization**: All endpoints sanitize inputs to remove potentially problematic characters
- **Graceful Error Handling**: Returns empty result sets instead of errors when possible
- **Proper Headers**: Includes User-Agent and Accept headers for better compatibility
- **HTML Detection**: All endpoints can detect and handle HTML responses appropriately
- **Detailed Logging**: Comprehensive error logging for easier troubleshooting
- **Service Layer**: Dedicated services for different functionality (API, Parliament data)

These improvements make the server more reliable when dealing with external APIs that may have inconsistent behavior or temporary issues.

### Search Functionality

The search functionality has been implemented correctly based on the tkconv API requirements:

- Uses POST method with multipart/form-data as required by the API
- Includes exact browser-like headers to handle cross-origin restrictions
- Precisely mimics browser behavior for maximum compatibility
- Supports advanced search syntax as documented in the tkconv search documentation
- Handles special characters and search operators properly
- Returns well-formatted JSON results sorted by date (newest first)
- Provides helpful error messages when searches fail
- Automatically simplifies complex queries that cause API errors

Example search operators supported:
- `term1 term2` - Finds documents containing both terms anywhere (e.g., `Joe Biden` finds documents with both words anywhere)
- `"exact phrase"` - Finds documents with the exact phrase (e.g., `"Joe Biden"` only finds documents with these words next to each other)
- `NEAR(term1 term2)` - Finds documents with terms near each other
- `term1 NOT term2` - Finds documents with term1 but not term2 (e.g., `Hubert NOT Bruls` finds documents with 'Hubert' but not 'Bruls')
- `term1 OR term2 NOT term3` - Supports complex boolean logic

Note: The capital letters in operators like `NOT` and `OR` are important for the search to work correctly.

When a search query causes an error in the underlying API (which can happen with complex queries), the system will automatically try to simplify the query and provide a helpful error message to the user.

### Result Sorting

All search results are automatically sorted by date with the most recent documents displayed first. This applies to both the general search and the category-filtered search. The sorting is done on the server side after receiving results from the tkconv API, ensuring that users always see the most recent and relevant information at the top of the results list.

### Smart Document Retrieval

The document download functionality has been enhanced to handle various document access patterns:

1. **Direct Download**: First attempts to download the document directly using the document ID
2. **HTML Page Parsing**: If direct download fails, fetches the document's HTML page and extracts the document link
3. **Iframe Source Extraction**: Can extract document links from iframe sources if direct links are not available
4. **PDF Content Detection**: Intelligently detects PDF content even when the server returns incorrect content types
5. **Content Type Normalization**: Ensures consistent handling of PDFs regardless of how they're served

This multi-step approach ensures that documents can be retrieved even when the API structure changes or when documents are embedded in HTML pages rather than directly accessible.

### Simplified API Dependencies

The server now exclusively uses the tkconv API for all functionality:

- **Removed OData Dependency**: Eliminated dependency on the Dutch Parliament's OData API, which was unreliable and frequently changed
- **HTML Parsing**: Added HTML parsing capabilities to extract structured data from tkconv HTML pages
- **Consistent Data Format**: Maintains the same data structure for backward compatibility
- **Improved Reliability**: Reduced external dependencies for better stability

This change simplifies the codebase and improves reliability by focusing on a single, well-maintained API source.

## License

[MIT](LICENSE)
