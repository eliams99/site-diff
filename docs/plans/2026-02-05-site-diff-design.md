# Site Diff - Visual Comparison Tool

## Overview

Visual diff tool for comparing two versions of a website. Built for ad-hoc use during package migrations, environment comparisons, or spot-checking deployments.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Next.js 16 App                       │
├─────────────────┬───────────────────┬───────────────────┤
│   Config Page   │   Results Page    │   API Routes      │
│   - Base URLs   │   - Side-by-side  │   - /api/compare  │
│   - Slug input  │   - Diff overlay  │   - /api/sitemap  │
│   - Sitemap     │   - Pass/fail     │   - /api/runs     │
└────────┬────────┴─────────┬─────────┴─────────┬─────────┘
         │                  │                   │
         ▼                  ▼                   ▼
┌─────────────────────────────────────────────────────────┐
│                 Core Engine (lib/)                      │
├─────────────────┬───────────────────┬───────────────────┤
│   screenshotter │    differ         │  sitemap-parser   │
│   (Playwright)  │   (pixelmatch)    │  (xml parsing)    │
└─────────────────┴───────────────────┴───────────────────┘
         │                  │
         ▼                  ▼
┌─────────────────────────────────────────────────────────┐
│              File System (data/runs/)                   │
│   /baseline/home.png    /compare/home.png   /diff/...   │
└─────────────────────────────────────────────────────────┘
```

**Key decisions:**
- No database - results stored as files, perfect for ad-hoc usage
- Storage abstracted for future cloud hosting (S3, etc.)
- Docker-ready for internal deployment

## Data Flow & Storage

### Comparison flow
1. User enters base URL A, base URL B, and slugs (or fetches from sitemap)
2. API creates a "comparison run" with unique ID + timestamp
3. Playwright screenshots each slug on both URLs (parallel where possible)
4. pixelmatch generates diff image + mismatch percentage
5. Results saved to filesystem, metadata to JSON

### File structure
```
/data
  /runs
    /2026-02-05-abc123
      meta.json
      /screenshots
        /a
          home.png
          about.png
        /b
          home.png
          about.png
      /diffs
        home.png
        about.png
```

### meta.json schema
```json
{
  "id": "2026-02-05-abc123",
  "baseUrlA": "https://staging.example.com",
  "baseUrlB": "https://prod.example.com",
  "createdAt": "2026-02-05T10:30:00Z",
  "config": {
    "viewport": { "width": 1280, "height": 720 },
    "fullPage": true,
    "delay": 500,
    "threshold": 0.1
  },
  "results": [
    { "slug": "/", "mismatchPercent": 0.02, "status": "diff", "sizeDiff": false },
    { "slug": "/about", "mismatchPercent": 0, "status": "match", "sizeDiff": false }
  ]
}
```

## Screenshot Engine

**Playwright setup:**
- Use `playwright` package (not test runner)
- Single browser context, reuse across pages for speed
- Wait strategies: `networkidle` + configurable delay for animations

**Config options:**
```typescript
{
  viewport: { width: 1280, height: 720 },
  fullPage: true,                          // DEFAULT: capture entire scroll
  delay: 500,                              // wait after load (ms)
  hideSelectors: ['.cookie-banner', '.chat-widget']
}
```

**Parallelization:**
- Screenshot URL A and URL B for same slug in parallel
- Process multiple slugs concurrently (limit: 3-4)
- Progress updates via polling

**Edge cases:**
- Timeout → mark as "error", continue with other slugs
- Auth required → support optional cookies/headers in config
- Lazy images → scroll page before screenshot (optional)

## Diff Engine

**Using pixelmatch:**
- Fast, pure JS, no native dependencies
- Generates diff image with pink/red highlights

**Output per page:**
```typescript
{
  slug: "/about",
  mismatchPixels: 1247,
  mismatchPercent: 0.34,
  status: "diff" | "match" | "error",
  sizeDiff: boolean
}
```

**Threshold logic:**
- Default: 0.1 (pixelmatch sensitivity)
- `mismatchPercent < 0.05%` → status: "match" (anti-aliasing noise)
- User can adjust per run

**Size differences:**
- If pages have different heights, pad shorter with white
- Flag: `sizeDiff: true`

## Dashboard UI

### New Comparison page (`/`)
- Input: Base URL A, Base URL B
- Slug input: textarea (one per line) OR "Fetch from sitemap" button
- Sitemap: enter URL, shows checkboxes (default: first 10 pages)
- Config: viewport, delay, threshold (collapsible advanced section)
- "Run Comparison" → progress → redirect to results

### Results page (`/runs/[id]`)
- Summary bar: X matches, Y diffs, Z errors
- Grid of pages: thumbnail, slug, mismatch %, status badge
- Click → modal with tabs: Side-by-side | Diff overlay | Slider
- Download report button (optional)

### Past runs
- List on homepage showing recent comparisons
- Delete old runs

## Tech Stack

### Dependencies
```json
{
  "dependencies": {
    "next": "^16",
    "react": "^19",
    "react-dom": "^19",
    "playwright": "^1.40",
    "pixelmatch": "^5.3",
    "pngjs": "^7",
    "fast-xml-parser": "^4"
  },
  "devDependencies": {
    "typescript": "^5",
    "@types/node": "^20",
    "@types/react": "^19",
    "tailwindcss": "^4"
  }
}
```

### Project structure
```
site-diff/
├── src/
│   ├── app/
│   │   ├── page.tsx              # New comparison form
│   │   ├── runs/[id]/page.tsx    # Results view
│   │   └── api/
│   │       ├── compare/route.ts  # Trigger comparison
│   │       ├── sitemap/route.ts  # Fetch & parse sitemap
│   │       └── runs/route.ts     # List past runs
│   ├── lib/
│   │   ├── screenshotter.ts      # Playwright logic
│   │   ├── differ.ts             # pixelmatch logic
│   │   ├── sitemap.ts            # XML parsing
│   │   └── storage.ts            # File operations (abstracted)
│   └── components/
│       ├── CompareForm.tsx
│       ├── ResultsGrid.tsx
│       └── DiffViewer.tsx        # Side-by-side/overlay/slider
├── data/                         # Gitignored, stores runs
├── Dockerfile
├── docker-compose.yml
└── package.json
```

## Docker Setup

### Dockerfile
```dockerfile
FROM mcr.microsoft.com/playwright:v1.40.0-jammy

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
```

### docker-compose.yml
```yaml
services:
  site-diff:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
```

## Future Considerations

When hosting internally:
- Swap filesystem storage for S3/cloud storage
- Replace meta.json with SQLite or Postgres
- Add basic auth or SSO integration
- CI integration for automated runs
