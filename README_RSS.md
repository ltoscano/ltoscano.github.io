# RSS Feed Automation System

This repository includes an automated RSS feed system that fetches content from Medium and Substack and displays it on the website without CORS issues.

## How it works

1. **GitHub Actions Workflow**: The `.github/workflows/update-feeds.yml` file runs every 6 hours and fetches RSS feeds from:
   - Medium: `@thegoodprogrammer`
   - Substack: `@bematic`

2. **Node.js Script**: The `scripts/update-feeds.js` script processes the RSS feeds and creates JSON files in `data/feeds/`

3. **Local JSON Files**: The website loads feed data from local JSON files instead of making cross-origin requests

4. **Fallback System**: If JSON files are not available, the system falls back to CORS proxy methods with retry logic

## File Structure

```
data/feeds/
├── medium.json     # Processed Medium posts
├── substack.json   # Processed Substack posts
└── metadata.json   # Feed metadata and update times
```

## Local Development

To manually update feeds locally:

```bash
npm install
npm run update-feeds
```

## Feed Data Format

Each feed JSON contains:
- `title`: Feed title
- `description`: Feed description  
- `link`: Feed URL
- `lastUpdated`: Last update timestamp
- `posts`: Array of post objects with:
  - `title`: Post title
  - `link`: Post URL
  - `pubDate`: Publication date
  - `excerpt`: Post excerpt
  - `image`: Featured image URL
  - `creator`: Author name

## GitHub Actions Setup

The workflow automatically:
1. Fetches RSS feeds
2. Processes and saves JSON data
3. Commits changes back to the repository
4. Runs every 6 hours or can be triggered manually

## Benefits

- ✅ No CORS issues
- ✅ Faster loading (local files)
- ✅ Automatic updates via GitHub Actions
- ✅ Fallback system for reliability
- ✅ Clean separation of data and presentation
