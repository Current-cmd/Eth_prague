import { useState } from 'react'
import PublicView from './views/PublicView'
import WhistleblowerView from './views/WhistleblowerView'
import AdminView from './views/AdminView'

type Tab = 'public' | 'wb' | 'admin'

const TABS = [
  { id: 'public' as Tab, label: 'Public Registry',     short: 'Registry' },
  { id: 'wb'     as Tab, label: 'Submit a Disclosure', short: 'Submit'   },
  { id: 'admin'  as Tab, label: 'Admin Console',       short: 'Admin'    },
]

export default function App() {
  const [tab, setTab] = useState<Tab>('public')

  return (
    <div className="grain min-h-screen bg-ink text-paper">
      <TopNav tab={tab} setTab={setTab} />
      <main>
        {tab === 'public' && <PublicView />}
        {tab === 'wb'     && <WhistleblowerView />}
        {tab === 'admin'  && <AdminView />}
      </main>
    </div>
  )
}

function TopNav({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  return (
    <header className="sticky top-0 z-40 border-b border-rule bg-ink/95 backdrop-blur">
      <div className="max-w-[1340px] mx-auto px-6 lg:px-10 h-[57px] grid grid-cols-3 items-center gap-6">
        <div />

        <nav className="flex items-center justify-center gap-1">
          {TABS.map(tb => {
            const on = tab === tb.id
            return (
              <button
                key={tb.id}
                onClick={() => setTab(tb.id)}
                className={`relative h-[57px] px-3 lg:px-5 font-mono text-[10.5px] uppercase tracking-[0.18em] transition ${
                  on ? 'text-paper' : 'text-paper3 hover:text-paper'
                }`}
              >
                <span className="hidden sm:inline">{tb.label}</span>
                <span className="sm:hidden">{tb.short}</span>
                {on && (
                  <span className="absolute bottom-[-1px] left-3 right-3 lg:left-5 lg:right-5 h-[2px] bg-amber" style={{ borderRadius: 0 }} />
                )}
              </button>
            )
          })}
        </nav>

        <div className="hidden lg:flex items-center justify-end gap-3 font-mono text-[10px] uppercase tracking-[0.18em] text-paper3">
          <span className="w-1.5 h-1.5 bg-verify" style={{ borderRadius: 0 }} />
          <span>Network · operational</span>
        </div>
      </div>
    </header>
  )
}
