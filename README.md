# OpenTK Model Context Protocol Server

> **Important Attribution**: This MCP server is built as a wrapper around the excellent [OpenTK project](https://berthub.eu/tkconv/) created by [Bert Hubert](https://berthub.eu/). The OpenTK project provides unprecedented access to Dutch parliamentary data through a user-friendly interface. Learn more about the project in Bert's article: [Welkom bij OpenTK](https://berthub.eu/articles/posts/welkom-bij-opentk/). All credit for the underlying data access and processing goes to Bert Hubert and his contributions to open government data.

A bridge between large language models (LLMs) and Dutch parliamentary data through a standardized interface. This MCP server provides access to Dutch parliamentary documents, debates, and member information from the Tweede Kamer.

## Real-World Natural Language Interaction Examples

### Example 1: Researching Parliamentary Discussions on Climate Policy

**User Query:** "I need to find recent parliamentary discussions about climate policy and carbon emissions targets in the Netherlands."

### Example 2: Information About a Specific MP

**User Query:** "Who is the current MP Pieter Omtzigt and what's his background?"

### Example 3: Finding Recent Housing Legislation

**User Query:** "What are the most recent parliamentary documents about housing legislation?"

### Example 4: Finding MPs with Birthdays Today

**User Query:** "Are there any Dutch MPs celebrating their birthday today?"

### Example 5: Finding Upcoming Parliamentary Activities

**User Query:** "What parliamentary activities are scheduled for next week?"


## Project Concept

The OpenTK project is a Model Context Protocol (MCP) server that provides access to Dutch parliamentary data through a standardized interface. It serves as a bridge between large language models (LLMs) and the Dutch Parliament's information systems, allowing AI assistants to search, retrieve, and analyze parliamentary documents, debates, and member information.

The server uses the `@modelcontextprotocol/sdk` to implement the MCP specification, which enables structured communication between AI models and external data sources. By exposing parliamentary data through well-defined tools and endpoints, OpenTK makes it possible for AI assistants to:

1. Search for parliamentary documents using complex queries
2. Access information about Members of Parliament
3. Retrieve official documents in various formats
4. Analyze parliamentary activities and proceedings
5. Track legislative cases and government pledges

The project leverages Bert Hubert's tkconv service as its primary data source, which provides a more accessible API than the official Dutch Parliament APIs.


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

The OpenTK MCP server provides a robust and well-structured interface to Dutch parliamentary data, making it accessible to AI assistants through the Model Context Protocol. Its modular design, comprehensive API, and thorough testing ensure reliable access to parliamentary information for AI-assisted research, analysis, and information retrieval.

## Installation

### 1. From Source

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

### 2. Configure Claude Desktop

Update your Claude configuration file:

```json
{
  "mcpServers": {
    "opentk-mcp-local": {
      "command": "node",
      "args": [
        "/absolute/path/to/your/opentk-mcp/dist/index.js"
      ]
    }
  }
}
```

Make sure to replace `/absolute/path/to/your/opentk-mcp/` with the actual path to your installation.

Once configured, Claude will be able to access Dutch parliamentary data through the OpenTK MCP server. The server exposes all the tools described in the [Usage](#usage) section above.
