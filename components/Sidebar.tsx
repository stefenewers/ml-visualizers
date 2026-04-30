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
    <aside style={{
      width: 260,
      background: '#111118',
      borderRight: '1px solid #1e1e2e',
      overflowY: 'auto',
      flexShrink: 0,
      padding: '16px 12px',
    }}>
      {CATEGORIES.map(cat => {
        const algos = ALGORITHMS.filter(a => a.category === cat)
        if (!algos.length) return null
        return (
          <div key={cat} style={{ marginBottom: 24 }}>
            <div style={{
              fontFamily: 'var(--font-jetbrains), monospace',
              fontSize: 10,
              color: '#64748b',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: 8,
              paddingLeft: 8,
            }}>{cat}</div>
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
                  onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(30,30,46,0.5)' }}
                  onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
                >
                  <div style={{
                    fontFamily: 'var(--font-jetbrains), monospace',
                    fontSize: 13,
                    color: active ? '#00e5ff' : '#e2e8f0',
                    marginBottom: 3,
                  }}>{algo.name}</div>
                  <div style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: 11, color: '#64748b', marginBottom: 4 }}>
                    {algo.description}
                  </div>
                  <span style={{
                    padding: '1px 6px',
                    background: active ? 'rgba(0,229,255,0.1)' : '#0a0a0f',
                    border: `1px solid ${active ? 'rgba(0,229,255,0.2)' : '#1e1e2e'}`,
                    borderRadius: 3,
                    fontFamily: 'var(--font-jetbrains), monospace',
                    fontSize: 10,
                    color: active ? '#00e5ff' : '#64748b',
                  }}>{algo.complexity}</span>
                </button>
              )
            })}
          </div>
        )
      })}
    </aside>
  )
}
