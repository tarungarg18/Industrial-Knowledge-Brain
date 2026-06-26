const STATUS_STYLES = {
  uploaded:      'bg-gray-700 text-gray-300',
  processing:    'bg-yellow-900 text-yellow-300',
  indexed:       'bg-blue-900 text-blue-300',
  quality_review:'bg-orange-900 text-orange-300',
  approved:      'bg-green-900 text-green-300',
  archived:      'bg-gray-800 text-gray-500',
}

export default function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] || 'bg-gray-700 text-gray-400'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${style}`}>
      {status?.replace(/_/g, ' ') || 'unknown'}
    </span>
  )
}
