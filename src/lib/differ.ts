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
