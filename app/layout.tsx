import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'IDF Proxy Service',
  description: 'Proxy service for IDF API',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

