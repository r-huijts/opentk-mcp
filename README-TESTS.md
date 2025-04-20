# Testing the OpenTK MCP Server

This document provides information about testing the OpenTK MCP server and checking which endpoints are working as expected.

## Endpoint Status Check

To check the status of all endpoints, run:

```bash
npm run check-endpoints
```

This will test all the endpoints and provide a report showing which ones are working and which ones are failing.

## Endpoints Being Tested

The following endpoints are tested:

1. **Search API** - `POST https://berthub.eu/tkconv/search`
   - Tests searching for documents using the tkconv API
   - Uses proper headers and form data

2. **Document HTML** - `GET https://berthub.eu/tkconv/document.html?nummer=2024D39058`
   - Tests fetching a document's HTML page
   - Checks if the page contains a document link

3. **Document Download** - `GET https://berthub.eu/tkconv/getraw/2024D39058`
   - Tests downloading a document's binary content
   - Verifies that the content is a PDF

4. **Sitemap** - `GET https://berthub.eu/tkconv/sitemap-2024.txt`
   - Tests fetching a sitemap of URLs
   - Checks if the sitemap contains URLs

5. **External Reference** - `GET https://berthub.eu/tkconv/op/2024D39058`
   - Tests resolving an external reference to a URL
   - Checks if the response contains a redirect

6. **OData Persons** - `GET https://gegevensmagazijn.tweedekamer.nl/OData/v4/2.0/Personen`
   - Tests fetching persons from the OData API
   - Verifies that the response contains person data

7. **OData Single Person** - `GET https://gegevensmagazijn.tweedekamer.nl/OData/v4/2.0/Personen(1)`
   - Tests fetching a single person from the OData API
   - Checks if the response contains the person's data

## Manual Testing

You can also manually test the endpoints using tools like curl or Postman. Here are some example commands:

### Search API

```bash
curl -X POST \
  -H "Accept: */*" \
  -H "User-Agent: Mozilla/5.0" \
  -H "Referer: https://berthub.eu/tkconv/search.html" \
  -H "Origin: https://berthub.eu" \
  -H "Host: berthub.eu" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "q=kunstmatige%20intelligentie&twomonths=false&soorten=" \
  https://berthub.eu/tkconv/search
```

### Document HTML

```bash
curl -X GET https://berthub.eu/tkconv/document.html?nummer=2024D39058
```

### Document Download

```bash
curl -X GET https://berthub.eu/tkconv/getraw/2024D39058 --output document.pdf
```

### Sitemap

```bash
curl -X GET https://berthub.eu/tkconv/sitemap-2024.txt
```

### External Reference

```bash
curl -X GET -I https://berthub.eu/tkconv/op/2024D39058
```

### OData Persons

```bash
curl -X GET https://gegevensmagazijn.tweedekamer.nl/OData/v4/2.0/Personen?$top=5
```

### OData Single Person

```bash
curl -X GET https://gegevensmagazijn.tweedekamer.nl/OData/v4/2.0/Personen(1)
```

## Troubleshooting

If an endpoint is not working as expected, check the following:

1. **Network Connectivity**: Make sure you have internet access and can reach the API servers.
2. **API Changes**: The external APIs may have changed their structure or requirements.
3. **Rate Limiting**: You might be hitting rate limits if you make too many requests.
4. **Authentication**: Some endpoints might require authentication or specific headers.
5. **Content Type**: Make sure you're sending the correct Content-Type header for POST requests.

## Adding New Tests

To add tests for new endpoints, edit the `scripts/check-endpoints.js` file and add a new entry to the `endpoints` array.
