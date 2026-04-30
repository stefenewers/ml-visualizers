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

// Inline script runs synchronously before first paint to prevent FOUC.
// If the user saved 'light', remove the server-rendered 'dark' class immediately.
const themeScript = `(function(){try{var t=localStorage.getItem('ml-theme');if(t==='light')document.documentElement.classList.remove('dark');}catch(e){}})();`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${jetbrainsMono.variable} ${syne.variable}`}>
      <head>
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body
        style={{
          fontFamily: 'var(--font-jetbrains), monospace',
          background: 'var(--bg)',
          color: 'var(--text)',
        }}
      >
        {children}
      </body>
    </html>
  )
}
