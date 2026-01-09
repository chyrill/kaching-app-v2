import { z } from "zod";
import { TRPCError } from "@trpc/server";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const shopRouter = createTRPCRouter({
  createShop: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1, "Shop name is required"),
        tinNumber: z
          .string()
          .regex(/^\d{12}$/, "TIN must be 12 digits"),
        businessAddress: z.string().min(1, "Business address is required"),
        contactNumber: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Create shop and shop user in a transaction for atomicity
      const shop = await ctx.db.$transaction(async (tx) => {
        // Create Shop record
        const newShop = await tx.shop.create({
          data: {
            name: input.name,
            tinNumber: input.tinNumber,
            businessAddress: input.businessAddress,
            ownerId: ctx.session.user.id,
          },
        });

        // Create ShopUser junction record with OWNER role
        await tx.shopUser.create({
          data: {
            userId: ctx.session.user.id,
            shopId: newShop.id,
            role: "OWNER",
          },
        });

        return newShop;
      });

      return {
        success: true,
        message: "Shop created successfully",
        shop: {
          id: shop.id,
          name: shop.name,
        },
      };
    }),

  getUserShops: protectedProcedure.query(async ({ ctx }) => {
    const shopMemberships = await ctx.db.shopUser.findMany({
      where: { userId: ctx.session.user.id },
      include: {
        shop: {
          include: {
            _count: {
              select: { members: true },
            },
          },
        },
      },
      orderBy: { joinedAt: "asc" },
    });

    return shopMemberships.map((membership) => ({
      shopId: membership.shop.id,
      name: membership.shop.name,
      role: membership.role,
      memberCount: membership.shop._count.members,
    }));
  }),

  switchShop: protectedProcedure
    .input(
      z.object({
        shopId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify user belongs to this shop
      const shopUser = await ctx.db.shopUser.findFirst({
        where: {
          userId: ctx.session.user.id,
          shopId: input.shopId,
        },
      });

      if (!shopUser) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to this shop",
        });
      }

      // For JWT sessions, we can't update the token directly
      // The session will be updated on the next authenticated request
      // when the JWT callback runs and fetches the new defaultShopId

      return {
        success: true,
        message: "Shop switched successfully",
        shopId: input.shopId,
      };
    }),
});
