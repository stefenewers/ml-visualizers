export default function Header() {
  return (
    <header style={{
      height: 56,
      background: '#111118',
      borderBottom: '1px solid #1e1e2e',
      display: 'flex',
      alignItems: 'center',
      padding: '0 24px',
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: '#00e5ff',
          boxShadow: '0 0 10px #00e5ff, 0 0 20px #00e5ff44',
        }} />
        <span style={{
          fontFamily: 'var(--font-syne), sans-serif',
          fontSize: 18,
          fontWeight: 800,
          color: '#e2e8f0',
          letterSpacing: '0.05em',
        }}>
          ML Internals
        </span>
        <span style={{ color: '#1e1e2e', margin: '0 6px' }}>|</span>
        <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: 12, color: '#64748b' }}>
          Algorithm Visualizer
        </span>
      </div>
      <div style={{ marginLeft: 'auto' }}>
        <span style={{
          padding: '3px 10px',
          background: '#0a0a0f',
          border: '1px solid #1e1e2e',
          borderRadius: 4,
          fontFamily: 'var(--font-jetbrains), monospace',
          fontSize: 11,
          color: '#64748b',
        }}>v1.0</span>
      </div>
    </header>
  )
}
