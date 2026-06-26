import { useState, useRef, useEffect } from 'react'
import api from '../api'
import { Send, User, AlertCircle, Zap, Brain, FileText, ExternalLink, BookOpen } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

const EXAMPLE_QUESTIONS = [
  'What causes a pump to fail to supply pressure?',
  'What safety precautions apply to hydraulic systems?',
  'What are the specifications for the CP-15 pump?',
  'Explain the air bleeding procedure.',
]


function MarkdownAnswer({ content }) {
  return (
    <ReactMarkdown
      components={{
        h1: ({ children }) => <h1 className="text-base font-bold text-white mt-4 mb-2 border-b border-gray-700 pb-1">{children}</h1>,
        h2: ({ children }) => <h2 className="text-sm font-bold text-white mt-3 mb-1">{children}</h2>,
        h3: ({ children }) => <h3 className="text-sm font-semibold text-sky-400 mt-3 mb-1">{children}</h3>,
        strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
        ul: ({ children }) => <ul className="list-disc list-inside space-y-1 mt-1 ml-2">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 mt-1 ml-2">{children}</ol>,
        li: ({ children }) => <li className="text-gray-300 leading-relaxed">{children}</li>,
        p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
        code: ({ children }) => <code className="bg-gray-800 px-1.5 py-0.5 rounded text-sky-300 text-xs font-mono">{children}</code>,
        blockquote: ({ children }) => <blockquote className="border-l-2 border-sky-700 pl-3 text-gray-400 italic my-2">{children}</blockquote>,
      }}
    >
      {content}
    </ReactMarkdown>
  )
}

const SESSION_KEY = 'ikb_query_session'

function loadSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return null
}

function saveSession(data) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(data)) } catch {}
}

export default function Query() {
  const saved = loadSession()
  const [mode, setMode] = useState(saved?.mode || 'quick')
  const [messages, setMessages] = useState(saved?.messages || [])
  const [searchResults, setSearchResults] = useState(saved?.searchResults || null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [lastQuery, setLastQuery] = useState(saved?.lastQuery || '')
  const bottomRef = useRef(null)

  // Persist session state across tab navigation
  useEffect(() => {
    saveSession({ mode, messages, searchResults, lastQuery })
  }, [mode, messages, searchResults, lastQuery])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, searchResults, loading])

  const runQuickSearch = async (question) => {
    setLoading(true)
    setSearchResults(null)
    setLastQuery(question)
    try {
      const { data } = await api.post('/api/search', { question })
      setSearchResults(data)
    } catch (err) {
      console.error('Quick search failed:', err)
      setSearchResults({ documents: [], total: 0, error: true })
    } finally {
      setLoading(false)
    }
  }

  const runDeepAnalysis = async (question) => {
    setLoading(true)
    setMessages(prev => [...prev, { role: 'user', content: question }])
    try {
      const { data } = await api.post('/api/query', { question })
      setMessages(prev => [...prev, { role: 'assistant', content: data.answer }])
    } catch (err) {
      console.error('Deep analysis failed:', err)
      setMessages(prev => [...prev, { role: 'error', content: err.response?.data?.detail || 'Failed to get a response. Please try again.' }])
    } finally {
      setLoading(false)
    }
  }

  const ask = async (question) => {
    const q = question.trim()
    if (!q || loading) return
    setInput('')
    if (mode === 'quick') await runQuickSearch(q)
    else await runDeepAnalysis(q)
  }

  const switchToDeep = () => {
    setMode('deep')
    if (lastQuery) {
      runDeepAnalysis(lastQuery)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header + mode toggle */}
      <div className="px-8 pt-8 pb-4 border-b border-gray-800">
        <h1 className="text-2xl font-bold text-white mb-1">Ask AI</h1>
        <p className="text-gray-400 text-sm mb-4">Query the industrial knowledge base in plain English.</p>
        <div className="flex gap-2">
          <button
            onClick={() => { setMode('quick'); setMessages([]) }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === 'quick' ? 'bg-sky-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            <Zap size={14} />
            Quick Search
          </button>
          <button
            onClick={() => { setMode('deep'); setSearchResults(null); if (lastQuery && messages.length === 0) runDeepAnalysis(lastQuery) }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === 'deep' ? 'bg-purple-700 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            <Brain size={14} />
            Deep Analysis
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-5">

        {/* Example questions */}
        {!searchResults && messages.length === 0 && !loading && (
          <div>
            <p className="text-gray-500 text-sm mb-4">Try asking:</p>
            <div className="grid grid-cols-1 gap-2 max-w-xl">
              {EXAMPLE_QUESTIONS.map((q, i) => (
                <button
                  key={i}
                  onClick={() => ask(q)}
                  className="text-left bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-sm text-gray-300 hover:border-sky-600 hover:text-white transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Quick Search Results — document cards with page numbers */}
        {mode === 'quick' && searchResults && (
          <div className="space-y-4 max-w-2xl">
            <div className="flex items-center justify-between">
              <p className="text-gray-500 text-xs">
                {searchResults.total > 0
                  ? `${searchResults.total} document${searchResults.total > 1 ? 's' : ''} matched · vector search`
                  : 'No documents matched'}
              </p>
              {searchResults.total > 0 && (
                <button
                  onClick={switchToDeep}
                  disabled={loading}
                  className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 border border-purple-800 hover:border-purple-600 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                >
                  <Brain size={12} />
                  Deep Analysis
                </button>
              )}
            </div>

            {searchResults.error && (
              <div className="bg-red-950 border border-red-800 rounded-xl p-4 text-red-300 text-sm">
                Search failed. Check backend is running.
              </div>
            )}

            {searchResults.documents?.length === 0 && !searchResults.error && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center text-gray-500 text-sm">
                No matching documents found. Try different keywords or switch to Deep Analysis.
              </div>
            )}

            {searchResults.documents?.map((doc, i) => {
              const relevance = Math.round(doc.max_score * 100)

              return (
                <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-600 transition-colors">
                  {/* Doc header */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <FileText size={16} className="text-sky-400 shrink-0" />
                      <h3 className="text-white font-semibold text-sm">{doc.title}</h3>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${
                      relevance >= 80 ? 'bg-green-900 text-green-300'
                      : relevance >= 60 ? 'bg-yellow-900 text-yellow-300'
                      : 'bg-gray-800 text-gray-400'
                    }`}>
                      {relevance}% match
                    </span>
                  </div>

                  {/* Clickable page badges — each opens the PDF at that exact page */}
                  {doc.pages.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <BookOpen size={12} className="text-gray-500" />
                        <span className="text-xs text-gray-500">Click a page to open the PDF there</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {doc.pages.map((p, j) => {
                          const pct = Math.round(p.score * 100)
                          const isHigh = p.score >= 0.7
                          const href = `/api/file/page?path=${encodeURIComponent(p.path || doc.path)}&page=${p.page}`
                          return (
                            <a
                              key={j}
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                                isHigh
                                  ? 'bg-sky-950 border-sky-700 text-sky-300 hover:bg-sky-900 hover:border-sky-500'
                                  : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700 hover:border-gray-500'
                              }`}
                            >
                              <ExternalLink size={10} />
                              <span className="font-medium">Page {p.page}</span>
                              <span className={isHigh ? 'text-sky-500' : 'text-gray-600'}>{pct}%</span>
                            </a>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Deep Analysis chat messages */}
        {mode === 'deep' && messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`p-2 rounded-full h-8 w-8 flex items-center justify-center shrink-0 ${
              msg.role === 'user' ? 'bg-sky-700' : msg.role === 'error' ? 'bg-red-900' : 'bg-purple-900'
            }`}>
              {msg.role === 'user' ? <User size={14} /> : msg.role === 'error' ? <AlertCircle size={14} className="text-red-400" /> : <Brain size={14} />}
            </div>
            <div className={`max-w-2xl flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`rounded-xl px-4 py-3 text-sm ${
                msg.role === 'user'
                  ? 'bg-sky-700 text-white'
                  : msg.role === 'error'
                  ? 'bg-red-950 border border-red-800 text-red-300'
                  : 'bg-gray-900 border border-gray-800 text-gray-200'
              }`}>
                {msg.role === 'assistant' ? <MarkdownAnswer content={msg.content} /> : msg.content}
              </div>
            </div>
          </div>
        ))}

        {/* Loading */}
        {loading && (
          <div className="flex gap-3">
            <div className={`p-2 rounded-full h-8 w-8 flex items-center justify-center ${mode === 'deep' ? 'bg-purple-900' : 'bg-sky-900'}`}>
              {mode === 'deep' ? <Brain size={14} /> : <Zap size={14} />}
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-sm text-gray-400 flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-sky-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-1.5 h-1.5 bg-sky-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-1.5 h-1.5 bg-sky-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              <span className="ml-1">{mode === 'deep' ? 'Analysing with AI...' : 'Searching knowledge base...'}</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-8 pb-8 pt-3 border-t border-gray-800">
        <form onSubmit={e => { e.preventDefault(); ask(input) }} className="flex gap-3">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={mode === 'quick' ? 'Search equipment, procedures, specs...' : 'Ask a complex question for AI analysis...'}
            className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500 placeholder-gray-600"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className={`text-white p-2.5 rounded-xl transition-colors disabled:bg-gray-700 ${mode === 'deep' ? 'bg-purple-700 hover:bg-purple-600' : 'bg-sky-600 hover:bg-sky-500'}`}
          >
            <Send size={16} />
          </button>
        </form>
        <p className="text-xs text-gray-600 mt-2 text-center">
          {mode === 'quick'
            ? 'Finds relevant documents and pages using vector search. Click Open to view the full PDF.'
            : 'AI agent reads your knowledge base and writes a detailed answer.'}
        </p>
      </div>
    </div>
  )
}
