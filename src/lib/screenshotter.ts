import { chromium, Browser, Page } from 'playwright'
import type { ComparisonConfig } from './types'

let browser: Browser | null = null

async function getBrowser(): Promise<Browser> {
  if (!browser) {
    browser = await chromium.launch({
      args: ['--ignore-certificate-errors'],
    })
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
    ignoreHTTPSErrors: true,
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
