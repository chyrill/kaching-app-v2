import { PrismaAdapter } from "@auth/prisma-adapter";
import { type DefaultSession, type NextAuthConfig } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import DiscordProvider from "next-auth/providers/discord";
import bcrypt from "bcryptjs";

import { db } from "~/server/db";

/**
 * Module augmentation for `next-auth` types. Allows us to add custom properties to the `session`
 * object and keep type safety.
 *
 * @see https://next-auth.js.org/getting-started/typescript#module-augmentation
 */
declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      defaultShopId?: string;
      // ...other properties
      // role: UserRole;
    } & DefaultSession["user"];
  }

  // interface User {
  //   // ...other properties
  //   // role: UserRole;
  // }
}

/**
 * Options for NextAuth.js used to configure adapters, providers, callbacks, etc.
 *
 * @see https://next-auth.js.org/configuration/options
 */
export const authConfig = {
  debug: process.env.NODE_ENV === "development",
  trustHost: true,
  basePath: "/api/auth",
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await db.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user?.password) {
          return null;
        }

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.password,
        );

        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
    DiscordProvider,
    /**
     * ...add more providers here.
     *
     * Most other providers require a bit more work than the Discord provider. For example, the
     * GitHub provider requires you to add the `refresh_token_expires_in` field to the Account
     * model. Refer to the NextAuth.js docs for the provider you want to use. Example:
     *
     * @see https://next-auth.js.org/providers/github
     */
  ],
  // Note: PrismaAdapter removed - it's incompatible with JWT strategy
  // Using JWT strategy for stateless sessions (no database lookups on each request)
  pages: {
    signIn: "/auth/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // 7 days idle timeout
    // Note: JWT strategy has limitations:
    // - maxAge is idle timeout (resets on each request)
    // - No absolute timeout (e.g., 30 days total) without additional logic
    // - Cannot invalidate tokens server-side (e.g., on password change)
    // - Tokens remain valid until expiry across all devices
    // Trade-off: Zero database cost, infinite scalability
  },
  callbacks: {
    jwt: async ({ token, user, trigger }) => {
      // Only run on initial login (when user object exists)
      // This prevents database queries on every request
      if (user) {
        token.id = user.id;
        token.email = user.email;

        try {
          // Fetch user's default shop ONLY on initial login
          const userWithShops = await db.user.findUnique({
            where: { id: user.id },
            include: {
              shopMemberships: {
                take: 1,
                orderBy: { joinedAt: "asc" },
                include: { shop: true },
              },
            },
          });

          token.defaultShopId = userWithShops?.shopMemberships[0]?.shop.id ?? null;
        } catch (error) {
          console.error("Failed to fetch defaultShopId:", error);
          // Don't fail the entire session if shop lookup fails
          token.defaultShopId = null;
        }
      }
      
      return token;
    },
    session: ({ session, token }) => ({
      ...session,
      user: {
        ...session.user,
        id: token.id as string,
        defaultShopId: token.defaultShopId as string | undefined,
      },
    }),
  },
} satisfies NextAuthConfig;
