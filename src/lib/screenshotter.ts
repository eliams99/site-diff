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
    // Try original URL first, fall back to http if https fails
    let targetUrl = url
    try {
      await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 30000 })
    } catch (err) {
      const isSSLError = err instanceof Error &&
        (err.message.includes('ERR_SSL') || err.message.includes('SSL_PROTOCOL'))

      if (isSSLError && targetUrl.startsWith('https://')) {
        // Retry with http://
        targetUrl = targetUrl.replace('https://', 'http://')
        await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 30000 })
      } else {
        throw err
      }
    }

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

