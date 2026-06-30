import { createFileRoute } from '@tanstack/react-router'
import { AppShell } from '@/components/AppShell'
import { Chat } from '@/components/Chat'

export const Route = createFileRoute('/playground')({
  component: PlaygroundPage,
})

function PlaygroundPage() {
  return (
    <AppShell>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">Playground</h1>
          <p className="text-sm text-zinc-400">
            Chat against <code className="text-zinc-300">/v1/chat</code> using your session.
          </p>
        </div>
        <Chat />
      </div>
    </AppShell>
  )
}
