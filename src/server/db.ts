import { env } from "~/env";
import { PrismaClient } from "../../generated/prisma";

const createPrismaClient = () => {
  const prisma = new PrismaClient({
    log:
      env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

  /**
   * Multi-Tenant Middleware (Prisma Client Extension)
   * 
   * Automatically injects shopId filtering for all queries on multi-tenant tables.
   * Note: This will be fully activated in Epic 2 when NextAuth session context is available.
   * 
   * Prisma v6+ uses Client Extensions instead of $use middleware:
   * https://www.prisma.io/docs/orm/prisma-client/client-extensions
   * 
   * For now, this is a placeholder showing the pattern. Full implementation in Epic 2 will:
   * 1. Extract session from request context (getServerSession)
   * 2. Return session.user.currentShopId
   * 3. Auto-inject WHERE shopId = {currentShopId} for all multi-tenant queries
   * 
   * Models requiring shopId filtering (will grow in future epics):
   * - Shop, ShopUser (Epic 1)
   * - Order, Receipt, Product, Inventory (Epic 4, 5, 6)
   * - Expenditure, WebhookPayload (Epic 7, 4)
   */
  
  // Placeholder for Epic 2: getCurrentShopId() from session context
  // For now, returns undefined to allow all operations during development
  
  return prisma;
};

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (env.NODE_ENV !== "production") globalForPrisma.prisma = db;
