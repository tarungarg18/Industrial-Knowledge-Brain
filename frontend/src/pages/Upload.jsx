import { useState, useCallback, useEffect, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import api from '../api'
import { Upload as UploadIcon, CheckCircle, AlertCircle, Loader } from 'lucide-react'

const DOC_TYPES = [
  { value: 'manual', label: 'Manual' },
  { value: 'procedure', label: 'Procedure / SOP' },
  { value: 'specification', label: 'Specification' },
  { value: 'safety_document', label: 'Safety Document' },
  { value: 'inspection_report', label: 'Inspection Report' },
  { value: 'engineering_drawing', label: 'Engineering Drawing' },
  { value: 'work_instruction', label: 'Work Instruction' },
  { value: 'other', label: 'Other' },
]

const STEPS = [
  'Queued for processing',
  'Classifying & summarizing',
  'Extracting knowledge entities',
  'Waiting for human review',
  'Approved & in knowledge base',
]

export default function Upload() {
  const [file, setFile] = useState(null)
  const [title, setTitle] = useState('')
  const [docType, setDocType] = useState('manual')
  const [department, setDepartment] = useState('')
  const [uploadState, setUploadState] = useState('idle') // idle | uploading | processing | done | error
  const [errorMsg, setErrorMsg] = useState('')
  const [progress, setProgress] = useState(null) // { step, total, label, done, status }
  const [docId, setDocId] = useState(null)
  const pollRef = useRef(null)

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  useEffect(() => {
    if (!docId) return
    const poll = async () => {
      try {
        const { data } = await api.get(`/api/workflow/status/${docId}`)
        setProgress(data)
        if (data.done || data.status === 'quality_review') {
          stopPolling()
          setUploadState('done')
        }
      } catch {
        // keep polling silently
      }
    }
    poll()
    pollRef.current = setInterval(poll, 4000)
    return stopPolling
  }, [docId])

  const onDrop = useCallback(files => {
    if (files[0]) {
      setFile(files[0])
      if (!title) setTitle(files[0].name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '))
    }
  }, [title])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'], 'application/msword': ['.doc'], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'] },
    maxFiles: 1,
  })

  const handleSubmit = async e => {
    e.preventDefault()
    if (!file || !title) return
    setUploadState('uploading')
    setProgress(null)
    setErrorMsg('')

    const form = new FormData()
    form.append('file', file)
    form.append('title', title)
    form.append('doc_type', docType)
    form.append('department', department)

    try {
      const { data } = await api.post('/api/documents/upload', form)
      setDocId(data.id)
      setUploadState('processing')
      setFile(null)
      setTitle('')
      setDepartment('')
    } catch (err) {
      setUploadState('error')
      setErrorMsg(err.response?.data?.detail || 'Upload failed. Please try again.')
    }
  }

  const reset = () => {
    stopPolling()
    setUploadState('idle')
    setProgress(null)
    setDocId(null)
    setErrorMsg('')
  }

  const isProcessing = uploadState === 'uploading' || uploadState === 'processing'
  const currentStep = progress?.step ?? 0

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-white mb-1">Upload Document</h1>
      <p className="text-gray-400 text-sm mb-8">Upload industrial documents for AI processing and knowledge extraction.</p>

      {/* Progress tracker — shown while processing */}
      {(uploadState === 'processing' || uploadState === 'done') && (
        <div className="mb-8 bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-sm font-medium text-white mb-4">
            {uploadState === 'done' ? 'Processing complete' : 'Processing document...'}
          </p>
          <div className="space-y-3">
            {STEPS.map((label, i) => {
              const stepNum = i + 1
              const isDone = stepNum < currentStep || (uploadState === 'done' && currentStep >= stepNum)
              const isActive = stepNum === currentStep && uploadState === 'processing'
              return (
                <div key={i} className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs ${
                    isDone ? 'bg-green-600 text-white' :
                    isActive ? 'bg-sky-600 text-white' :
                    'bg-gray-800 text-gray-600'
                  }`}>
                    {isDone ? '✓' : stepNum}
                  </div>
                  <span className={`text-sm ${
                    isActive ? 'text-sky-400 font-medium' :
                    isDone ? 'text-gray-400' :
                    'text-gray-600'
                  }`}>
                    {label}
                    {isActive && <span className="ml-2 animate-pulse">●</span>}
                  </span>
                </div>
              )
            })}
          </div>
          {progress?.status === 'quality_review' && (
            <div className="mt-4 text-xs text-yellow-400 bg-yellow-950 border border-yellow-800 rounded-lg px-3 py-2">
              Document needs human review — check the Approval Queue.
            </div>
          )}
          {progress?.status === 'approved' && (
            <div className="mt-4 text-xs text-green-400 bg-green-950 border border-green-800 rounded-lg px-3 py-2">
              Document approved and added to the Knowledge Base.
            </div>
          )}
          <button onClick={reset} className="mt-4 text-xs text-gray-500 hover:text-white transition-colors">
            Upload another document
          </button>
        </div>
      )}

      {/* Upload form — hidden while processing */}
      {(uploadState === 'idle' || uploadState === 'error') && (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
              isDragActive ? 'border-sky-500 bg-sky-950' : 'border-gray-700 hover:border-sky-600 bg-gray-900'
            }`}
          >
            <input {...getInputProps()} />
            <UploadIcon size={32} className="mx-auto mb-3 text-gray-500" />
            {file ? (
              <p className="text-sky-400 font-medium">{file.name}</p>
            ) : (
              <>
                <p className="text-gray-300">Drag & drop a PDF or DOCX file</p>
                <p className="text-gray-500 text-sm mt-1">or click to browse</p>
              </>
            )}
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Document Title *</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
              placeholder="e.g. Hydraulic Pump Maintenance Manual v2"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Document Type *</label>
              <select
                value={docType}
                onChange={e => setDocType(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
              >
                {DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Department</label>
              <input
                value={department}
                onChange={e => setDepartment(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
                placeholder="e.g. Maintenance"
              />
            </div>
          </div>

          {uploadState === 'error' && (
            <div className="flex items-center gap-2 text-red-400 bg-red-950 border border-red-800 rounded-lg px-4 py-3 text-sm">
              <AlertCircle size={16} /> {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={!file || !title}
            className="w-full bg-sky-600 hover:bg-sky-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
          >
            <UploadIcon size={16} /> Upload & Process
          </button>
        </form>
      )}

      {uploadState === 'uploading' && (
        <div className="flex items-center gap-3 text-sky-400 text-sm">
          <Loader size={16} className="animate-spin" /> Uploading file...
        </div>
      )}
    </div>
  )
}
