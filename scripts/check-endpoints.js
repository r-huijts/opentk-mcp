#!/usr/bin/env node

import fetch from 'node-fetch';
import FormData from 'form-data';

const BASE_URL = 'https://berthub.eu/tkconv';
const ODATA_BASE_URL = 'https://gegevensmagazijn.tweedekamer.nl/OData/v4/2.0';

// List of endpoints to check
const endpoints = [
  { 
    name: 'Search API', 
    url: `${BASE_URL}/search`, 
    method: 'POST',
    test: async () => {
      const formData = new FormData();
      formData.append('q', 'kunstmatige intelligentie');
      formData.append('twomonths', 'false');
      formData.append('soorten', '');
      
      const res = await fetch(`${BASE_URL}/search`, {
        method: 'POST',
        headers: {
          'Accept': '*/*',
          'User-Agent': 'Mozilla/5.0 (compatible; OpenTK-MCP/1.0)',
          'Referer': `${BASE_URL}/search.html?q=kunstmatige%20intelligentie&twomonths=false&soorten=alles`,
          'Origin': BASE_URL,
          'Host': 'berthub.eu',
          'Connection': 'keep-alive',
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'same-origin',
          'sec-ch-ua': '"Chromium";v="135", "Not-A.Brand";v="8"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"macOS"'
        },
        body: formData
      });
      
      if (!res.ok) {
        return { success: false, status: res.status, message: res.statusText };
      }
      
      const text = await res.text();
      try {
        const data = JSON.parse(text);
        return { 
          success: true, 
          status: res.status, 
          message: `Found ${data.results?.length || 0} results` 
        };
      } catch (e) {
        return { success: false, status: res.status, message: 'Invalid JSON response' };
      }
    }
  },
  { 
    name: 'Document HTML', 
    url: `${BASE_URL}/document.html?nummer=2024D39058`, 
    method: 'GET',
    test: async () => {
      const res = await fetch(`${BASE_URL}/document.html?nummer=2024D39058`);
      
      if (!res.ok) {
        return { success: false, status: res.status, message: res.statusText };
      }
      
      const text = await res.text();
      const hasDocumentLink = text.includes('Directe link naar document') || 
                              text.includes('<iframe') && text.includes('getraw/');
      
      return { 
        success: hasDocumentLink, 
        status: res.status, 
        message: hasDocumentLink ? 'Document link found' : 'No document link found' 
      };
    }
  },
  { 
    name: 'Document Download', 
    url: `${BASE_URL}/getraw/2024D39058`, 
    method: 'GET',
    test: async () => {
      const res = await fetch(`${BASE_URL}/getraw/2024D39058`);
      
      if (!res.ok) {
        return { success: false, status: res.status, message: res.statusText };
      }
      
      const contentType = res.headers.get('content-type');
      const isPdf = contentType?.includes('pdf') || contentType?.includes('application/octet-stream');
      const buffer = await res.arrayBuffer();
      
      return { 
        success: isPdf && buffer.byteLength > 0, 
        status: res.status, 
        message: `Downloaded ${buffer.byteLength} bytes, content-type: ${contentType}` 
      };
    }
  },
  { 
    name: 'Sitemap', 
    url: `${BASE_URL}/sitemap-2024.txt`, 
    method: 'GET',
    test: async () => {
      const res = await fetch(`${BASE_URL}/sitemap-2024.txt`);
      
      if (!res.ok) {
        return { success: false, status: res.status, message: res.statusText };
      }
      
      const text = await res.text();
      const lines = text.trim().split(/\\r?\\n/).filter(line => line.trim() !== '');
      
      return { 
        success: lines.length > 0, 
        status: res.status, 
        message: `Found ${lines.length} URLs` 
      };
    }
  },
  { 
    name: 'External Reference', 
    url: `${BASE_URL}/op/2024D39058`, 
    method: 'GET',
    test: async () => {
      const res = await fetch(`${BASE_URL}/op/2024D39058`, {
        redirect: 'manual'
      });
      
      const location = res.headers.get('location');
      
      return { 
        success: !!location, 
        status: res.status, 
        message: location ? `Redirects to: ${location}` : 'No redirect found' 
      };
    }
  },
  { 
    name: 'OData Persons', 
    url: `${ODATA_BASE_URL}/Personen`, 
    method: 'GET',
    test: async () => {
      const res = await fetch(`${ODATA_BASE_URL}/Personen?$top=5`);
      
      if (!res.ok) {
        return { success: false, status: res.status, message: res.statusText };
      }
      
      try {
        const data = await res.json();
        return { 
          success: Array.isArray(data.value), 
          status: res.status, 
          message: `Found ${data.value?.length || 0} persons` 
        };
      } catch (e) {
        return { success: false, status: res.status, message: 'Invalid JSON response' };
      }
    }
  },
  { 
    name: 'OData Single Person', 
    url: `${ODATA_BASE_URL}/Personen(1)`, 
    method: 'GET',
    test: async () => {
      const res = await fetch(`${ODATA_BASE_URL}/Personen(1)`);
      
      if (!res.ok) {
        return { success: false, status: res.status, message: res.statusText };
      }
      
      try {
        const data = await res.json();
        return { 
          success: data && data.Id === 1, 
          status: res.status, 
          message: data ? `Found person: ${data.Voornaam} ${data.Achternaam}` : 'No person found' 
        };
      } catch (e) {
        return { success: false, status: res.status, message: 'Invalid JSON response' };
      }
    }
  }
];

// Function to check all endpoints
async function checkEndpoints() {
  console.log('\nEndpoint Status Report:');
  console.log('=====================');
  
  const results = [];
  
  for (const endpoint of endpoints) {
    process.stdout.write(`Testing ${endpoint.name} (${endpoint.method} ${endpoint.url})... `);
    
    try {
      const result = await endpoint.test();
      results.push({
        ...endpoint,
        ...result
      });
      
      if (result.success) {
        console.log('✅ SUCCESS');
      } else {
        console.log('❌ FAILED');
      }
      console.log(`   Status: ${result.status}, Message: ${result.message}`);
    } catch (error) {
      results.push({
        ...endpoint,
        success: false,
        status: 'ERROR',
        message: error.message
      });
      
      console.log('❌ ERROR');
      console.log(`   Message: ${error.message}`);
    }
    
    console.log('');
  }
  
  // Print summary
  console.log('\nSummary:');
  console.log('========');
  
  const successful = results.filter(r => r.success).length;
  console.log(`${successful}/${results.length} endpoints working correctly`);
  
  if (successful < results.length) {
    console.log('\nFailed endpoints:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`- ${r.name}: ${r.message}`);
    });
  }
}

// Run the checks
checkEndpoints().catch(error => {
  console.error('Error running endpoint checks:', error);
  process.exit(1);
});
