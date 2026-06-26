import { useRecordAggregates, useRecords } from 'lemma-sdk/react'
import { FileText, CheckCircle, Clock, Cpu, Layers, Wrench, AlertCircle } from 'lucide-react'
import { client } from '../lemma'

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex items-center gap-4">
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div>
        <p className="text-gray-400 text-xs">{label}</p>
        <p className="text-2xl font-bold text-white">{value ?? '—'}</p>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const docAgg = useRecordAggregates({
    client,
    tableName: 'documents',
    metrics: [{ key: 'count', op: 'count' }],
    groupBy: 'status',
  })

  const entitiesRes = useRecords({ client, tableName: 'knowledge_entities', limit: 1 })
  const equipmentRes = useRecords({ client, tableName: 'equipment', limit: 1 })

  const loading = docAgg.isLoading || entitiesRes.isLoading || equipmentRes.isLoading
  const error = docAgg.error || entitiesRes.error || equipmentRes.error

  const rows = docAgg.rows ?? []
  const byStatus = (s) => Number(rows.find(r => r.status === s)?.count ?? 0)
  const processingStatuses = ['uploaded', 'processing', 'indexed']
  const totalDocs = rows.reduce((sum, r) => sum + Number(r.count ?? 0), 0)
  const approved = byStatus('approved')
  const pending = byStatus('quality_review')
  const processing = rows
    .filter(r => processingStatuses.includes(r.status))
    .reduce((sum, r) => sum + Number(r.count ?? 0), 0)

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-white mb-1">Dashboard</h1>
      <p className="text-gray-400 text-sm mb-8">Industrial knowledge platform overview</p>

      {error && (
        <div className="flex items-center gap-2 bg-red-950 border border-red-800 text-red-300 rounded-xl px-4 py-3 text-sm mb-6">
          <AlertCircle size={14} className="shrink-0" />
          {error.message || 'Failed to load stats.'}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
        <StatCard icon={FileText}    label="Total Documents"    value={loading ? '…' : totalDocs}              color="bg-sky-700" />
        <StatCard icon={CheckCircle} label="Approved"           value={loading ? '…' : approved}               color="bg-green-700" />
        <StatCard icon={Clock}       label="Pending Review"     value={loading ? '…' : pending}                color="bg-orange-700" />
        <StatCard icon={Cpu}         label="Processing"         value={loading ? '…' : processing}             color="bg-yellow-700" />
        <StatCard icon={Layers}      label="Knowledge Entities" value={loading ? '…' : entitiesRes.total}      color="bg-purple-700" />
        <StatCard icon={Wrench}      label="Equipment Records"  value={loading ? '…' : equipmentRes.total}     color="bg-blue-700" />
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="text-white font-semibold mb-3">How it works</h2>
        <ol className="space-y-2 text-sm text-gray-400">
          {[
            'Upload industrial documents (PDFs, manuals, SOPs, drawings)',
            'AI classifies, summarizes, and extracts structured knowledge entities',
            'Human reviewers approve or reject extracted knowledge',
            'Engineers query the knowledge base in plain English with citations',
          ].map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="text-sky-400 font-bold">{i + 1}.</span>
              {step}
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
