import { useEffect, useState } from 'react'
import api from '../api'
import { FileText, CheckCircle, Clock, Cpu, Layers, Wrench, AlertCircle } from 'lucide-react'

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
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    api.get('/api/stats')
      .then(r => setStats(r.data))
      .catch(err => setError(err.response?.data?.detail || 'Failed to load stats. Is the backend running?'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-white mb-1">Dashboard</h1>
      <p className="text-gray-400 text-sm mb-8">Industrial knowledge platform overview</p>

      {error && (
        <div className="flex items-center gap-2 bg-red-950 border border-red-800 text-red-300 rounded-xl px-4 py-3 text-sm mb-6">
          <AlertCircle size={14} className="shrink-0" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
        <StatCard icon={FileText}    label="Total Documents"    value={loading ? '…' : stats?.total_documents}  color="bg-sky-700" />
        <StatCard icon={CheckCircle} label="Approved"           value={loading ? '…' : stats?.approved}          color="bg-green-700" />
        <StatCard icon={Clock}       label="Pending Review"     value={loading ? '…' : stats?.pending_review}    color="bg-orange-700" />
        <StatCard icon={Cpu}         label="Processing"         value={loading ? '…' : stats?.processing}        color="bg-yellow-700" />
        <StatCard icon={Layers}      label="Knowledge Entities" value={loading ? '…' : stats?.total_entities}    color="bg-purple-700" />
        <StatCard icon={Wrench}      label="Equipment Records"  value={loading ? '…' : stats?.total_equipment}   color="bg-blue-700" />
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
