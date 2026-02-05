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
