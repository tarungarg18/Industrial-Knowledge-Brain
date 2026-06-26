import { NavLink } from 'react-router-dom'
import { LayoutDashboard, FileText, Upload, MessageSquare, CheckSquare, Database, Cpu } from 'lucide-react'

const links = [
  { to: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/upload',     icon: Upload,           label: 'Upload Doc' },
  { to: '/documents',  icon: FileText,         label: 'Documents' },
  { to: '/query',      icon: MessageSquare,    label: 'Ask AI' },
  { to: '/approvals',  icon: CheckSquare,      label: 'Approvals' },
  { to: '/knowledge',  icon: Database,         label: 'Knowledge Base' },
]

export default function Sidebar() {
  return (
    <aside className="w-58 bg-gray-900 border-r border-gray-800 flex flex-col" style={{ width: '232px' }}>
      <div className="px-5 py-5 border-b border-gray-800 flex items-center gap-3">
        <div className="bg-sky-600 p-1.5 rounded-lg">
          <Cpu size={18} className="text-white" />
        </div>
        <div>
          <p className="font-bold text-white text-sm leading-tight">IKB</p>
          <p className="text-gray-500 text-xs leading-tight">Industrial Knowledge</p>
        </div>
      </div>

      <nav className="flex-1 py-3 px-2 space-y-0.5">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-sky-600 text-white font-medium'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`
            }
          >
            <Icon size={15} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-4 py-3 border-t border-gray-800">
        <p className="text-xs text-gray-600">Powered by Lemma AI</p>
      </div>
    </aside>
  )
}
