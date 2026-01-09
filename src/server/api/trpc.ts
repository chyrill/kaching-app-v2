/**
 * YOU PROBABLY DON'T NEED TO EDIT THIS FILE, UNLESS:
 * 1. You want to modify request context (see Part 1).
 * 2. You want to create a new middleware or type of procedure (see Part 3).
 *
 * TL;DR - This is where all the tRPC server stuff is created and plugged in. The pieces you will
 * need to use are documented accordingly near the end.
 */

import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";

import { auth } from "~/server/auth";
import { db } from "~/server/db";

/**
 * 1. CONTEXT
 *
 * This section defines the "contexts" that are available in the backend API.
 *
 * These allow you to access things when processing a request, like the database, the session, etc.
 *
 * This helper generates the "internals" for a tRPC context. The API handler and RSC clients each
 * wrap this and provides the required context.
 *
 * @see https://trpc.io/docs/server/context
 */
export const createTRPCContext = async (opts: { headers: Headers }) => {
  const session = await auth();

  return {
    db,
    session,
    ...opts,
  };
};

/**
 * 2. INITIALIZATION
 *
 * This is where the tRPC API is initialized, connecting the context and transformer. We also parse
 * ZodErrors so that you get typesafety on the frontend if your procedure fails due to validation
 * errors on the backend.
 */
const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

/**
 * Create a server-side caller.
 *
 * @see https://trpc.io/docs/server/server-side-calls
 */
export const createCallerFactory = t.createCallerFactory;

/**
 * 3. ROUTER & PROCEDURE (THE IMPORTANT BIT)
 *
 * These are the pieces you use to build your tRPC API. You should import these a lot in the
 * "/src/server/api/routers" directory.
 */

/**
 * This is how you create new routers and sub-routers in your tRPC API.
 *
 * @see https://trpc.io/docs/router
 */
export const createTRPCRouter = t.router;

/**
 * Middleware for timing procedure execution and adding an artificial delay in development.
 *
 * You can remove this if you don't like it, but it can help catch unwanted waterfalls by simulating
 * network latency that would occur in production but not in local development.
 */
const timingMiddleware = t.middleware(async ({ next, path }) => {
  const start = Date.now();

  if (t._config.isDev) {
    // artificial delay in dev
    const waitMs = Math.floor(Math.random() * 400) + 100;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  const result = await next();

  const end = Date.now();
  console.log(`[TRPC] ${path} took ${end - start}ms to execute`);

  return result;
});

/**
 * Public (unauthenticated) procedure
 *
 * This is the base piece you use to build new queries and mutations on your tRPC API. It does not
 * guarantee that a user querying is authorized, but you can still access user session data if they
 * are logged in.
 */
export const publicProcedure = t.procedure.use(timingMiddleware);

/**
 * Protected (authenticated) procedure
 *
 * If you want a query or mutation to ONLY be accessible to logged in users, use this. It verifies
 * the session is valid and guarantees `ctx.session.user` is not null.
 *
 * @see https://trpc.io/docs/procedures
 */
export const protectedProcedure = t.procedure
  .use(timingMiddleware)
  .use(({ ctx, next }) => {
    if (!ctx.session?.user) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    return next({
      ctx: {
        // infers the `session` as non-nullable
        session: { ...ctx.session, user: ctx.session.user },
      },
    });
  });

/**
 * Helper to extract shopId from input
 */
function getShopIdFromInput(input: unknown): string | null {
  // Handle direct input: { shopId: "..." }
  if (typeof input === "object" && input !== null && "shopId" in input) {
    const shopId = (input as { shopId: unknown }).shopId;
    if (typeof shopId === "string") {
      return shopId;
    }
  }
  
  // Handle batched input: { "0": { json: { shopId: "..." } } }
  if (typeof input === "object" && input !== null && "0" in input) {
    const batch = (input as { "0": unknown })["0"];
    if (typeof batch === "object" && batch !== null && "json" in batch) {
      const json = (batch as { json: unknown }).json;
      if (typeof json === "object" && json !== null && "shopId" in json) {
        const shopId = (json as { shopId: unknown }).shopId;
        if (typeof shopId === "string") {
          return shopId;
        }
      }
    }
  }
  
  return null;
}

/**
 * Shop member procedure (any role)
 * 
 * Ensures user is authenticated and belongs to the shop.
 * Adds shopId and role to context.
 */
export const shopMemberProcedure = protectedProcedure.use(async (opts) => {
  const shopId = getShopIdFromInput(opts.input);

  if (!shopId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Shop ID is required",
    });
  }

  const shopUser = await opts.ctx.db.shopUser.findFirst({
    where: {
      userId: opts.ctx.session.user.id,
      shopId: shopId,
    },
  });

  if (!shopUser) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You are not a member of this shop",
    });
  }

  return opts.next({
    ctx: {
      ...opts.ctx,
      shopId,
      role: shopUser.role,
    },
  });
});

/**
 * Owner procedure helper
 * Call this inside your mutation/query after input is parsed
 */
export async function enforceOwner(ctx: { db: typeof db; session: { user: { id: string } } }, shopId: string) {
  const shopUser = await ctx.db.shopUser.findFirst({
    where: {
      userId: ctx.session.user.id,
      shopId: shopId,
      role: "OWNER",
    },
  });

  if (!shopUser) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You must be a shop owner to perform this action",
    });
  }

  return shopUser;
}

/**
 * Owner procedure (DEPRECATED - use enforceOwner in procedure body instead)
 * 
 * This is kept for backwards compatibility but should not be used for new code
 * because middleware runs before input parsing.
 */
export const ownerProcedure = protectedProcedure;

/**
 * Accountant or Owner procedure
 * 
 * Ensures user is authenticated and has ACCOUNTANT or OWNER role in the shop.
 */
export const accountantOrOwnerProcedure = protectedProcedure.use(
  async (opts) => {
    const shopId = getShopIdFromInput(opts.input);

    if (!shopId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Shop ID is required",
      });
    }

    const shopUser = await opts.ctx.db.shopUser.findFirst({
      where: {
        userId: opts.ctx.session.user.id,
        shopId: shopId,
        role: { in: ["OWNER", "ACCOUNTANT"] },
      },
    });

    if (!shopUser) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You must be a shop owner or accountant to perform this action",
      });
    }

    return opts.next({
      ctx: {
        ...opts.ctx,
        shopId,
        role: shopUser.role,
      },
    });
  },
);
