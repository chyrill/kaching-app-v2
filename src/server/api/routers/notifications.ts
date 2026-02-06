import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";

export const notificationsRouter = createTRPCRouter({
  /**
   * Get notification preferences for a shop
   */
  getPreferences: protectedProcedure
    .input(z.object({
      shopId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      // Check user has access to this shop
      const membership = await ctx.db.shopMembership.findFirst({
        where: {
          userId: ctx.session.user.id,
          shopId: input.shopId,
        },
      });

      if (!membership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to this shop",
        });
      }

      // Get or create preferences
      let prefs = await ctx.db.notificationPreferences.findFirst({
        where: {
          userId: ctx.session.user.id,
          shopId: input.shopId,
        },
      });

      // Create default preferences if they don't exist
      if (!prefs) {
        prefs = await ctx.db.notificationPreferences.create({
          data: {
            userId: ctx.session.user.id,
            shopId: input.shopId,
          },
        });
      }

      return prefs;
    }),

  /**
   * Update notification preferences
   */
  updatePreferences: protectedProcedure
    .input(z.object({
      shopId: z.string(),
      emailNewOrders: z.boolean().optional(),
      emailOrderStatusChange: z.boolean().optional(),
      emailLowStock: z.boolean().optional(),
      emailOutOfStock: z.boolean().optional(),
      emailWeeklyReport: z.boolean().optional(),
      lowStockFrequency: z.enum(['instant', 'daily', 'weekly']).optional(),
      lowStockThreshold: z.number().int().min(0).nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { shopId, ...updateData } = input;

      // Check user has access to this shop
      const membership = await ctx.db.shopMembership.findFirst({
        where: {
          userId: ctx.session.user.id,
          shopId,
        },
      });

      if (!membership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to this shop",
        });
      }

      // Update or create preferences
      const prefs = await ctx.db.notificationPreferences.upsert({
        where: {
          userId_shopId: {
            userId: ctx.session.user.id,
            shopId,
          },
        },
        create: {
          userId: ctx.session.user.id,
          shopId,
          ...updateData,
        },
        update: updateData,
      });

      return prefs;
    }),

  /**
   * Get email logs for a shop (paginated)
   */
  getEmailLogs: protectedProcedure
    .input(z.object({
      shopId: z.string(),
      emailType: z.enum(['new_order', 'order_status', 'low_stock', 'out_of_stock', 'weekly_report']).optional(),
      status: z.enum(['sent', 'failed', 'bounced']).optional(),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(20),
    }))
    .query(async ({ ctx, input }) => {
      // Check user has access to this shop (OWNER or ACCOUNTANT only)
      const membership = await ctx.db.shopMembership.findFirst({
        where: {
          userId: ctx.session.user.id,
          shopId: input.shopId,
          role: { in: ['OWNER', 'ACCOUNTANT'] },
        },
      });

      if (!membership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to view email logs",
        });
      }

      const where = {
        shopId: input.shopId,
        ...(input.emailType && { emailType: input.emailType }),
        ...(input.status && { status: input.status }),
      };

      const [logs, total] = await Promise.all([
        ctx.db.emailLog.findMany({
          where,
          orderBy: { sentAt: 'desc' },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
        ctx.db.emailLog.count({ where }),
      ]);

      return {
        logs,
        total,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.ceil(total / input.pageSize),
      };
    }),

  /**
   * Get email statistics for a shop
   */
  getEmailStats: protectedProcedure
    .input(z.object({
      shopId: z.string(),
      days: z.number().int().min(1).max(90).default(30),
    }))
    .query(async ({ ctx, input }) => {
      // Check user has access to this shop
      const membership = await ctx.db.shopMembership.findFirst({
        where: {
          userId: ctx.session.user.id,
          shopId: input.shopId,
          role: { in: ['OWNER', 'ACCOUNTANT'] },
        },
      });

      if (!membership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to view email stats",
        });
      }

      const since = new Date();
      since.setDate(since.getDate() - input.days);

      const logs = await ctx.db.emailLog.findMany({
        where: {
          shopId: input.shopId,
          sentAt: { gte: since },
        },
        select: {
          emailType: true,
          status: true,
        },
      });

      // Calculate stats
      const stats = {
        total: logs.length,
        sent: logs.filter(l => l.status === 'sent').length,
        failed: logs.filter(l => l.status === 'failed').length,
        bounced: logs.filter(l => l.status === 'bounced').length,
        byType: {
          new_order: logs.filter(l => l.emailType === 'new_order').length,
          order_status: logs.filter(l => l.emailType === 'order_status').length,
          low_stock: logs.filter(l => l.emailType === 'low_stock').length,
          out_of_stock: logs.filter(l => l.emailType === 'out_of_stock').length,
          weekly_report: logs.filter(l => l.emailType === 'weekly_report').length,
        },
      };

      return stats;
    }),

  /**
   * Get low stock summary for a shop
   */
  getLowStockSummary: protectedProcedure
    .input(z.object({
      shopId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      // Check user has access to this shop
      const membership = await ctx.db.shopMembership.findFirst({
        where: {
          userId: ctx.session.user.id,
          shopId: input.shopId,
        },
      });

      if (!membership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to this shop",
        });
      }

      // Import dynamically to avoid circular dependencies
      const { getLowStockSummary } = await import('~/lib/notifications/low-stock-check');
      const summaries = await getLowStockSummary(input.shopId);
      
      return summaries[0] || null;
    }),

  /**
   * Manually trigger low stock check for a shop (OWNER only)
   */
  checkLowStock: protectedProcedure
    .input(z.object({
      shopId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check user is OWNER
      const membership = await ctx.db.shopMembership.findFirst({
        where: {
          userId: ctx.session.user.id,
          shopId: input.shopId,
          role: 'OWNER',
        },
      });

      if (!membership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only shop owners can trigger low stock checks",
        });
      }

      // Import dynamically to avoid circular dependencies
      const { checkLowStockAndNotify } = await import('~/lib/notifications/low-stock-check');
      const results = await checkLowStockAndNotify({ shopId: input.shopId });
      
      return results[0] || null;
    }),
});
