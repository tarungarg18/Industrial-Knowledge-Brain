export const FOLDER_MAP = {
  manual: '/manuals',
  procedure: '/procedures',
  specification: '/specifications',
  safety_document: '/safety',
  inspection_report: '/reports',
  engineering_drawing: '/drawings',
  work_instruction: '/procedures',
  other: '/inbox',
}

export function cleanFilename(path) {
  let name = path.split('/').pop() || path
  name = name.replace(/\.[^.]+$/, '')
  name = name.replace(/[_-]\d{6,}/g, '')
  name = name.replace(/[_-][0-9a-f]{8,}/gi, '')
  name = name.replace(/[_-]?[0-9a-f]{8}[_-][0-9a-f]{4}[_-][0-9a-f]{4}[_-][0-9a-f]{4}[_-][0-9a-f]{12}/gi, '')
  name = name.replace(/[_-]/g, ' ').trim()
  name = name.replace(/\s+/g, ' ')
  const words = name.split(' ')
  const deduped = words[0] ? [words[0]] : []
  for (const w of words.slice(1)) {
    if (w.toLowerCase() !== deduped[deduped.length - 1].toLowerCase()) deduped.push(w)
  }
  return deduped.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
}

export function cleanChunk(text, maxLen = 450) {
  text = text.replace(/#{1,6}\s*/g, '')
  text = text.replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1')
  text = text.replace(/(\b[A-Z]\b[\s-]*){4,}/g, ' ')
  text = text.replace(/TROUBLE\s+POSSIBLE\s+CAUSE\s+CORRECTIVE\s+REPAIR\s+INSTRUCTIONS\s*/gi, '')
  text = text.replace(/\s+/g, ' ').trim()
  if (text.length > maxLen) {
    text = text.slice(0, maxLen).replace(/\s+\S*$/, '') + '…'
  }
  return text
}

export function isGarbageChunk(text) {
  const words = text.split(/\s+/)
  if (!words.length) return true
  const single = words.filter(w => w.length <= 1).length
  return single / words.length > 0.35
}

export function buildDocumentCards(hits) {
  const rawScores = hits.map(h => parseFloat(h.score ?? 0) || 0)
  const maxRaw = Math.max(...rawScores, 1)
  const docMap = {}

  hits.forEach((hit, i) => {
    const path = hit.path || ''
    const score = Math.round((rawScores[i] / maxRaw) * 100) / 100
    const page = hit.page_number || null
    const title = cleanFilename(path)
    const key = title.toLowerCase().trim()

    if (!docMap[key]) {
      docMap[key] = { title, path, max_score: score, pages: [] }
    } else if (score > docMap[key].max_score) {
      docMap[key].max_score = score
    }

    if (page && !docMap[key].pages.some(p => p.page === page)) {
      docMap[key].pages.push({ page, score, path })
    }
  })

  return Object.values(docMap)
    .map(d => ({ ...d, pages: d.pages.sort((a, b) => b.score - a.score) }))
    .sort((a, b) => b.max_score - a.max_score)
}

export async function openFileAtPage(lemmaClient, path, page = 1) {
  try {
    const res = await lemmaClient.files.createSignedUrl(path, { expiresSeconds: 3600 })
    const url = res?.signed_url
    if (url) window.open(`${url}#page=${page}`, '_blank', 'noopener,noreferrer')
  } catch (e) {
    console.error('Failed to open file:', e)
  }
}
