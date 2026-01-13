import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  protectedProcedure,
  enforceOwner,
} from "~/server/api/trpc";

export const shopeeRouter = createTRPCRouter({
  /**
   * Get Shopee integration status for a shop
   * Only OWNER can view integration status
   */
  getIntegrationStatus: protectedProcedure
    .input(z.object({ shopId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Enforce owner access
      await enforceOwner(ctx, input.shopId);

      const integration = await ctx.db.shopeeIntegration.findUnique({
        where: { shopId: input.shopId },
        select: {
          id: true,
          shopeeShopId: true,
          status: true,
          lastSyncAt: true,
          failureCount: true,
          expiresAt: true,
          deletedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!integration) {
        return {
          connected: false,
          status: null,
          lastSyncAt: null,
          failureCount: 0,
          isDeleted: false,
        };
      }

      return {
        connected: true,
        status: integration.status,
        lastSyncAt: integration.lastSyncAt,
        failureCount: integration.failureCount,
        expiresAt: integration.expiresAt,
        isDeleted: !!integration.deletedAt,
        connectedAt: integration.createdAt,
      };
    }),

  /**
   * Disconnect Shopee integration
   * Only OWNER can disconnect
   * Story 4.7: Disconnect Shopee Integration
   */
  disconnect: protectedProcedure
    .input(z.object({ shopId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Enforce owner access
      await enforceOwner(ctx, input.shopId);

      const integration = await ctx.db.shopeeIntegration.findUnique({
        where: { shopId: input.shopId },
      });

      if (!integration) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Shopee integration not found",
        });
      }

      if (integration.deletedAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Integration already disconnected",
        });
      }

      // Soft delete: clear tokens and set deletedAt
      await ctx.db.shopeeIntegration.update({
        where: { shopId: input.shopId },
        data: {
          accessToken: "",
          refreshToken: "",
          deletedAt: new Date(),
          status: "DISCONNECTED",
        },
      });

      // TODO: Pause webhook processing for this shop

      return {
        success: true,
        message: "Shopee disconnected successfully",
      };
    }),

  /**
   * Get products synced from Shopee
   * All team members can view products
   */
  getProducts: protectedProcedure
    .input(
      z.object({
        shopId: z.string(),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Check user has access to this shop
      const membership = await ctx.db.shopUser.findFirst({
        where: {
          shopId: input.shopId,
          userId: ctx.session.user.id,
        },
      });

      if (!membership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have access to this shop",
        });
      }

      const products = await ctx.db.product.findMany({
        where: {
          shopId: input.shopId,
          platform: "SHOPEE",
        },
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        orderBy: {
          updatedAt: "desc",
        },
      });

      let nextCursor: string | undefined = undefined;
      if (products.length > input.limit) {
        const nextItem = products.pop();
        nextCursor = nextItem?.id;
      }

      return {
        products,
        nextCursor,
      };
    }),

  /**
   * Get orders from Shopee webhooks
   * Owners and Accountants can view orders
   */
  getOrders: protectedProcedure
    .input(
      z.object({
        shopId: z.string(),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Check user has access to this shop
      const membership = await ctx.db.shopUser.findFirst({
        where: {
          shopId: input.shopId,
          userId: ctx.session.user.id,
        },
      });

      if (!membership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have access to this shop",
        });
      }

      // Only OWNER and ACCOUNTANT can view orders
      if (membership.role !== "OWNER" && membership.role !== "ACCOUNTANT") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have permission to view orders",
        });
      }

      const orders = await ctx.db.order.findMany({
        where: {
          shopId: input.shopId,
          platform: "SHOPEE",
        },
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        orderBy: {
          orderDate: "desc",
        },
      });

      let nextCursor: string | undefined = undefined;
      if (orders.length > input.limit) {
        const nextItem = orders.pop();
        nextCursor = nextItem?.id;
      }

      return {
        orders,
        nextCursor,
      };
    }),
});
