# OpenTK Parliamentary Data Desktop Extension

## 🎭 Wat is dit?

Een **Desktop Extension** voor Claude Desktop die toegang geeft tot Nederlandse parlementaire gegevens via de OpenTK API. Deze extensie maakt het mogelijk om met één enkele klik alle Nederlandse parlementaire informatie te doorzoeken - van documenten tot debatten, van Kamerleden tot stemmingen.

## ✨ Features

- **Zoeken in parlementaire documenten** - Geavanceerde zoekopdrachten met ondersteuning voor exacte zinnen, uitsluitingen en boolean operatoren
- **Toegang tot Kamerleden** - Informatie over alle huidige Tweede Kamerleden, inclusief foto's en partijaffiliaties
- **Documenten downloaden** - Volledige inhoud van PDF en Word documenten extraheren
- **Commissies en activiteiten** - Overzicht van parlementaire commissies en aankomende activiteiten
- **Stemmingen** - Recente stemresultaten en partijposities
- **Gebruiksvriendelijk** - Geen complexe installatie, gewoon dubbelklikken en installeren!

## 🚀 Installatie

### Voor gebruikers:

1. **Download** het bestand `opentk-mcp.mcpb` (26MB)
2. **Open Claude Desktop**
3. **Ga naar Settings** → **Extensions**
4. **Sleep het .mcpb bestand** naar het extensie venster
5. **Klik "Install"**
6. **Klaar!** 🎉

### Wat gebeurt er automatisch:
- Alle dependencies worden geïnstalleerd
- De MCP server wordt geconfigureerd
- Cross-platform ondersteuning (Windows & macOS)
- Automatische updates

## 🛠️ Voor ontwikkelaars

### Bouwen van de extensie:

```bash
# Installeer de MCPB toolchain
npm install -g @anthropic-ai/mcpb

# Bouw de TypeScript code
npm run build

# Pak de extensie
mcpb pack
```

### Project structuur:
```
opentk-mcp/
├── manifest.json          # Extensie metadata
├── dist/                  # Gecompileerde JavaScript
├── src/                   # TypeScript broncode
├── node_modules/          # Dependencies (gebundeld in .mcpb)
└── opentk-mcp.mcpb       # De finale extensie
```

## 📋 Beschikbare Tools

De extensie biedt de volgende tools:

1. **`get_overview`** - Algemeen overzicht van recente parlementaire activiteiten
2. **`search_tk`** - Zoeken in alle parlementaire data
3. **`get_document_details`** - Metadata van specifieke documenten
4. **`get_document_content`** - Volledige inhoud van documenten
5. **`list_persons`** - Lijst van alle Kamerleden
6. **`get_photo`** - Officiële foto's van Kamerleden
7. **`get_committees`** - Parlementaire commissies
8. **`get_committee_details`** - Details van specifieke commissies
9. **`get_upcoming_activities`** - Aankomende parlementaire activiteiten
10. **`get_voting_results`** - Recente stemresultaten

## 🔍 Zoekvoorbeelden

```javascript
// Eenvoudige zoekopdracht
search_tk({ query: "klimaat" })

// Exacte zin
search_tk({ query: "\"klimaatverandering\"" })

// Uitsluiting
search_tk({ query: "Hubert NOT Bruls" })

// Categorie filter
search_tk_filtered({ 
  query: "onderwijs", 
  type: "Document" 
})
```

## 🌍 Cross-platform ondersteuning

De extensie werkt op:
- **Windows** (win32)
- **macOS** (darwin) 
- **Linux** (linux)

Alle platform-specifieke configuraties worden automatisch afgehandeld.

## 📦 Technische details

- **Grootte**: 26MB (inclusief alle dependencies)
- **Runtime**: Node.js (gebundeld)
- **Protocol**: Model Context Protocol (MCP)
- **API**: OpenTK/tkconv service
- **Formaten**: PDF, Word (DOCX), HTML

## 🐛 Troubleshooting

### Extensie start niet op:
1. Controleer of Claude Desktop de nieuwste versie is
2. Herstart Claude Desktop na installatie
3. Check de logs in Claude Desktop Settings

### Zoekopdrachten geven geen resultaten:
1. Probeer eenvoudigere zoektermen
2. Controleer de spelling
3. Gebruik geen speciale karakters

### Documenten kunnen niet gedownload worden:
1. Controleer of het document ID correct is
2. Sommige documenten zijn mogelijk niet publiek beschikbaar

## 📄 Licentie

MIT License - Vrij te gebruiken en aan te passen.

## 🤝 Contributing

Pull requests zijn welkom! Voor grote wijzigingen, open eerst een issue om te bespreken wat je wilt veranderen.

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/r-huijts/opentk-mcp/issues)
- **Documentatie**: [README](https://github.com/r-huijts/opentk-mcp#readme)
- **OpenTK API**: [tkconv service](https://tkconv.nl/)

---

*Gemaakt met ❤️ en een gezonde dosis Nederlandse parlementaire gegevens door r-huijts*

