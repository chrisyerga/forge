import type { ReactNode } from 'react'
import { Link, Outlet, createRootRoute, HeadContent, Scripts } from '@tanstack/react-router'
import { AppShell } from '@/components/AppShell'
import { Button } from '@/components/ui/button'
import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Forge — AI Content Generation' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&display=swap',
      },
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
    ],
  }),
  component: RootComponent,
  notFoundComponent: NotFound,
})

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  )
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}

function NotFound() {
  return (
    <RootDocument>
      <AppShell>
        <div className="flex flex-col items-center gap-4 py-24 text-center">
          <h1 className="text-2xl font-semibold">Page not found</h1>
          <p className="text-sm text-zinc-400">This route does not exist in Forge.</p>
          <Link to="/">
            <Button variant="secondary">Back to dashboard</Button>
          </Link>
        </div>
      </AppShell>
    </RootDocument>
  )
}
