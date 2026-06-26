import { useState, useCallback, useEffect, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import { useRecord } from 'lemma-sdk/react'
import { Upload as UploadIcon, AlertCircle, Loader, RefreshCw, FilePlus } from 'lucide-react'
import { client } from '../lemma'
import { FOLDER_MAP } from '../utils'

const DOC_TYPES = [
  { value: 'manual',              label: 'Manual' },
  { value: 'procedure',           label: 'Procedure / SOP' },
  { value: 'specification',       label: 'Specification' },
  { value: 'safety_document',     label: 'Safety Document' },
  { value: 'inspection_report',   label: 'Inspection Report' },
  { value: 'engineering_drawing', label: 'Engineering Drawing' },
  { value: 'work_instruction',    label: 'Work Instruction' },
  { value: 'other',               label: 'Other' },
]

const STEPS = [
  'Queued for processing',
  'Classifying & summarizing',
  'Extracting knowledge entities',
  'Waiting for human review',
  'Approved & in knowledge base',
]

const STATUS_STEP = {
  uploaded: 1, processing: 2, indexed: 3, quality_review: 4, approved: 5,
}

const STATUS_LABEL = {
  uploaded: 'Uploaded', processing: 'Processing', indexed: 'Indexed',
  quality_review: 'Pending Review', approved: 'Approved', archived: 'Archived',
}

async function computeHash(file) {
  const buf = await file.arrayBuffer()
  const hashBuf = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function startWorkflow(docId) {
  const run = await client.workflows.runs.create('document-ingestion')
  const wait = run?.active_wait
  if (run?.id && wait?.wait_type === 'HUMAN' && wait?.node_id) {
    await client.workflows.runs.submitForm(run.id, {
      node_id: wait.node_id,
      inputs: { document_id: docId },
    })
  }
}

export default function Upload() {
  const [file, setFile]           = useState(null)
  const [fileHash, setFileHash]   = useState(null)
  const [title, setTitle]         = useState('')
  const [docType, setDocType]     = useState('manual')
  const [department, setDepartment] = useState('')
  const [phase, setPhase]         = useState('idle')
  const [errorMsg, setErrorMsg]   = useState('')
  const [existingDoc, setExistingDoc] = useState(null)
  const [uploadMode, setUploadMode]   = useState('create')
  const [docId, setDocId]         = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const pollRef                   = useRef(null)

  const { record: docRecord, refresh: refreshDoc } = useRecord({
    client,
    tableName: 'documents',
    recordId: docId,
    enabled: !!docId,
    autoLoad: !!docId,
  })

  useEffect(() => {
    if (!docId) return
    pollRef.current = setInterval(() => refreshDoc(), 4000)
    return () => clearInterval(pollRef.current)
  }, [docId, refreshDoc])

  useEffect(() => {
    if (!docRecord) return
    const s = docRecord.status
    if (s === 'approved' || s === 'quality_review' || s === 'archived') {
      clearInterval(pollRef.current)
      setPhase('done')
    }
  }, [docRecord])

  const onDrop = useCallback(async (files) => {
    const f = files[0]
    if (!f) return
    setFile(f)
    if (!title) setTitle(f.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '))
    setPhase('checking')
    setExistingDoc(null)
    setUploadMode('create')
    setErrorMsg('')

    try {
      const hash = await computeHash(f)
      setFileHash(hash)
      const res = await client.records.list('documents', {
        filters: [{ field: 'content_hash', op: 'eq', value: hash }],
        limit: 1,
      })
      const existing = res?.items?.[0]
      if (existing) {
        setExistingDoc(existing)
        setPhase('conflict')
      } else {
        setPhase('idle')
      }
    } catch {
      setFileHash(null)
      setPhase('idle')
    }
  }, [title])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    maxFiles: 1,
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!file || !title) return
    setPhase('uploading')
    setErrorMsg('')
    setDocId(null)
    setIsUploading(true)

    try {
      // 1. Upload file — append timestamp to name so re-uploads never conflict
      const ext = file.name.includes('.') ? file.name.split('.').pop() : ''
      const base = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()
      const ts = new Date().toISOString().replace(/\D/g, '').slice(0, 14)
      const uniqueName = ext ? `${base}_${ts}.${ext}` : `${base}_${ts}`

      const uploaded = await client.files.upload(file, {
        directoryPath: FOLDER_MAP[docType] || '/inbox',
        searchEnabled: true,
        name: uniqueName,
      })

      if (!uploaded?.path) {
        throw new Error('File uploaded but server returned no path. Contact support.')
      }

      let recordId

      if (uploadMode === 'update' && existingDoc?.id) {
        // 2a. Update existing record — reset status for re-processing
        recordId = existingDoc.id
        await client.records.update('documents', recordId, {
          title,
          file_path: uploaded.path,
          doc_type: docType,
          department: department || null,
          status: 'uploaded',
          content_hash: fileHash || null,
          error_message: null,
        })
      } else {
        // 2b. Create new record
        const doc = await client.records.create('documents', {
          title,
          file_path: uploaded.path,
          doc_type: docType,
          department: department || null,
          status: 'uploaded',
          content_hash: fileHash || null,
        })
        recordId = doc?.id ?? doc?.record_id
        if (!recordId) throw new Error('Record created but no ID returned from server.')
      }

      setDocId(recordId)
      setPhase('processing')

      // 3. Trigger ingestion workflow with correct `inputs` field (not `data`)
      await startWorkflow(recordId)

      setFile(null)
      setTitle('')
      setDepartment('')
      setFileHash(null)
      setExistingDoc(null)
    } catch (err) {
      setPhase('error')
      // Show real API error message, not a generic one
      const msg = err?.body?.detail || err?.message || 'Upload failed. Please try again.'
      setErrorMsg(msg)
    } finally {
      setIsUploading(false)
    }
  }

  const reset = () => {
    clearInterval(pollRef.current)
    setPhase('idle')
    setDocId(null)
    setExistingDoc(null)
    setUploadMode('create')
    setFileHash(null)
    setErrorMsg('')
    setFile(null)
    setTitle('')
    setDepartment('')
  }

  const currentStep = STATUS_STEP[docRecord?.status] ?? (phase === 'uploading' ? 0 : 1)
  const showForm = phase === 'idle' || phase === 'checking' || phase === 'conflict' || phase === 'error'

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-white mb-1">Upload Document</h1>
      <p className="text-gray-400 text-sm mb-8">Upload industrial documents for AI processing and knowledge extraction.</p>

      {/* Processing / Done tracker */}
      {(phase === 'processing' || phase === 'done') && (
        <div className="mb-8 bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-sm font-medium text-white mb-4">
            {phase === 'done' ? 'Processing complete' : 'Processing document...'}
          </p>
          <div className="space-y-3">
            {STEPS.map((label, i) => {
              const stepNum = i + 1
              const isDone   = stepNum < currentStep || (phase === 'done' && currentStep >= stepNum)
              const isActive = stepNum === currentStep && phase === 'processing'
              return (
                <div key={i} className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs ${
                    isDone ? 'bg-green-600 text-white' : isActive ? 'bg-sky-600 text-white' : 'bg-gray-800 text-gray-600'
                  }`}>
                    {isDone ? '✓' : stepNum}
                  </div>
                  <span className={`text-sm ${isActive ? 'text-sky-400 font-medium' : isDone ? 'text-gray-400' : 'text-gray-600'}`}>
                    {label}
                    {isActive && <span className="ml-2 animate-pulse">●</span>}
                  </span>
                </div>
              )
            })}
          </div>
          {docRecord?.status === 'quality_review' && (
            <div className="mt-4 text-xs text-yellow-400 bg-yellow-950 border border-yellow-800 rounded-lg px-3 py-2">
              Document needs human review — check the Approval Queue.
            </div>
          )}
          {docRecord?.status === 'approved' && (
            <div className="mt-4 text-xs text-green-400 bg-green-950 border border-green-800 rounded-lg px-3 py-2">
              Document approved and added to the Knowledge Base.
            </div>
          )}
          <button onClick={reset} className="mt-4 text-xs text-gray-500 hover:text-white transition-colors">
            Upload another document
          </button>
        </div>
      )}

      {/* Upload form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
              isDragActive ? 'border-sky-500 bg-sky-950' : 'border-gray-700 hover:border-sky-600 bg-gray-900'
            }`}
          >
            <input {...getInputProps()} />
            <UploadIcon size={32} className="mx-auto mb-3 text-gray-500" />
            {phase === 'checking' ? (
              <div className="flex items-center justify-center gap-2 text-sky-400 text-sm">
                <Loader size={14} className="animate-spin" /> Checking for existing document...
              </div>
            ) : file ? (
              <p className="text-sky-400 font-medium">{file.name}</p>
            ) : (
              <>
                <p className="text-gray-300">Drag & drop a PDF or DOCX file</p>
                <p className="text-gray-500 text-sm mt-1">or click to browse</p>
              </>
            )}
          </div>

          {/* Duplicate conflict banner */}
          {phase === 'conflict' && existingDoc && (
            <div className="rounded-xl border border-yellow-700 bg-yellow-950 p-4 space-y-3">
              <p className="text-yellow-300 text-sm font-medium">This file already exists in the system</p>
              <div className="text-xs text-yellow-400 space-y-1">
                <p><span className="text-gray-400">Title:</span> {existingDoc.title}</p>
                <p>
                  <span className="text-gray-400">Status:</span>{' '}
                  <span className={existingDoc.status === 'approved' ? 'text-green-400' : 'text-yellow-300'}>
                    {STATUS_LABEL[existingDoc.status] ?? existingDoc.status}
                  </span>
                </p>
              </div>
              <div className="flex gap-2 pt-1">
                {existingDoc.status !== 'approved' && (
                  <button
                    type="button"
                    onClick={() => { setUploadMode('update'); setPhase('idle') }}
                    className="flex items-center gap-1.5 text-xs bg-yellow-700 hover:bg-yellow-600 text-white px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <RefreshCw size={12} /> Update & reprocess existing
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { setUploadMode('create'); setPhase('idle') }}
                  className="flex items-center gap-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded-lg transition-colors"
                >
                  <FilePlus size={12} /> Upload as new version
                </button>
              </div>
            </div>
          )}

          {/* Update-mode badge */}
          {uploadMode === 'update' && phase === 'idle' && existingDoc && (
            <div className="flex items-center justify-between rounded-lg bg-sky-950 border border-sky-700 px-4 py-2 text-xs text-sky-300">
              <span>Updating <strong>{existingDoc.title}</strong> — existing record will be reprocessed</span>
              <button type="button" onClick={() => setUploadMode('create')} className="ml-3 text-sky-500 hover:text-white">
                Cancel
              </button>
            </div>
          )}

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

          {phase === 'error' && (
            <div className="flex items-start gap-2 text-red-400 bg-red-950 border border-red-800 rounded-lg px-4 py-3 text-sm">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span className="break-words">{errorMsg}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={!file || !title || isUploading || phase === 'checking'}
            className="w-full bg-sky-600 hover:bg-sky-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
          >
            {isUploading
              ? <><Loader size={16} className="animate-spin" /> Uploading...</>
              : uploadMode === 'update'
              ? <><RefreshCw size={16} /> Update & Reprocess</>
              : <><UploadIcon size={16} /> Upload & Process</>
            }
          </button>
        </form>
      )}
    </div>
  )
}
