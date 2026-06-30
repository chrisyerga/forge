import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { AppShell } from '@/components/AppShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const Route = createFileRoute('/keys')({
  component: KeysPage,
})

function KeysPage() {
  return (
    <AppShell>
      <Keys />
    </AppShell>
  )
}

function Keys() {
  const keys = useQuery(convexQuery(api.apiKeys.list, {}))
  const createKey = useMutation(api.apiKeys.create)
  const revokeKey = useMutation(api.apiKeys.revoke)

  const [label, setLabel] = useState('')
  const [newKey, setNewKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">API Keys</h1>
        <p className="text-sm text-zinc-400">
          Use these as <code className="text-zinc-300">Authorization: Bearer &lt;key&gt;</code> against{' '}
          <code className="text-zinc-300">/v1</code>.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create a key</CardTitle>
          <CardDescription>The secret is shown once and cannot be retrieved again.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            className="flex items-end gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              if (!label.trim()) return
              void createKey({ label: label.trim() }).then((res) => {
                setNewKey(res.key)
                setCopied(false)
                setLabel('')
              })
            }}
          >
            <div className="flex-1 space-y-2">
              <Label htmlFor="key-label">Label</Label>
              <Input
                id="key-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="production server"
              />
            </div>
            <Button type="submit">Create</Button>
          </form>

          {newKey ? (
            <div className="space-y-2 rounded-md border border-amber-700/50 bg-amber-950/30 p-3">
              <p className="text-xs text-amber-300">
                Copy your new key now — it will not be shown again.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 overflow-x-auto rounded bg-zinc-900 px-3 py-2 font-mono text-xs">
                  {newKey}
                </code>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    void navigator.clipboard.writeText(newKey).then(() => setCopied(true))
                  }}
                >
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your keys</CardTitle>
        </CardHeader>
        <CardContent>
          {keys.data && keys.data.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-zinc-500">
                  <tr>
                    <th className="pb-2 font-medium">Label</th>
                    <th className="pb-2 font-medium">Prefix</th>
                    <th className="pb-2 font-medium">Last used</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2" />
                  </tr>
                </thead>
                <tbody>
                  {keys.data.map((key) => (
                    <tr key={key._id} className="border-t border-zinc-800">
                      <td className="py-2">{key.label}</td>
                      <td className="py-2 font-mono text-xs text-zinc-400">forge_{key.prefix}_…</td>
                      <td className="py-2 text-zinc-400">
                        {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : 'never'}
                      </td>
                      <td className="py-2">
                        {key.revoked ? (
                          <span className="text-red-400">revoked</span>
                        ) : (
                          <span className="text-emerald-400">active</span>
                        )}
                      </td>
                      <td className="py-2 text-right">
                        {!key.revoked ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void revokeKey({ apiKeyId: key._id })}
                          >
                            Revoke
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-zinc-500">No keys yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
