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
              <div className="relative border rounded">
                {/* Image B (background) */}
                <img src={imgB} alt="Version B" className="w-full block" />
                {/* Image A (foreground, clipped) */}
                <img
                  src={imgA}
                  alt="Version A"
                  className="absolute top-0 left-0 w-full block"
                  style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
                />
                {/* Slider handle */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-blue-500 cursor-ew-resize"
                  style={{ left: `${sliderPos}%` }}
                >
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center shadow-lg">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                    </svg>
                  </div>
                </div>
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
