import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from '../../convex/_generated/api'
import { AppShell } from '@/components/AppShell'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const Route = createFileRoute('/')({
  component: DashboardPage,
})

function DashboardPage() {
  return (
    <AppShell>
      <Dashboard />
    </AppShell>
  )
}

function Dashboard() {
  const projects = useQuery(convexQuery(api.projects.list, {}))
  const entities = useQuery(convexQuery(api.entities.list, {}))
  const keys = useQuery(convexQuery(api.apiKeys.list, {}))
  const generations = useQuery(convexQuery(api.generations.list, { limit: 10 }))

  const stats = [
    { label: 'Projects', value: projects.data?.length ?? 0 },
    { label: 'Entities', value: entities.data?.length ?? 0 },
    { label: 'API Keys', value: keys.data?.filter((k) => !k.revoked).length ?? 0 },
    { label: 'Generations', value: generations.data?.length ?? 0 },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-zinc-400">Your Forge generation service at a glance.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader>
              <CardDescription>{stat.label}</CardDescription>
              <CardTitle className="text-3xl">{stat.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent generations</CardTitle>
          <CardDescription>Latest requests across the API and playground.</CardDescription>
        </CardHeader>
        <CardContent>
          {generations.data && generations.data.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-zinc-500">
                  <tr>
                    <th className="pb-2 font-medium">When</th>
                    <th className="pb-2 font-medium">Source</th>
                    <th className="pb-2 font-medium">Model</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Tokens</th>
                  </tr>
                </thead>
                <tbody>
                  {generations.data.map((gen) => (
                    <tr key={gen._id} className="border-t border-zinc-800">
                      <td className="py-2 text-zinc-400">
                        {new Date(gen.createdAt).toLocaleString()}
                      </td>
                      <td className="py-2">{gen.source}</td>
                      <td className="py-2 font-mono text-xs">{gen.model}</td>
                      <td className="py-2">{gen.status}</td>
                      <td className="py-2 text-zinc-400">{gen.totalTokens ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-zinc-500">No generations yet. Try the playground.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
