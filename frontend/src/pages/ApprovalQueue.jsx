import { useEffect, useState } from 'react'
import api from '../api'
import { CheckCircle, XCircle, RefreshCw, ClipboardCheck, AlertCircle } from 'lucide-react'

export default function ApprovalQueue() {
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [processing, setProcessing] = useState({})
  const [decideError, setDecideError] = useState({})

  const load = () => {
    setLoading(true)
    setError(null)
    api.get('/api/approvals')
      .then(r => setDocs(r.data.items || []))
      .catch(err => setError(err.response?.data?.detail || 'Failed to load approval queue.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const decide = async (docId, approved) => {
    setProcessing(p => ({ ...p, [docId]: true }))
    setDecideError(e => ({ ...e, [docId]: null }))
    try {
      await api.post(`/api/approvals/${docId}`, {
        approved,
        comments: approved ? 'Approved via review queue' : 'Rejected via review queue',
      })
      setDocs(prev => prev.filter(d => d.id !== docId))
    } catch (err) {
      setDecideError(e => ({ ...e, [docId]: err.response?.data?.detail || 'Action failed. Try again.' }))
    } finally {
      setProcessing(p => ({ ...p, [docId]: false }))
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Approval Queue</h1>
          <p className="text-gray-400 text-sm">{docs.length} document{docs.length !== 1 ? 's' : ''} pending review</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-950 border border-red-800 text-red-300 rounded-xl px-4 py-3 text-sm mb-5">
          <AlertCircle size={14} className="shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-gray-500 text-sm">Loading...</div>
      ) : docs.length === 0 && !error ? (
        <div className="text-center py-16 text-gray-500">
          <ClipboardCheck size={40} className="mx-auto mb-3 opacity-30" />
          <p>No documents pending review.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {docs.map(doc => (
            <div key={doc.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-white font-medium">{doc.title || 'Untitled'}</p>
                  <p className="text-gray-500 text-xs mt-0.5">{doc.doc_type?.replace(/_/g, ' ')} · {doc.file_path}</p>
                  {doc.extracted_summary && (
                    <p className="text-gray-400 text-sm mt-2 line-clamp-3">{doc.extracted_summary}</p>
                  )}
                  {doc.tags?.length > 0 && (
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {(doc.tags || []).slice(0, 6).map((tag, i) => (
                        <span key={i} className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded">{tag}</span>
                      ))}
                    </div>
                  )}
                  {decideError[doc.id] && (
                    <p className="text-red-400 text-xs mt-2">{decideError[doc.id]}</p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => decide(doc.id, false)}
                    disabled={processing[doc.id]}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-950 border border-red-800 text-red-400 hover:bg-red-900 text-sm disabled:opacity-50 transition-colors"
                  >
                    <XCircle size={14} /> Reject
                  </button>
                  <button
                    onClick={() => decide(doc.id, true)}
                    disabled={processing[doc.id]}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-950 border border-green-800 text-green-400 hover:bg-green-900 text-sm disabled:opacity-50 transition-colors"
                  >
                    <CheckCircle size={14} /> Approve
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
