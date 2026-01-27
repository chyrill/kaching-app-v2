import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  protectedProcedure,
  enforceOwner,
} from "~/server/api/trpc";
import { getImportJobStatus } from "~/lib/queue";

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
   * Get product import job status
   * Shows progress of catalog import after OAuth connection
   * Story 4.2: Import Product Catalog from Shopee
   */
  getImportStatus: protectedProcedure
    .input(z.object({ shopId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Enforce owner access
      await enforceOwner(ctx, input.shopId);

      const jobStatus = await getImportJobStatus(input.shopId);

      return {
        status: jobStatus.status,
        progress: jobStatus.progress,
        failedReason: jobStatus.failedReason,
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

  /**
   * Get single order details
   * Story 5.2: Order details page
   */
  getOrderDetails: protectedProcedure
    .input(z.object({ 
      shopId: z.string(),
      orderId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      // Check user has access to shop
      const membership = await ctx.db.shopUser.findUnique({
        where: {
          userId_shopId: {
            userId: ctx.session.user.id,
            shopId: input.shopId,
          },
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

      const order = await ctx.db.order.findUnique({
        where: {
          id: input.orderId,
        },
      });

      if (!order) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Order not found",
        });
      }

      // Verify order belongs to the shop
      if (order.shopId !== input.shopId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Order does not belong to this shop",
        });
      }

      return order;
    }),

  /**
   * Update order status
   * Story 5.3: Order status management
   */
  updateOrderStatus: protectedProcedure
    .input(z.object({
      shopId: z.string(),
      orderId: z.string(),
      newStatus: z.enum(["pending", "processing", "shipped", "completed", "cancelled"]),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check user has access to shop
      const membership = await ctx.db.shopUser.findUnique({
        where: {
          userId_shopId: {
            userId: ctx.session.user.id,
            shopId: input.shopId,
          },
        },
      });

      if (!membership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have access to this shop",
        });
      }

      // Only OWNER and ACCOUNTANT can update order status
      if (membership.role !== "OWNER" && membership.role !== "ACCOUNTANT") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have permission to update order status",
        });
      }

      // Get current order
      const order = await ctx.db.order.findUnique({
        where: {
          id: input.orderId,
        },
      });

      if (!order) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Order not found",
        });
      }

      // Verify order belongs to the shop
      if (order.shopId !== input.shopId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Order does not belong to this shop",
        });
      }

      // Validate status transition
      const currentStatus = order.status.toLowerCase();
      const validTransitions: Record<string, string[]> = {
        pending: ["processing", "cancelled"],
        processing: ["shipped", "cancelled"],
        shipped: ["completed", "cancelled"],
        completed: [],
        cancelled: [],
      };

      const allowedTransitions = validTransitions[currentStatus] ?? [];
      
      if (!allowedTransitions.includes(input.newStatus) && currentStatus !== input.newStatus) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot transition from ${currentStatus} to ${input.newStatus}. Allowed transitions: ${allowedTransitions.join(", ") || "none"}`,
        });
      }

      // Update order status
      const updatedOrder = await ctx.db.order.update({
        where: {
          id: input.orderId,
        },
        data: {
          status: input.newStatus,
          updatedAt: new Date(),
        },
      });

      return updatedOrder;
    }),

  /**
   * Update order fulfillment tracking (Story 5.4)
   */
  updateOrderFulfillment: protectedProcedure
    .input(
      z.object({
        shopId: z.string(),
        orderId: z.string(),
        trackingNumber: z.string().min(1, "Tracking number is required"),
        carrier: z.string().min(1, "Carrier is required"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify user has access to this shop
      const shopUser = await ctx.db.shopUser.findUnique({
        where: {
          userId_shopId: {
            userId: ctx.session.user.id,
            shopId: input.shopId,
          },
        },
      });

      if (!shopUser || (shopUser.role !== "OWNER" && shopUser.role !== "ACCOUNTANT")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to update order fulfillment",
        });
      }

      // Verify order belongs to the shop
      const order = await ctx.db.order.findUnique({
        where: {
          id: input.orderId,
        },
      });

      if (order?.shopId !== input.shopId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Order not found",
        });
      }

      // Only allow tracking for shipped or completed orders
      if (order.status !== "shipped" && order.status !== "completed") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Can only add tracking for shipped or completed orders",
        });
      }

      // Update order with fulfillment info
      const updatedOrder = await ctx.db.order.update({
        where: {
          id: input.orderId,
        },
        data: {
          trackingNumber: input.trackingNumber,
          carrier: input.carrier,
          shippedAt: order.shippedAt ?? new Date(), // Set shippedAt if not already set
          updatedAt: new Date(),
        },
      });

      return updatedOrder;
    }),

  /**
   * Mark order as delivered (Story 5.4)
   */
  markOrderDelivered: protectedProcedure
    .input(
      z.object({
        shopId: z.string(),
        orderId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify user has access to this shop
      const shopUser = await ctx.db.shopUser.findUnique({
        where: {
          userId_shopId: {
            userId: ctx.session.user.id,
            shopId: input.shopId,
          },
        },
      });

      if (!shopUser || (shopUser.role !== "OWNER" && shopUser.role !== "ACCOUNTANT")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to mark orders as delivered",
        });
      }

      // Verify order belongs to the shop and has tracking
      const order = await ctx.db.order.findUnique({
        where: {
          id: input.orderId,
        },
      });

      if (order?.shopId !== input.shopId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Order not found",
        });
      }

      if (!order.trackingNumber) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Order must have tracking information before marking as delivered",
        });
      }

      // Update order with delivery timestamp
      const updatedOrder = await ctx.db.order.update({
        where: {
          id: input.orderId,
        },
        data: {
          deliveredAt: new Date(),
          status: "completed", // Auto-complete when delivered
          updatedAt: new Date(),
        },
      });

      return updatedOrder;
    }),

  /**
   * Get unhealthy integrations (admin/monitoring)
   * Story 4.8: Health monitoring
   */
  getUnhealthyIntegrations: protectedProcedure
    .query(async ({ ctx }) => {
      // Get all shops where user is OWNER
      const ownedShops = await ctx.db.shopUser.findMany({
        where: {
          userId: ctx.session.user.id,
          role: "OWNER",
        },
        select: {
          shopId: true,
        },
      });

      const shopIds = ownedShops.map((m) => m.shopId);

      // Get unhealthy integrations for those shops
      const unhealthyIntegrations = await ctx.db.shopeeIntegration.findMany({
        where: {
          shopId: { in: shopIds },
          status: "UNHEALTHY",
          deletedAt: null,
        },
        include: {
          shop: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          lastFailureAt: "desc",
        },
      });

      return unhealthyIntegrations.map((integration) => ({
        shopId: integration.shopId,
        shopName: integration.shop.name,
        failureCount: integration.failureCount,
        lastFailureAt: integration.lastFailureAt ?? null,
        lastSyncAt: integration.lastSyncAt,
      }));
    }),

  /**
   * Export orders to CSV (Story 5.5)
   */
  exportOrders: protectedProcedure
    .input(
      z.object({
        shopId: z.string(),
        search: z.string().optional(),
        status: z.string().optional(),
        platform: z.string().optional(),
        dateRange: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Verify user has access to this shop
      const shopUser = await ctx.db.shopUser.findUnique({
        where: {
          userId_shopId: {
            userId: ctx.session.user.id,
            shopId: input.shopId,
          },
        },
      });

      if (!shopUser || (shopUser.role !== "OWNER" && shopUser.role !== "ACCOUNTANT")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to export orders",
        });
      }

      // Build where clause (same logic as getOrders)
      const where: any = { shopId: input.shopId };

      if (input.search) {
        where.OR = [
          { orderNumber: { contains: input.search, mode: "insensitive" } },
          { customerName: { contains: input.search, mode: "insensitive" } },
        ];
      }

      if (input.status && input.status !== "all") {
        where.status = input.status;
      }

      if (input.platform && input.platform !== "all") {
        where.platform = input.platform.toUpperCase();
      }

      if (input.dateRange && input.dateRange !== "all") {
        const now = new Date();
        let startDate: Date;

        switch (input.dateRange) {
          case "today":
            startDate = new Date(now.setHours(0, 0, 0, 0));
            break;
          case "week":
            startDate = new Date(now.setDate(now.getDate() - 7));
            break;
          case "month":
            startDate = new Date(now.setDate(now.getDate() - 30));
            break;
          case "quarter":
            startDate = new Date(now.setDate(now.getDate() - 90));
            break;
          default:
            startDate = new Date(0);
        }

        where.orderDate = { gte: startDate };
      }

      // Fetch all matching orders (no limit)
      const orders = await ctx.db.order.findMany({
        where,
        orderBy: { orderDate: "desc" },
      });

      // Generate CSV content
      const headers = [
        "Order Number",
        "Customer Name",
        "Email",
        "Phone",
        "Order Date",
        "Platform",
        "Status",
        "Total Amount",
        "Tracking Number",
        "Carrier",
        "Shipped Date",
        "Delivered Date",
        "Notes",
      ];

      const rows = orders.map((order) => [
        order.orderNumber,
        order.customerName,
        order.customerEmail ?? "",
        order.customerPhone ?? "",
        new Date(order.orderDate).toLocaleDateString(),
        order.platform,
        order.status,
        order.totalAmount.toString(),
        order.trackingNumber ?? "",
        order.carrier ?? "",
        order.shippedAt ? new Date(order.shippedAt).toLocaleDateString() : "",
        order.deliveredAt ? new Date(order.deliveredAt).toLocaleDateString() : "",
        order.notes ?? "",
      ]);

      const csvContent = [
        headers.join(","),
        ...rows.map((row) =>
          row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
        ),
      ].join("\n");

      return { csv: csvContent, count: orders.length };
    }),

  /**
   * Update order notes (Story 5.5)
   */
  updateOrderNotes: protectedProcedure
    .input(
      z.object({
        shopId: z.string(),
        orderId: z.string(),
        notes: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify user has access to this shop
      const shopUser = await ctx.db.shopUser.findUnique({
        where: {
          userId_shopId: {
            userId: ctx.session.user.id,
            shopId: input.shopId,
          },
        },
      });

      if (!shopUser || (shopUser.role !== "OWNER" && shopUser.role !== "ACCOUNTANT")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to update order notes",
        });
      }

      // Verify order belongs to the shop
      const order = await ctx.db.order.findUnique({
        where: { id: input.orderId },
      });

      if (order?.shopId !== input.shopId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Order not found",
        });
      }

      // Update order notes
      const updatedOrder = await ctx.db.order.update({
        where: { id: input.orderId },
        data: {
          notes: input.notes,
          updatedAt: new Date(),
        },
      });

      return updatedOrder;
    }),

  /**
   * Bulk update order status (Story 5.5)
   */
  bulkUpdateOrderStatus: protectedProcedure
    .input(
      z.object({
        shopId: z.string(),
        orderIds: z.array(z.string()).min(1, "At least one order must be selected"),
        newStatus: z.enum(["pending", "processing", "shipped", "completed", "cancelled"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify user has access to this shop
      const shopUser = await ctx.db.shopUser.findUnique({
        where: {
          userId_shopId: {
            userId: ctx.session.user.id,
            shopId: input.shopId,
          },
        },
      });

      if (!shopUser || (shopUser.role !== "OWNER" && shopUser.role !== "ACCOUNTANT")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to update orders",
        });
      }

      // Verify all orders belong to the shop
      const orders = await ctx.db.order.findMany({
        where: {
          id: { in: input.orderIds },
          shopId: input.shopId,
        },
      });

      if (orders.length !== input.orderIds.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Some orders were not found or don't belong to this shop",
        });
      }

      // Validate status transitions for each order
      const statusTransitions: Record<string, string[]> = {
        pending: ["processing", "cancelled"],
        processing: ["shipped", "cancelled"],
        shipped: ["completed", "cancelled"],
        completed: [],
        cancelled: [],
      };

      const invalidOrders = orders.filter((order) => {
        const allowedStatuses = statusTransitions[order.status.toLowerCase()] ?? [];
        return !allowedStatuses.includes(input.newStatus.toLowerCase());
      });

      if (invalidOrders.length > 0) {
        const orderNumbers = invalidOrders.map((o) => o.orderNumber).join(", ");
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot update status for orders: ${orderNumbers}. Check current status and allowed transitions.`,
        });
      }

      // Update all orders
      const result = await ctx.db.order.updateMany({
        where: {
          id: { in: input.orderIds },
        },
        data: {
          status: input.newStatus,
          updatedAt: new Date(),
        },
      });

      return { count: result.count };
    }),

  /**
   * Get order analytics (Story 5.6)
   */
  getOrderAnalytics: protectedProcedure
    .input(
      z.object({
        shopId: z.string(),
        dateRange: z.enum(["today", "week", "month", "quarter", "year", "all"]).default("month"),
      })
    )
    .query(async ({ ctx, input }) => {
      // Verify user has access to this shop
      const shopUser = await ctx.db.shopUser.findUnique({
        where: {
          userId_shopId: {
            userId: ctx.session.user.id,
            shopId: input.shopId,
          },
        },
      });

      if (!shopUser || (shopUser.role !== "OWNER" && shopUser.role !== "ACCOUNTANT")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to view analytics",
        });
      }

      // Calculate date range
      const now = new Date();
      let startDate: Date;
      let previousStartDate: Date;

      switch (input.dateRange) {
        case "today":
          startDate = new Date(now.setHours(0, 0, 0, 0));
          previousStartDate = new Date(startDate);
          previousStartDate.setDate(previousStartDate.getDate() - 1);
          break;
        case "week":
          startDate = new Date(now.setDate(now.getDate() - 7));
          previousStartDate = new Date(startDate);
          previousStartDate.setDate(previousStartDate.getDate() - 7);
          break;
        case "month":
          startDate = new Date(now.setDate(now.getDate() - 30));
          previousStartDate = new Date(startDate);
          previousStartDate.setDate(previousStartDate.getDate() - 30);
          break;
        case "quarter":
          startDate = new Date(now.setDate(now.getDate() - 90));
          previousStartDate = new Date(startDate);
          previousStartDate.setDate(previousStartDate.getDate() - 90);
          break;
        case "year":
          startDate = new Date(now.setDate(now.getDate() - 365));
          previousStartDate = new Date(startDate);
          previousStartDate.setDate(previousStartDate.getDate() - 365);
          break;
        default:
          startDate = new Date(0);
          previousStartDate = new Date(0);
      }

      // Fetch current period orders
      const currentOrders = await ctx.db.order.findMany({
        where: {
          shopId: input.shopId,
          orderDate: input.dateRange !== "all" ? { gte: startDate } : undefined,
        },
        orderBy: { orderDate: "desc" },
      });

      // Fetch previous period orders for comparison
      const previousOrders = input.dateRange !== "all" 
        ? await ctx.db.order.findMany({
            where: {
              shopId: input.shopId,
              orderDate: {
                gte: previousStartDate,
                lt: startDate,
              },
            },
          })
        : [];

      // Calculate current period stats
      const totalRevenue = currentOrders.reduce((sum, order) => 
        sum + Number(order.totalAmount), 0
      );
      const totalOrders = currentOrders.length;
      const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      // Calculate previous period stats
      const previousRevenue = previousOrders.reduce((sum, order) => 
        sum + Number(order.totalAmount), 0
      );
      const previousOrderCount = previousOrders.length;

      // Calculate percentage changes
      const revenueChange = previousRevenue > 0 
        ? ((totalRevenue - previousRevenue) / previousRevenue) * 100 
        : 0;
      const ordersChange = previousOrderCount > 0 
        ? ((totalOrders - previousOrderCount) / previousOrderCount) * 100 
        : 0;

      // Order counts by status
      const statusCounts = {
        pending: currentOrders.filter(o => o.status === "pending").length,
        processing: currentOrders.filter(o => o.status === "processing").length,
        shipped: currentOrders.filter(o => o.status === "shipped").length,
        completed: currentOrders.filter(o => o.status === "completed").length,
        cancelled: currentOrders.filter(o => o.status === "cancelled").length,
      };

      // Revenue by date (last 30 days for chart)
      const last30Days = new Date();
      last30Days.setDate(last30Days.getDate() - 30);
      const recentOrders = currentOrders.filter(o => 
        new Date(o.orderDate) >= last30Days
      );

      // Group by date
      const revenueByDate: Record<string, number> = {};
      recentOrders.forEach(order => {
        const dateKey = new Date(order.orderDate).toISOString().split('T')[0];
        if (dateKey) {
          revenueByDate[dateKey] = (revenueByDate[dateKey] ?? 0) + Number(order.totalAmount);
        }
      });

      // Convert to array and sort
      const revenueTrend = Object.entries(revenueByDate)
        .map(([date, revenue]) => ({ date, revenue }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // Top customers by order count
      const customerCounts: Record<string, number> = {};
      currentOrders.forEach(order => {
        customerCounts[order.customerName] = (customerCounts[order.customerName] ?? 0) + 1;
      });

      const topCustomers = Object.entries(customerCounts)
        .map(([name, count]) => ({ name, orderCount: count }))
        .sort((a, b) => b.orderCount - a.orderCount)
        .slice(0, 5);

      // Recent orders (last 10)
      const recentOrdersList = currentOrders.slice(0, 10);

      return {
        summary: {
          totalRevenue,
          totalOrders,
          averageOrderValue,
          revenueChange,
          ordersChange,
        },
        statusCounts,
        revenueTrend,
        topCustomers,
        recentOrders: recentOrdersList.map(order => ({
          id: order.id,
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          totalAmount: order.totalAmount,
          status: order.status,
          orderDate: order.orderDate,
          platform: order.platform,
        })),
      };
    }),

  /**
   * Get inventory list (Story 6.1)
   */
  getInventory: protectedProcedure
    .input(
      z.object({
        shopId: z.string(),
        search: z.string().optional(),
        platform: z.string().optional(),
        stockFilter: z.enum(["all", "in_stock", "low_stock", "out_of_stock"]).default("all"),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Verify user has access to this shop
      const shopUser = await ctx.db.shopUser.findUnique({
        where: {
          userId_shopId: {
            userId: ctx.session.user.id,
            shopId: input.shopId,
          },
        },
      });

      if (!shopUser) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to view inventory",
        });
      }

      // Build where clause
      const where: any = { shopId: input.shopId };

      if (input.search) {
        where.OR = [
          { name: { contains: input.search, mode: "insensitive" } },
          { sku: { contains: input.search, mode: "insensitive" } },
        ];
      }

      if (input.platform && input.platform !== "all") {
        where.platform = input.platform.toUpperCase();
      }

      // Stock filter logic
      if (input.stockFilter !== "all") {
        if (input.stockFilter === "out_of_stock") {
          where.stock = { lte: 0 };
        } else if (input.stockFilter === "low_stock") {
          // Products where stock <= lowStockThreshold but > 0
          const products = await ctx.db.product.findMany({
            where: {
              ...where,
              stock: { gt: 0 },
            },
          });
          
          // Filter in memory for low stock comparison
          const lowStockProducts = products.filter(p => 
            p.stock <= (p.lowStockThreshold ?? 10)
          );
          
          return {
            products: lowStockProducts.slice(0, input.limit),
            nextCursor: undefined,
          };
        } else if (input.stockFilter === "in_stock") {
          where.stock = { gt: 0 };
        }
      }

      // Fetch products with pagination
      const products = await ctx.db.product.findMany({
        where,
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        orderBy: { updatedAt: "desc" },
      });

      let nextCursor: string | undefined;
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
   * Get inventory summary stats (Story 6.1)
   */
  getInventorySummary: protectedProcedure
    .input(z.object({ shopId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Verify user has access to this shop
      const shopUser = await ctx.db.shopUser.findUnique({
        where: {
          userId_shopId: {
            userId: ctx.session.user.id,
            shopId: input.shopId,
          },
        },
      });

      if (!shopUser) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to view inventory",
        });
      }

      // Get all products for the shop
      const products = await ctx.db.product.findMany({
        where: { shopId: input.shopId },
      });

      // Calculate stats
      const totalProducts = products.length;
      const inStockCount = products.filter(p => p.stock > 0).length;
      const outOfStockCount = products.filter(p => p.stock <= 0).length;
      const lowStockCount = products.filter(p => 
        p.stock > 0 && p.stock <= (p.lowStockThreshold ?? 10)
      ).length;

      // Calculate total inventory value
      const totalInventoryValue = products.reduce((sum, p) => {
        const cost = p.cost ? Number(p.cost) : 0;
        return sum + (cost * p.stock);
      }, 0);

      return {
        totalProducts,
        inStockCount,
        outOfStockCount,
        lowStockCount,
        totalInventoryValue,
      };
    }),

  adjustStock: protectedProcedure
    .input(
      z.object({
        productId: z.string(),
        shopId: z.string(),
        type: z.enum(['INCREASE', 'DECREASE']),
        quantity: z.number().min(1, 'Quantity must be at least 1'),
        reason: z.string().min(1, 'Reason is required'),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { productId, shopId, type, quantity, reason, notes } = input;

      // Verify user has access to this shop
      const shopUser = await ctx.db.shopUser.findFirst({
        where: {
          shopId,
          userId: ctx.session.user.id,
        },
      });

      if (!shopUser) {
        throw new Error('You do not have access to this shop');
      }

      // Get current product stock
      const product = await ctx.db.product.findUnique({
        where: { id: productId },
      });

      if (!product || product.shopId !== shopId) {
        throw new Error('Product not found');
      }

      // Validate DECREASE operation doesn't result in negative stock
      if (type === 'DECREASE' && product.stock < quantity) {
        throw new Error(`Cannot decrease stock by ${quantity}. Current stock is ${product.stock}.`);
      }

      // Calculate new stock
      const stockBefore = product.stock;
      const stockAfter = type === 'INCREASE' 
        ? stockBefore + quantity 
        : stockBefore - quantity;

      // Update stock and create movement record in a transaction
      await ctx.db.$transaction([
        // Update product stock
        ctx.db.product.update({
          where: { id: productId },
          data: { stock: stockAfter },
        }),
        // Create stock movement record
        ctx.db.stockMovement.create({
          data: {
            productId,
            shopId,
            userId: ctx.session.user.id,
            type,
            source: 'MANUAL',
            quantity,
            stockBefore,
            stockAfter,
            reason,
            notes,
          },
        }),
      ]);

      return {
        success: true,
        stockBefore,
        stockAfter,
      };
    }),
});
