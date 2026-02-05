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
