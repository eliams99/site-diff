'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

const STORAGE_KEY = 'site-diff-form'

interface FormState {
  baseUrlA: string
  baseUrlB: string
  slugsText: string
  sitemapUrl: string
}

function loadFromStorage(): FormState | null {
  if (typeof window === 'undefined') return null
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : null
  } catch {
    return null
  }
}

function saveToStorage(state: FormState) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {}
}

export default function CompareForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [mounted, setMounted] = useState(false)

  // Start with empty/default, hydrate from storage after mount
  const [baseUrlA, setBaseUrlA] = useState('')
  const [baseUrlB, setBaseUrlB] = useState('')
  const [slugsText, setSlugsText] = useState('/')
  const [sitemapUrl, setSitemapUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingSitemap, setLoadingSitemap] = useState(false)
  const [error, setError] = useState('')

  // Load from URL params or localStorage on mount
  useEffect(() => {
    const urlA = searchParams.get('baseUrlA')
    const urlB = searchParams.get('baseUrlB')
    const urlSlugs = searchParams.get('slugs')

    if (urlA || urlB || urlSlugs) {
      // URL params take priority (from "Run Again")
      if (urlA) setBaseUrlA(urlA)
      if (urlB) setBaseUrlB(urlB)
      if (urlSlugs) setSlugsText(urlSlugs.split(',').join('\n'))
    } else {
      // Fall back to localStorage
      const saved = loadFromStorage()
      if (saved) {
        setBaseUrlA(saved.baseUrlA)
        setBaseUrlB(saved.baseUrlB)
        setSlugsText(saved.slugsText)
        setSitemapUrl(saved.sitemapUrl)
      }
    }
    setMounted(true)
  }, [searchParams])

  // Save to localStorage on change
  useEffect(() => {
    if (!mounted) return
    saveToStorage({ baseUrlA, baseUrlB, slugsText, sitemapUrl })
  }, [baseUrlA, baseUrlB, slugsText, sitemapUrl, mounted])

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
