import { McpClient } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ChildProcessTransport } from '@modelcontextprotocol/sdk/server/child-process.js';

async function main() {
  // Create a client that connects to the server via stdio
  const client = new McpClient(new ChildProcessTransport('node', ['dist/index.js']));
  
  try {
    // Connect to the server
    await client.connect();
    
    // Call the get_overview tool for page 1
    console.log('Calling get_overview for page 1...');
    const result1 = await client.callTool('get_overview', { page: 1 });
    
    // Print the result for page 1
    console.log('Result for page 1:');
    console.log(JSON.stringify(result1, null, 2));
    
    // Check if there are more documents
    const pagination1 = JSON.parse(result1.content[0].text).pagination;
    
    if (pagination1.hasMoreDocuments) {
      // Call the get_overview tool for page 2
      console.log('\nCalling get_overview for page 2...');
      const result2 = await client.callTool('get_overview', { page: 2 });
      
      // Print the result for page 2
      console.log('Result for page 2:');
      console.log(JSON.stringify(result2, null, 2));
      
      // Return the combined results
      return { page1: result1, page2: result2 };
    }
    
    // If there's only one page, just return that result
    return result1;
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Disconnect from the server
    await client.disconnect();
  }
}

main().catch(console.error);
