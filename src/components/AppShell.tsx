import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { useConvexAuth } from '@convex-dev/auth/react'
import { useAuthActions } from '@convex-dev/auth/react'
import { SignIn } from './SignIn'
import { Button } from '@/components/ui/button'

const navLinks = [
  { to: '/', label: 'Dashboard' },
  { to: '/projects', label: 'Projects' },
  { to: '/tasks', label: 'Tasks' },
  { to: '/keys', label: 'API Keys' },
  { to: '/playground', label: 'Playground' },
] as const

export function AppShell({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useConvexAuth()
  const { signOut } = useAuthActions()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-zinc-500">Loading…</div>
    )
  }

  if (!isAuthenticated) {
    return <SignIn />
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-zinc-800">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <Link to="/" className="text-sm font-semibold">
              Forge
            </Link>
            <nav className="flex items-center gap-4 text-sm text-zinc-400">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="hover:text-zinc-100"
                  activeOptions={{ exact: link.to === '/' }}
                  activeProps={{ className: 'text-zinc-100' }}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
          <Button variant="ghost" size="sm" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  )
}
