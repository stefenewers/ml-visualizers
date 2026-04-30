import type { Metadata } from 'next'
import { JetBrains_Mono, Syne } from 'next/font/google'
import './globals.css'

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-jetbrains',
})

const syne = Syne({
  subsets: ['latin'],
  weight: ['800'],
  variable: '--font-syne',
})

export const metadata: Metadata = {
  title: 'ML Internals — Algorithm Visualizer',
  description: 'Interactive step-by-step visualizations of core ML algorithms',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${jetbrainsMono.variable} ${syne.variable}`}>
      <body style={{ fontFamily: 'var(--font-jetbrains), monospace', background: '#0a0a0f', color: '#e2e8f0', height: '100vh', overflow: 'hidden' }}>
        {children}
      </body>
    </html>
  )
}
