# Version 1.0.11 Release Plan

## Overview

Bump to version 1.0.11 to include 2 new tools (find_person_in_document, find_party_in_document), rebuild the project, publish to npm, and create a new MCPB file.

## New Tools Added

1. **find_person_in_document** - Find all occurrences of a person's name in parliamentary documents with fuzzy matching
2. **find_party_in_document** - Find all occurrences of a political party in parliamentary documents with fuzzy matching

Both tools are already listed in manifest.json (lines 66-68 and 94-96).

## Steps

### 1. Update Version Numbers

- `package.json` line 3: `1.0.10` → `1.0.11`
- `manifest.json` line 5: `1.0.10` → `1.0.11`
- `src/index.ts` line 21: `1.0.10` → `1.0.11`
- `src/index.ts` line 897: `v1.0.10` → `v1.0.11`

### 2. Rebuild Project

```bash
npm run build
```

### 3. Publish to NPM

```bash
npm publish --access=public
```

### 4. Create New MCPB File

```bash
mcpb pack
```

### 5. Git Tag and Push

```bash
git tag -a v1.0.11 -m "Release v1.0.11 - Add find_person_in_document and find_party_in_document tools"
git push origin v1.0.11
```

## Total Tool Count

Version 1.0.11 will have **16 tools** (up from 14 in v1.0.10).


