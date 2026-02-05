import { NextRequest, NextResponse } from 'next/server'
import { nanoid } from 'nanoid'
import { ensureRunDir, saveMetadata, getDiffPath } from '@/lib/storage'
import { screenshotPages, closeBrowser } from '@/lib/screenshotter'
import { diffImages, determineStatus } from '@/lib/differ'
import type { ComparisonRun, ComparisonConfig, PageResult } from '@/lib/types'

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
