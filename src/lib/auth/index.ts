import NextAuth, { type DefaultSession } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import Google from 'next-auth/providers/google'
import { DrizzleAdapter } from '@auth/drizzle-adapter'
import { db, users, accounts, sessions, verificationTokens } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
    } & DefaultSession['user']
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/sign-in',
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) token.id = user.id
      return token
    },
    session({ session, token }) {
      session.user.id = token.id as string
      return session
    },
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, credentials.email as string))
          .limit(1)

        if (!user?.password) return null

        const valid = await bcrypt.compare(credentials.password as string, user.password)
        if (!valid) return null

        return { id: user.id, email: user.email, name: user.name }
      },
    }),
  ],
})
