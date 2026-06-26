import { useEffect, useState, useRef } from 'react'
import api from '../api'
import { Link } from 'react-router-dom'
import { RefreshCw, FileText, AlertCircle } from 'lucide-react'
import StatusBadge from '../components/StatusBadge'

const STATUS_FILTERS = ['all', 'uploaded', 'processing', 'indexed', 'quality_review', 'approved', 'archived']
const PROCESSING_STATUSES = new Set(['uploaded', 'processing', 'indexed'])

export default function Documents() {
  const [docs, setDocs] = useState([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const pollRef = useRef(null)

  const load = async (silent = false) => {
    if (!silent) { setLoading(true); setError(null) }
    try {
      const params = filter !== 'all' ? { status: filter } : {}
      const { data } = await api.get('/api/documents', { params })
      setDocs(data.items || [])
    } catch (err) {
      if (!silent) setError(err.response?.data?.detail || 'Failed to load documents.')
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => { load() }, [filter])

  useEffect(() => {
    const hasProcessing = docs.some(d => PROCESSING_STATUSES.has(d.status))
    if (hasProcessing) {
      pollRef.current = setInterval(() => load(true), 5000)
    } else {
      clearInterval(pollRef.current)
    }
    return () => clearInterval(pollRef.current)
  }, [docs, filter])

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Documents</h1>
          <p className="text-gray-400 text-sm">{docs.length} document{docs.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => load()} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-950 border border-red-800 text-red-300 rounded-xl px-4 py-3 text-sm mb-5">
          <AlertCircle size={14} className="shrink-0" />
          {error}
        </div>
      )}

      <div className="flex gap-2 mb-5 flex-wrap">
        {STATUS_FILTERS.map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
              filter === s ? 'bg-sky-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {s.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-gray-500 text-sm">Loading...</div>
      ) : docs.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <FileText size={40} className="mx-auto mb-3 opacity-30" />
          <p>No documents found.</p>
          <Link to="/upload" className="text-sky-400 text-sm mt-2 inline-block hover:underline">Upload your first document →</Link>
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map(doc => (
            <div key={doc.id} className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-white font-medium text-sm truncate">{doc.title || 'Untitled'}</p>
                <p className="text-gray-500 text-xs mt-0.5 truncate">{doc.file_path}</p>
                {doc.extracted_summary && (
                  <p className="text-gray-400 text-xs mt-1.5 line-clamp-2">{doc.extracted_summary}</p>
                )}
                {doc.tags?.length > 0 && (
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {(doc.tags || []).slice(0, 5).map((tag, i) => (
                      <span key={i} className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded">{tag}</span>
                    ))}
                  </div>
                )}
                {PROCESSING_STATUSES.has(doc.status) && (
                  <p className="text-xs text-sky-500 mt-1.5 animate-pulse">Processing in background...</p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <StatusBadge status={doc.status} />
                <span className="text-xs text-gray-600">{doc.doc_type?.replace(/_/g, ' ')}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
