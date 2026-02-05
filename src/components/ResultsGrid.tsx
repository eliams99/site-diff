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
