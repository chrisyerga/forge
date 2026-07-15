import { Password } from '@convex-dev/auth/providers/Password'
import { convexAuth } from '@convex-dev/auth/server'

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      profile(params) {
        if (params.flow === 'signUp') {
          throw new Error('New account sign-ups are currently disabled.')
        }
        return { email: params.email as string }
      },
    }),
  ],
})
