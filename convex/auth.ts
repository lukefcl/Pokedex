import { convexAuth } from '@convex-dev/auth/server';
import { Password } from '@convex-dev/auth/providers/Password';
import { ConvexError } from 'convex/values';
// Device accounts use a generated 256-bit secret, exported only in the owner's
// recovery file. Friend invites never contain an account credential.
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      profile(params) {
        const email = String(params.email || '');
        if (!/^findex-[a-f0-9]{32}@device\.invalid$/.test(email))
          throw new ConvexError('Choose a valid FINDEX recovery file.');
        return { email };
      },
      validatePasswordRequirements(secret) {
        if (!/^[A-Za-z0-9_-]{43}$/.test(secret))
          throw new ConvexError('Invalid recovery credential.');
      },
    }),
  ],
  session: {
    totalDurationMs: 1000 * 60 * 60 * 24 * 365,
    inactiveDurationMs: 1000 * 60 * 60 * 24 * 90,
  },
});
