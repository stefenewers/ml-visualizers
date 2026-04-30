'use client'

const ALGORITHMS = [
  { id: 'kmeans', name: 'K-Means Clustering', category: 'Unsupervised Learning', complexity: 'O(n·k·i)', description: 'Groups data into K clusters iteratively' },
  { id: 'linear-regression', name: 'Linear Regression', category: 'Supervised Learning', complexity: 'O(n·e)', description: 'Fits a line via gradient descent' },
  { id: 'decision-tree', name: 'Decision Tree', category: 'Supervised Learning', complexity: 'O(n·d·log n)', description: 'Recursively splits on best feature' },
  { id: 'neural-network', name: 'Neural Network', category: 'Deep Learning', complexity: 'O(l·n·e)', description: 'Forward pass + backpropagation' },
  { id: 'gradient-descent', name: 'Loss Surface', category: 'Optimization', complexity: 'O(s)', description: 'Navigates a 2D loss landscape' },
]

const CATEGORIES = ['Unsupervised Learning', 'Supervised Learning', 'Deep Learning', 'Optimization']

interface SidebarProps { selected: string; onSelect: (id: string) => void }

export default function Sidebar({ selected, onSelect }: SidebarProps) {
  return (
    <aside
      style={{
        width: 260,
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        overflowY: 'auto',
        flexShrink: 0,
        padding: '16px 12px',
      }}
    >
      {CATEGORIES.map(cat => {
        const algos = ALGORITHMS.filter(a => a.category === cat)
        if (!algos.length) return null
        return (
          <div key={cat} style={{ marginBottom: 24 }}>
            <div
              style={{
                fontFamily: 'var(--font-jetbrains), monospace',
                fontSize: 10,
                color: 'var(--muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                marginBottom: 8,
                paddingLeft: 8,
              }}
            >
              {cat}
            </div>
            {algos.map(algo => {
              const active = selected === algo.id
              return (
                <button
                  key={algo.id}
                  onClick={() => onSelect(algo.id)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '10px 12px',
                    borderRadius: 6,
                    marginBottom: 2,
                    background: active ? 'rgba(0,229,255,0.08)' : 'transparent',
                    border: active ? '1px solid rgba(0,229,255,0.25)' : '1px solid transparent',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => {
                    if (!active)
                      (e.currentTarget as HTMLButtonElement).style.background =
                        'rgba(100,116,139,0.08)'
                  }}
                  onMouseLeave={e => {
                    if (!active)
                      (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                  }}
                >
                  <div
                    style={{
                      fontFamily: 'var(--font-jetbrains), monospace',
                      fontSize: 13,
                      color: active ? '#00e5ff' : 'var(--text)',
                      marginBottom: 3,
                    }}
                  >
                    {algo.name}
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--font-jetbrains), monospace',
                      fontSize: 11,
                      color: 'var(--muted)',
                      marginBottom: 4,
                    }}
                  >
                    {algo.description}
                  </div>
                  <span
                    style={{
                      padding: '1px 6px',
                      background: active ? 'rgba(0,229,255,0.1)' : 'var(--bg)',
                      border: `1px solid ${active ? 'rgba(0,229,255,0.2)' : 'var(--border)'}`,
                      borderRadius: 3,
                      fontFamily: 'var(--font-jetbrains), monospace',
                      fontSize: 10,
                      color: active ? '#00e5ff' : 'var(--muted)',
                    }}
                  >
                    {algo.complexity}
                  </span>
                </button>
              )
            })}
          </div>
        )
      })}
    </aside>
  )
}
