import { NextRequest, NextResponse } from 'next/server'
import { getMetadata, deleteRun, saveMetadata } from '@/lib/storage'

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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const run = await getMetadata(id)
  if (!run) {
    return NextResponse.json({ error: 'Run not found' }, { status: 404 })
  }

  const { slug, checked } = await request.json()
  const result = run.results.find((r) => r.slug === slug)
  if (!result) {
    return NextResponse.json({ error: 'Slug not found' }, { status: 404 })
  }

  result.checked = Boolean(checked)
  await saveMetadata(run)
  return NextResponse.json({ ok: true })
}
