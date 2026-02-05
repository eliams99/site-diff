# Site Diff Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a visual diff tool that compares screenshots between two base URLs and displays results in a dashboard.

**Architecture:** Next.js 16 app with Playwright for screenshots, pixelmatch for diffing, filesystem storage. API routes handle comparison logic, React components display results.

**Tech Stack:** Next.js 16, React 19, Playwright, pixelmatch, pngjs, fast-xml-parser, Tailwind CSS 4, TypeScript

---

### Task 1: Project Setup

**Files:**
- Modify: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `src/app/globals.css`
- Create: `.gitignore`

**Step 1: Install dependencies**

Run:
```bash
npm install next@latest react@latest react-dom@latest playwright pixelmatch pngjs fast-xml-parser
npm install -D typescript @types/node @types/react @types/react-dom tailwindcss @tailwindcss/postcss postcss
```

**Step 2: Install Playwright browsers**

Run:
```bash
npx playwright install chromium
```

**Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

**Step 4: Create next.config.ts**

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['playwright'],
}

export default nextConfig
```

**Step 5: Create postcss.config.mjs**

```javascript
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
```

**Step 6: Create src/app/globals.css**

```css
@import "tailwindcss";
```

**Step 7: Create src/app/layout.tsx**

```tsx
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Site Diff',
  description: 'Visual comparison tool for websites',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50 min-h-screen">{children}</body>
    </html>
  )
}
```

**Step 8: Create src/app/page.tsx (placeholder)**

```tsx
export default function Home() {
  return (
    <main className="container mx-auto p-8">
      <h1 className="text-3xl font-bold">Site Diff</h1>
      <p className="text-gray-600 mt-2">Visual comparison tool</p>
    </main>
  )
}
```

**Step 9: Update .gitignore**

```
node_modules
.next
data/
*.tsbuildinfo
next-env.d.ts
```

**Step 10: Verify setup**

Run: `npm run dev`
Expected: App runs at localhost:3000, shows "Site Diff" heading

**Step 11: Commit**

```bash
git add -A
git commit -m "chore: initial next.js 16 setup with tailwind"
```

---

### Task 2: Storage Layer

**Files:**
- Create: `src/lib/storage.ts`
- Create: `src/lib/types.ts`

**Step 1: Create src/lib/types.ts**

```typescript
export interface ComparisonConfig {
  viewport: { width: number; height: number }
  fullPage: boolean
  delay: number
  threshold: number
  hideSelectors?: string[]
}

export interface PageResult {
  slug: string
  mismatchPixels: number
  mismatchPercent: number
  status: 'match' | 'diff' | 'error'
  sizeDiff: boolean
  error?: string
}

export interface ComparisonRun {
  id: string
  baseUrlA: string
  baseUrlB: string
  createdAt: string
  config: ComparisonConfig
  results: PageResult[]
  status: 'running' | 'completed' | 'failed'
}

export const DEFAULT_CONFIG: ComparisonConfig = {
  viewport: { width: 1280, height: 720 },
  fullPage: true,
  delay: 500,
  threshold: 0.1,
}
```

**Step 2: Create src/lib/storage.ts**

```typescript
import { promises as fs } from 'fs'
import path from 'path'
import type { ComparisonRun } from './types'

const DATA_DIR = path.join(process.cwd(), 'data', 'runs')

export async function ensureRunDir(runId: string): Promise<string> {
  const runDir = path.join(DATA_DIR, runId)
  await fs.mkdir(path.join(runDir, 'screenshots', 'a'), { recursive: true })
  await fs.mkdir(path.join(runDir, 'screenshots', 'b'), { recursive: true })
  await fs.mkdir(path.join(runDir, 'diffs'), { recursive: true })
  return runDir
}

export async function saveMetadata(run: ComparisonRun): Promise<void> {
  const metaPath = path.join(DATA_DIR, run.id, 'meta.json')
  await fs.writeFile(metaPath, JSON.stringify(run, null, 2))
}

export async function getMetadata(runId: string): Promise<ComparisonRun | null> {
  try {
    const metaPath = path.join(DATA_DIR, runId, 'meta.json')
    const content = await fs.readFile(metaPath, 'utf-8')
    return JSON.parse(content)
  } catch {
    return null
  }
}

export async function listRuns(): Promise<ComparisonRun[]> {
  try {
    const dirs = await fs.readdir(DATA_DIR)
    const runs: ComparisonRun[] = []
    for (const dir of dirs) {
      const meta = await getMetadata(dir)
      if (meta) runs.push(meta)
    }
    return runs.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  } catch {
    return []
  }
}

export async function deleteRun(runId: string): Promise<void> {
  const runDir = path.join(DATA_DIR, runId)
  await fs.rm(runDir, { recursive: true, force: true })
}

export function getScreenshotPath(runId: string, side: 'a' | 'b', slug: string): string {
  const filename = slugToFilename(slug)
  return path.join(DATA_DIR, runId, 'screenshots', side, filename)
}

export function getDiffPath(runId: string, slug: string): string {
  const filename = slugToFilename(slug)
  return path.join(DATA_DIR, runId, 'diffs', filename)
}

function slugToFilename(slug: string): string {
  const name = slug === '/' ? 'home' : slug.replace(/^\//, '').replace(/\//g, '-')
  return `${name}.png`
}
```

**Step 3: Commit**

```bash
git add src/lib/types.ts src/lib/storage.ts
git commit -m "feat(lib): add storage layer and types"
```

---

### Task 3: Screenshot Engine

**Files:**
- Create: `src/lib/screenshotter.ts`

**Step 1: Create src/lib/screenshotter.ts**

```typescript
import { chromium, Browser, Page } from 'playwright'
import type { ComparisonConfig } from './types'

let browser: Browser | null = null

async function getBrowser(): Promise<Browser> {
  if (!browser) {
    browser = await chromium.launch()
  }
  return browser
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close()
    browser = null
  }
}

export async function takeScreenshot(
  url: string,
  outputPath: string,
  config: ComparisonConfig
): Promise<void> {
  const b = await getBrowser()
  const context = await b.newContext({
    viewport: config.viewport,
  })
  const page = await context.newPage()

  try {
    await page.goto(url, { waitUntil: 'networkidle' })

    if (config.hideSelectors?.length) {
      await hideElements(page, config.hideSelectors)
    }

    if (config.delay > 0) {
      await page.waitForTimeout(config.delay)
    }

    await page.screenshot({
      path: outputPath,
      fullPage: config.fullPage,
    })
  } finally {
    await context.close()
  }
}

async function hideElements(page: Page, selectors: string[]): Promise<void> {
  for (const selector of selectors) {
    await page.evaluate((sel) => {
      document.querySelectorAll(sel).forEach((el) => {
        ;(el as HTMLElement).style.visibility = 'hidden'
      })
    }, selector)
  }
}

export async function screenshotPages(
  baseUrl: string,
  slugs: string[],
  outputDir: string,
  config: ComparisonConfig,
  onProgress?: (slug: string, index: number) => void
): Promise<Map<string, string | Error>> {
  const results = new Map<string, string | Error>()

  for (let i = 0; i < slugs.length; i++) {
    const slug = slugs[i]
    const url = new URL(slug, baseUrl).toString()
    const filename = slug === '/' ? 'home.png' : `${slug.replace(/^\//, '').replace(/\//g, '-')}.png`
    const outputPath = `${outputDir}/${filename}`

    onProgress?.(slug, i)

    try {
      await takeScreenshot(url, outputPath, config)
      results.set(slug, outputPath)
    } catch (error) {
      results.set(slug, error instanceof Error ? error : new Error(String(error)))
    }
  }

  return results
}
```

**Step 2: Commit**

```bash
git add src/lib/screenshotter.ts
git commit -m "feat(lib): add playwright screenshot engine"
```

---

### Task 4: Diff Engine

**Files:**
- Create: `src/lib/differ.ts`

**Step 1: Create src/lib/differ.ts**

```typescript
import { promises as fs } from 'fs'
import { PNG } from 'pngjs'
import pixelmatch from 'pixelmatch'
import type { PageResult } from './types'

export interface DiffResult {
  mismatchPixels: number
  mismatchPercent: number
  sizeDiff: boolean
}

export async function diffImages(
  imgPathA: string,
  imgPathB: string,
  diffOutputPath: string,
  threshold: number = 0.1
): Promise<DiffResult> {
  const [bufferA, bufferB] = await Promise.all([
    fs.readFile(imgPathA),
    fs.readFile(imgPathB),
  ])

  const imgA = PNG.sync.read(bufferA)
  const imgB = PNG.sync.read(bufferB)

  const sizeDiff = imgA.width !== imgB.width || imgA.height !== imgB.height

  // Use larger dimensions for comparison
  const width = Math.max(imgA.width, imgB.width)
  const height = Math.max(imgA.height, imgB.height)

  // Pad images if needed
  const paddedA = padImage(imgA, width, height)
  const paddedB = padImage(imgB, width, height)

  const diff = new PNG({ width, height })

  const mismatchPixels = pixelmatch(
    paddedA.data,
    paddedB.data,
    diff.data,
    width,
    height,
    { threshold }
  )

  await fs.writeFile(diffOutputPath, PNG.sync.write(diff))

  const totalPixels = width * height
  const mismatchPercent = (mismatchPixels / totalPixels) * 100

  return { mismatchPixels, mismatchPercent, sizeDiff }
}

function padImage(img: PNG, targetWidth: number, targetHeight: number): PNG {
  if (img.width === targetWidth && img.height === targetHeight) {
    return img
  }

  const padded = new PNG({ width: targetWidth, height: targetHeight, fill: true })

  // Fill with white
  for (let i = 0; i < padded.data.length; i += 4) {
    padded.data[i] = 255     // R
    padded.data[i + 1] = 255 // G
    padded.data[i + 2] = 255 // B
    padded.data[i + 3] = 255 // A
  }

  // Copy original image
  PNG.bitblt(img, padded, 0, 0, img.width, img.height, 0, 0)

  return padded
}

export function determineStatus(mismatchPercent: number): PageResult['status'] {
  // Less than 0.05% is considered a match (anti-aliasing noise)
  return mismatchPercent < 0.05 ? 'match' : 'diff'
}
```

**Step 2: Commit**

```bash
git add src/lib/differ.ts
git commit -m "feat(lib): add pixelmatch diff engine"
```

---

### Task 5: Sitemap Parser

**Files:**
- Create: `src/lib/sitemap.ts`

**Step 1: Create src/lib/sitemap.ts**

```typescript
import { XMLParser } from 'fast-xml-parser'

interface SitemapUrl {
  loc: string
  lastmod?: string
  priority?: number
}

export async function fetchSitemap(sitemapUrl: string): Promise<string[]> {
  const response = await fetch(sitemapUrl)
  if (!response.ok) {
    throw new Error(`Failed to fetch sitemap: ${response.status}`)
  }

  const xml = await response.text()
  return parseSitemap(xml, sitemapUrl)
}

export function parseSitemap(xml: string, baseUrl: string): string[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
  })

  const result = parser.parse(xml)
  const urls: string[] = []

  // Handle standard sitemap
  if (result.urlset?.url) {
    const urlList = Array.isArray(result.urlset.url)
      ? result.urlset.url
      : [result.urlset.url]

    for (const item of urlList) {
      const loc = item.loc
      if (loc) {
        urls.push(urlToSlug(loc, baseUrl))
      }
    }
  }

  // Handle sitemap index
  if (result.sitemapindex?.sitemap) {
    // For sitemap index, we'd need to fetch each child sitemap
    // For now, just return empty and let user know
    console.warn('Sitemap index detected - only direct sitemaps supported')
  }

  return urls
}

function urlToSlug(fullUrl: string, baseUrl: string): string {
  try {
    const url = new URL(fullUrl)
    const base = new URL(baseUrl)

    // If same origin, return pathname
    if (url.origin === base.origin) {
      return url.pathname || '/'
    }

    // Otherwise return full URL as slug
    return url.pathname || '/'
  } catch {
    return fullUrl
  }
}
```

**Step 2: Commit**

```bash
git add src/lib/sitemap.ts
git commit -m "feat(lib): add sitemap parser"
```

---

### Task 6: Comparison API Route

**Files:**
- Create: `src/app/api/compare/route.ts`

**Step 1: Create src/app/api/compare/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { nanoid } from 'nanoid'
import { ensureRunDir, saveMetadata, getScreenshotPath, getDiffPath } from '@/lib/storage'
import { screenshotPages, closeBrowser } from '@/lib/screenshotter'
import { diffImages, determineStatus } from '@/lib/differ'
import type { ComparisonRun, ComparisonConfig, PageResult, DEFAULT_CONFIG } from '@/lib/types'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { baseUrlA, baseUrlB, slugs, config: userConfig } = body

  if (!baseUrlA || !baseUrlB || !slugs?.length) {
    return NextResponse.json(
      { error: 'Missing required fields: baseUrlA, baseUrlB, slugs' },
      { status: 400 }
    )
  }

  const runId = `${new Date().toISOString().split('T')[0]}-${nanoid(8)}`
  const config: ComparisonConfig = {
    viewport: userConfig?.viewport || { width: 1280, height: 720 },
    fullPage: userConfig?.fullPage ?? true,
    delay: userConfig?.delay ?? 500,
    threshold: userConfig?.threshold ?? 0.1,
    hideSelectors: userConfig?.hideSelectors,
  }

  const run: ComparisonRun = {
    id: runId,
    baseUrlA,
    baseUrlB,
    createdAt: new Date().toISOString(),
    config,
    results: [],
    status: 'running',
  }

  try {
    const runDir = await ensureRunDir(runId)
    await saveMetadata(run)

    // Screenshot both sites
    const [resultsA, resultsB] = await Promise.all([
      screenshotPages(baseUrlA, slugs, `${runDir}/screenshots/a`, config),
      screenshotPages(baseUrlB, slugs, `${runDir}/screenshots/b`, config),
    ])

    // Diff each page
    const results: PageResult[] = []
    for (const slug of slugs) {
      const pathA = resultsA.get(slug)
      const pathB = resultsB.get(slug)

      if (pathA instanceof Error || pathB instanceof Error) {
        results.push({
          slug,
          mismatchPixels: 0,
          mismatchPercent: 0,
          status: 'error',
          sizeDiff: false,
          error: pathA instanceof Error ? pathA.message : pathB instanceof Error ? (pathB as Error).message : undefined,
        })
        continue
      }

      if (typeof pathA === 'string' && typeof pathB === 'string') {
        const diffPath = getDiffPath(runId, slug)
        const diffResult = await diffImages(pathA, pathB, diffPath, config.threshold)

        results.push({
          slug,
          mismatchPixels: diffResult.mismatchPixels,
          mismatchPercent: diffResult.mismatchPercent,
          status: determineStatus(diffResult.mismatchPercent),
          sizeDiff: diffResult.sizeDiff,
        })
      }
    }

    run.results = results
    run.status = 'completed'
    await saveMetadata(run)
    await closeBrowser()

    return NextResponse.json(run)
  } catch (error) {
    run.status = 'failed'
    await saveMetadata(run)
    await closeBrowser()

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
```

**Step 2: Add nanoid dependency**

Run: `npm install nanoid`

**Step 3: Commit**

```bash
git add src/app/api/compare/route.ts package.json package-lock.json
git commit -m "feat(api): add comparison endpoint"
```

---

### Task 7: Sitemap & Runs API Routes

**Files:**
- Create: `src/app/api/sitemap/route.ts`
- Create: `src/app/api/runs/route.ts`
- Create: `src/app/api/runs/[id]/route.ts`

**Step 1: Create src/app/api/sitemap/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { fetchSitemap } from '@/lib/sitemap'

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')

  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 })
  }

  try {
    const slugs = await fetchSitemap(url)
    return NextResponse.json({ slugs })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch sitemap' },
      { status: 500 }
    )
  }
}
```

**Step 2: Create src/app/api/runs/route.ts**

```typescript
import { NextResponse } from 'next/server'
import { listRuns } from '@/lib/storage'

export async function GET() {
  const runs = await listRuns()
  return NextResponse.json(runs)
}
```

**Step 3: Create src/app/api/runs/[id]/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getMetadata, deleteRun } from '@/lib/storage'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const run = await getMetadata(id)

  if (!run) {
    return NextResponse.json({ error: 'Run not found' }, { status: 404 })
  }

  return NextResponse.json(run)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    await deleteRun(id)
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete run' }, { status: 500 })
  }
}
```

**Step 4: Commit**

```bash
git add src/app/api/sitemap/route.ts src/app/api/runs/route.ts src/app/api/runs/\[id\]/route.ts
git commit -m "feat(api): add sitemap and runs endpoints"
```

---

### Task 8: Image Serving Route

**Files:**
- Create: `src/app/api/image/[...path]/route.ts`

**Step 1: Create src/app/api/image/[...path]/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: pathSegments } = await params
  const imagePath = path.join(process.cwd(), 'data', 'runs', ...pathSegments)

  try {
    const buffer = await fs.readFile(imagePath)
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=31536000',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Image not found' }, { status: 404 })
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/image/\[...path\]/route.ts
git commit -m "feat(api): add image serving endpoint"
```

---

### Task 9: Compare Form Component

**Files:**
- Create: `src/components/CompareForm.tsx`

**Step 1: Create src/components/CompareForm.tsx**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function CompareForm() {
  const router = useRouter()
  const [baseUrlA, setBaseUrlA] = useState('')
  const [baseUrlB, setBaseUrlB] = useState('')
  const [slugsText, setSlugsText] = useState('/')
  const [sitemapUrl, setSitemapUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingSitemap, setLoadingSitemap] = useState(false)
  const [error, setError] = useState('')

  const handleFetchSitemap = async () => {
    if (!sitemapUrl) return
    setLoadingSitemap(true)
    setError('')

    try {
      const res = await fetch(`/api/sitemap?url=${encodeURIComponent(sitemapUrl)}`)
      const data = await res.json()

      if (data.error) {
        setError(data.error)
      } else {
        // Take first 10 slugs
        const slugs = data.slugs.slice(0, 10)
        setSlugsText(slugs.join('\n'))
      }
    } catch (e) {
      setError('Failed to fetch sitemap')
    } finally {
      setLoadingSitemap(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const slugs = slugsText
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean)

    try {
      const res = await fetch('/api/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseUrlA, baseUrlB, slugs }),
      })

      const data = await res.json()

      if (data.error) {
        setError(data.error)
        setLoading(false)
      } else {
        router.push(`/runs/${data.id}`)
      }
    } catch (e) {
      setError('Failed to start comparison')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Base URL A (e.g., staging)
          </label>
          <input
            type="url"
            value={baseUrlA}
            onChange={(e) => setBaseUrlA(e.target.value)}
            placeholder="https://staging.example.com"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Base URL B (e.g., production)
          </label>
          <input
            type="url"
            value={baseUrlB}
            onChange={(e) => setBaseUrlB(e.target.value)}
            placeholder="https://example.com"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Pages to compare (one slug per line)
        </label>
        <textarea
          value={slugsText}
          onChange={(e) => setSlugsText(e.target.value)}
          rows={6}
          placeholder={"/\n/about\n/contact"}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
        />
      </div>

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Or fetch from sitemap
          </label>
          <input
            type="url"
            value={sitemapUrl}
            onChange={(e) => setSitemapUrl(e.target.value)}
            placeholder="https://example.com/sitemap.xml"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          type="button"
          onClick={handleFetchSitemap}
          disabled={loadingSitemap || !sitemapUrl}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50"
        >
          {loadingSitemap ? 'Fetching...' : 'Fetch'}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !baseUrlA || !baseUrlB}
        className="w-full py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 font-medium"
      >
        {loading ? 'Running comparison...' : 'Run Comparison'}
      </button>
    </form>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/CompareForm.tsx
git commit -m "feat(ui): add comparison form component"
```

---

### Task 10: Results Grid Component

**Files:**
- Create: `src/components/ResultsGrid.tsx`

**Step 1: Create src/components/ResultsGrid.tsx**

```tsx
'use client'

import { useState } from 'react'
import type { ComparisonRun, PageResult } from '@/lib/types'
import DiffViewer from './DiffViewer'

interface Props {
  run: ComparisonRun
}

export default function ResultsGrid({ run }: Props) {
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null)

  const matches = run.results.filter(r => r.status === 'match').length
  const diffs = run.results.filter(r => r.status === 'diff').length
  const errors = run.results.filter(r => r.status === 'error').length

  return (
    <div>
      {/* Summary bar */}
      <div className="flex gap-4 mb-6 p-4 bg-white rounded-lg shadow-sm">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-green-500" />
          <span className="text-sm">{matches} matches</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-red-500" />
          <span className="text-sm">{diffs} diffs</span>
        </div>
        {errors > 0 && (
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-yellow-500" />
            <span className="text-sm">{errors} errors</span>
          </div>
        )}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {run.results.map((result) => (
          <ResultCard
            key={result.slug}
            result={result}
            runId={run.id}
            onClick={() => setSelectedSlug(result.slug)}
          />
        ))}
      </div>

      {/* Modal */}
      {selectedSlug && (
        <DiffViewer
          runId={run.id}
          slug={selectedSlug}
          result={run.results.find(r => r.slug === selectedSlug)!}
          baseUrlA={run.baseUrlA}
          baseUrlB={run.baseUrlB}
          onClose={() => setSelectedSlug(null)}
        />
      )}
    </div>
  )
}

function ResultCard({
  result,
  runId,
  onClick
}: {
  result: PageResult
  runId: string
  onClick: () => void
}) {
  const filename = result.slug === '/' ? 'home.png' : `${result.slug.replace(/^\//, '').replace(/\//g, '-')}.png`
  const diffUrl = `/api/image/${runId}/diffs/${filename}`

  const statusColors = {
    match: 'border-green-500 bg-green-50',
    diff: 'border-red-500 bg-red-50',
    error: 'border-yellow-500 bg-yellow-50',
  }

  return (
    <button
      onClick={onClick}
      className={`p-3 rounded-lg border-2 ${statusColors[result.status]} hover:shadow-md transition-shadow text-left`}
    >
      {result.status !== 'error' && (
        <div className="aspect-video bg-gray-100 rounded mb-2 overflow-hidden">
          <img
            src={diffUrl}
            alt={`Diff for ${result.slug}`}
            className="w-full h-full object-cover object-top"
          />
        </div>
      )}
      <div className="font-mono text-sm truncate">{result.slug}</div>
      <div className="text-xs text-gray-500 mt-1">
        {result.status === 'error'
          ? result.error
          : `${result.mismatchPercent.toFixed(2)}% diff`}
      </div>
      {result.sizeDiff && (
        <div className="text-xs text-yellow-600 mt-1">Size differs</div>
      )}
    </button>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/ResultsGrid.tsx
git commit -m "feat(ui): add results grid component"
```

---

### Task 11: Diff Viewer Modal

**Files:**
- Create: `src/components/DiffViewer.tsx`

**Step 1: Create src/components/DiffViewer.tsx**

```tsx
'use client'

import { useState } from 'react'
import type { PageResult } from '@/lib/types'

interface Props {
  runId: string
  slug: string
  result: PageResult
  baseUrlA: string
  baseUrlB: string
  onClose: () => void
}

type ViewMode = 'side-by-side' | 'diff' | 'slider'

export default function DiffViewer({ runId, slug, result, baseUrlA, baseUrlB, onClose }: Props) {
  const [mode, setMode] = useState<ViewMode>('side-by-side')
  const [sliderPos, setSliderPos] = useState(50)

  const filename = slug === '/' ? 'home.png' : `${slug.replace(/^\//, '').replace(/\//g, '-')}.png`
  const imgA = `/api/image/${runId}/screenshots/a/${filename}`
  const imgB = `/api/image/${runId}/screenshots/b/${filename}`
  const imgDiff = `/api/image/${runId}/diffs/${filename}`

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="font-mono text-lg">{slug}</h2>
            <span className="text-sm text-gray-500">
              {result.mismatchPercent.toFixed(2)}% difference
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-md"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 p-4 border-b">
          {(['side-by-side', 'diff', 'slider'] as ViewMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                mode === m
                  ? 'bg-blue-100 text-blue-700'
                  : 'hover:bg-gray-100'
              }`}
            >
              {m === 'side-by-side' ? 'Side by Side' : m === 'diff' ? 'Diff Overlay' : 'Slider'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {mode === 'side-by-side' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-500 mb-2 truncate">{baseUrlA}</div>
                <img src={imgA} alt="Version A" className="w-full border rounded" />
              </div>
              <div>
                <div className="text-sm text-gray-500 mb-2 truncate">{baseUrlB}</div>
                <img src={imgB} alt="Version B" className="w-full border rounded" />
              </div>
            </div>
          )}

          {mode === 'diff' && (
            <div className="flex justify-center">
              <img src={imgDiff} alt="Diff" className="max-w-full border rounded" />
            </div>
          )}

          {mode === 'slider' && (
            <div className="relative select-none">
              <div className="relative overflow-hidden border rounded">
                <img src={imgB} alt="Version B" className="w-full" />
                <div
                  className="absolute top-0 left-0 h-full overflow-hidden"
                  style={{ width: `${sliderPos}%` }}
                >
                  <img
                    src={imgA}
                    alt="Version A"
                    className="h-full object-cover object-left"
                    style={{ width: `${100 / (sliderPos / 100)}%` }}
                  />
                </div>
                <div
                  className="absolute top-0 bottom-0 w-1 bg-blue-500 cursor-ew-resize"
                  style={{ left: `${sliderPos}%` }}
                />
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={sliderPos}
                onChange={(e) => setSliderPos(Number(e.target.value))}
                className="w-full mt-4"
              />
              <div className="flex justify-between text-sm text-gray-500">
                <span>A: {baseUrlA}</span>
                <span>B: {baseUrlB}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/DiffViewer.tsx
git commit -m "feat(ui): add diff viewer modal with 3 view modes"
```

---

### Task 12: Home Page with Form and Past Runs

**Files:**
- Modify: `src/app/page.tsx`

**Step 1: Update src/app/page.tsx**

```tsx
import CompareForm from '@/components/CompareForm'
import { listRuns } from '@/lib/storage'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const runs = await listRuns()

  return (
    <main className="container mx-auto p-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-2">Site Diff</h1>
      <p className="text-gray-600 mb-8">Visual comparison tool for websites</p>

      <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">New Comparison</h2>
        <CompareForm />
      </div>

      {runs.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold mb-4">Past Runs</h2>
          <div className="space-y-2">
            {runs.map((run) => {
              const matches = run.results.filter(r => r.status === 'match').length
              const diffs = run.results.filter(r => r.status === 'diff').length

              return (
                <Link
                  key={run.id}
                  href={`/runs/${run.id}`}
                  className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-md border"
                >
                  <div>
                    <div className="font-medium text-sm">{run.id}</div>
                    <div className="text-xs text-gray-500">
                      {run.baseUrlA} vs {run.baseUrlB}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-green-600">{matches} ✓</span>
                    <span className="text-red-600">{diffs} ✗</span>
                    <span className="text-gray-400">
                      {new Date(run.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </main>
  )
}
```

**Step 2: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(ui): update home page with form and past runs"
```

---

### Task 13: Results Page

**Files:**
- Create: `src/app/runs/[id]/page.tsx`

**Step 1: Create src/app/runs/[id]/page.tsx**

```tsx
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getMetadata } from '@/lib/storage'
import ResultsGrid from '@/components/ResultsGrid'

export const dynamic = 'force-dynamic'

export default async function RunPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const run = await getMetadata(id)

  if (!run) {
    notFound()
  }

  return (
    <main className="container mx-auto p-8">
      <div className="mb-6">
        <Link href="/" className="text-blue-600 hover:underline text-sm">
          ← Back to home
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold">{run.id}</h1>
        <div className="text-gray-600 text-sm mt-1">
          {run.baseUrlA} vs {run.baseUrlB}
        </div>
        <div className="text-gray-400 text-xs mt-1">
          {new Date(run.createdAt).toLocaleString()}
        </div>
      </div>

      <ResultsGrid run={run} />
    </main>
  )
}
```

**Step 2: Commit**

```bash
git add src/app/runs/\[id\]/page.tsx
git commit -m "feat(ui): add results page"
```

---

### Task 14: Docker Setup

**Files:**
- Create: `Dockerfile`
- Create: `docker-compose.yml`

**Step 1: Create Dockerfile**

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

**Step 2: Create docker-compose.yml**

```yaml
services:
  site-diff:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
```

**Step 3: Update package.json scripts**

Add to package.json scripts:
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  }
}
```

**Step 4: Commit**

```bash
git add Dockerfile docker-compose.yml package.json
git commit -m "chore: add docker setup"
```

---

### Task 15: Final Verification

**Step 1: Run dev server**

Run: `npm run dev`
Expected: Server starts at localhost:3000

**Step 2: Test comparison flow**

1. Open localhost:3000
2. Enter two URLs (e.g., https://example.com and https://example.org)
3. Add slug: /
4. Click "Run Comparison"
5. Should redirect to results page with diff

**Step 3: Verify Docker build**

Run: `docker compose build`
Expected: Image builds successfully

**Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: final adjustments"
```
