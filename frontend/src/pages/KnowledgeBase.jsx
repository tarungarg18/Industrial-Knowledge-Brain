import { useState } from 'react'
import { useRecords } from 'lemma-sdk/react'
import { Database, Search, AlertCircle } from 'lucide-react'
import { client } from '../lemma'

const ENTITY_TYPES = ['all', 'equipment', 'part', 'procedure_step', 'specification', 'safety_rule', 'parameter', 'chemical', 'tool', 'warning']

const TYPE_COLORS = {
  equipment:      'bg-blue-900 text-blue-300',
  part:           'bg-purple-900 text-purple-300',
  procedure_step: 'bg-green-900 text-green-300',
  specification:  'bg-sky-900 text-sky-300',
  safety_rule:    'bg-red-900 text-red-300',
  parameter:      'bg-yellow-900 text-yellow-300',
  chemical:       'bg-orange-900 text-orange-300',
  tool:           'bg-teal-900 text-teal-300',
  warning:        'bg-rose-900 text-rose-300',
}

export default function KnowledgeBase() {
  const [tab, setTab] = useState('entities')
  const [typeFilter, setTypeFilter] = useState('all')
  const [search, setSearch] = useState('')

  const entitiesRes = useRecords({
    client,
    tableName: 'knowledge_entities',
    filters: typeFilter !== 'all' ? [{ field: 'entity_type', op: 'eq', value: typeFilter }] : [],
    sort: [{ field: 'confidence', direction: 'desc' }],
    limit: 300,
  })

  const equipmentRes = useRecords({
    client,
    tableName: 'equipment',
    sort: [{ field: 'name', direction: 'asc' }],
    limit: 300,
  })

  const switchTab = (t) => { setTab(t); setSearch('') }

  const source = tab === 'entities' ? entitiesRes.records : equipmentRes.records
  const isLoading = tab === 'entities' ? entitiesRes.isLoading : equipmentRes.isLoading
  const error = tab === 'entities' ? entitiesRes.error : equipmentRes.error

  const filtered = source.filter(item => {
    if (!search) return true
    const s = search.toLowerCase()
    return (item.name || '').toLowerCase().includes(s) || (item.description || '').toLowerCase().includes(s)
  })

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-white mb-1">Knowledge Base</h1>
      <p className="text-gray-400 text-sm mb-6">Extracted structured knowledge from all approved documents.</p>

      {error && (
        <div className="flex items-center gap-2 bg-red-950 border border-red-800 text-red-300 rounded-xl px-4 py-3 text-sm mb-5">
          <AlertCircle size={14} className="shrink-0" />
          {error.message || 'Failed to load knowledge base.'}
        </div>
      )}

      <div className="flex gap-4 mb-5 items-center">
        <div className="flex gap-1">
          {['entities', 'equipment'].map(t => (
            <button
              key={t}
              onClick={() => switchTab(t)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === t ? 'bg-sky-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search..."
            className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-8 pr-3 py-1.5 text-sm text-white focus:outline-none focus:border-sky-500"
          />
        </div>
      </div>

      {tab === 'entities' && (
        <div className="flex gap-2 mb-4 flex-wrap">
          {ENTITY_TYPES.map(t => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                typeFilter === t ? 'bg-sky-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {t.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="text-gray-500 text-sm">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <Database size={40} className="mx-auto mb-3 opacity-30" />
          <p>{search ? `No ${tab} match "${search}".` : `No ${tab} found. Upload and approve documents to populate the knowledge base.`}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {filtered.map((item, i) => (
            <div key={item.id || i} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <p className="text-white text-sm font-medium">{item.name}</p>
                <span className={`text-xs px-2 py-0.5 rounded shrink-0 ${
                  tab === 'entities'
                    ? (TYPE_COLORS[item.entity_type] || 'bg-gray-700 text-gray-400')
                    : 'bg-blue-900 text-blue-300'
                }`}>
                  {tab === 'entities' ? (item.entity_type?.replace(/_/g, ' ') || 'unknown') : item.category}
                </span>
              </div>
              {item.description && (
                <p className="text-gray-400 text-xs line-clamp-2">{item.description}</p>
              )}
              {tab === 'entities' && item.source_page && (
                <p className="text-gray-600 text-xs mt-1.5">Page {item.source_page}</p>
              )}
              {tab === 'equipment' && (item.manufacturer || item.model) && (
                <p className="text-gray-500 text-xs mt-1">{[item.manufacturer, item.model].filter(Boolean).join(' · ')}</p>
              )}
              {item.confidence && (
                <div className="mt-2 flex items-center gap-1.5">
                  <div className="flex-1 bg-gray-800 rounded-full h-1">
                    <div className="bg-sky-600 h-1 rounded-full" style={{ width: `${Math.round(item.confidence * 100)}%` }} />
                  </div>
                  <span className="text-gray-600 text-xs">{Math.round(item.confidence * 100)}%</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
