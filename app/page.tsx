'use client'
import { useState } from 'react'
import dynamic from 'next/dynamic'
import Header from '@/components/Header'
import Sidebar from '@/components/Sidebar'

const KMeansViz = dynamic(() => import('@/components/algorithms/KMeansViz'), {
  ssr: false,
  loading: () => <Loading />,
})
const LinearRegressionViz = dynamic(() => import('@/components/algorithms/LinearRegressionViz'), {
  ssr: false,
  loading: () => <Loading />,
})
const DecisionTreeViz = dynamic(() => import('@/components/algorithms/DecisionTreeViz'), {
  ssr: false,
  loading: () => <Loading />,
})
const NeuralNetworkViz = dynamic(() => import('@/components/algorithms/NeuralNetworkViz'), {
  ssr: false,
  loading: () => <Loading />,
})
const GradientDescentViz = dynamic(() => import('@/components/algorithms/GradientDescentViz'), {
  ssr: false,
  loading: () => <Loading />,
})

function Loading() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: 400,
        color: 'var(--muted)',
        fontFamily: 'var(--font-jetbrains), monospace',
        fontSize: 13,
      }}
    >
      Loading visualization...
    </div>
  )
}

const COMPONENTS: Record<string, React.ComponentType> = {
  kmeans: KMeansViz,
  'linear-regression': LinearRegressionViz,
  'decision-tree': DecisionTreeViz,
  'neural-network': NeuralNetworkViz,
  'gradient-descent': GradientDescentViz,
}

export default function Home() {
  const [selected, setSelected] = useState('kmeans')
  const Viz = COMPONENTS[selected] ?? KMeansViz

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)' }}>
      <Header />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar selected={selected} onSelect={setSelected} />
        <main style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          <Viz />
        </main>
      </div>
    </div>
  )
}
