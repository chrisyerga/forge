import { useState } from 'react'
import { useAuthActions } from '@convex-dev/auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ForgeLogo } from '@/components/ForgeLogo'

export function SignIn() {
  const { signIn } = useAuthActions()
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="flex justify-center">
            <ForgeLogo size="sm" />
          </CardTitle>
          <CardDescription>Sign in to your account</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              setError(null)
              setSubmitting(true)
              const formData = new FormData(event.currentTarget)
              formData.set('flow', 'signIn')
              void signIn('password', formData)
                .catch((err: unknown) =>
                  setError(err instanceof Error ? err.message : 'Something went wrong'),
                )
                .finally(() => setSubmitting(false))
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </div>
            {error ? <p className="text-sm text-red-400">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={submitting}>
              Sign in
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
