import { z } from "zod";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";

/**
 * Post Router (Placeholder from T3 Stack)
 * 
 * This is a simple example router. Actual feature routers will be added in:
 * - Epic 2: User authentication (auth router)
 * - Epic 3: Shop management (shop router)
 * - Epic 4: Shopee integration (shopee router)
 * - Epic 5: Receipt generation (receipt router)
 * - Epic 6: Inventory management (inventory router)
 * - Epic 7: Expenditure tracking (expenditure router)
 */
export const postRouter = createTRPCRouter({
  hello: publicProcedure
    .input(z.object({ text: z.string() }))
    .query(({ input }) => {
      return {
        greeting: `Hello ${input.text}`,
      };
    }),

  getSecretMessage: protectedProcedure.query(() => {
    return "you can now see this secret message!";
  }),
});
