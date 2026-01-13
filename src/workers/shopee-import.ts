import { Worker } from "bullmq";
import { Redis } from "ioredis";
import { ShopeeAPIClient } from "~/lib/shopee-api";
import { db } from "~/server/db";
import type { ImportProductsJobData } from "~/lib/queue";

const connection = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

/**
 * Worker for importing Shopee product catalog
 * Story 4.2: Import Product Catalog from Shopee
 */
export const shopeeImportWorker = new Worker(
  "shopee:catalog:import",
  async (job) => {
    const { shopId, offset = 0 } = job.data as ImportProductsJobData;
    const shopeeClient = new ShopeeAPIClient();

    console.log(`[Shopee Import] Starting import for shop ${shopId}, offset ${offset}`);

    try {
      // Fetch products from Shopee
      const result = await shopeeClient.getProductList(shopId, offset, 50);

      console.log(
        `[Shopee Import] Fetched ${result.products.length} products (${offset} of ${result.totalCount})`
      );

      // Import products into database
      let imported = 0;
      for (const shopeeProduct of result.products) {
        await db.product.upsert({
          where: {
            shopId_shopeeProductId: {
              shopId: shopId,
              shopeeProductId: shopeeProduct.item_id.toString(),
            },
          },
          create: {
            shopId: shopId,
            platform: "SHOPEE",
            shopeeProductId: shopeeProduct.item_id.toString(),
            name: shopeeProduct.item_name,
            sku: shopeeProduct.item_sku || null,
            stock: shopeeProduct.stock,
            price: shopeeProduct.price,
            imageUrl: shopeeProduct.images?.[0] ?? null,
          },
          update: {
            name: shopeeProduct.item_name,
            sku: shopeeProduct.item_sku || null,
            stock: shopeeProduct.stock,
            price: shopeeProduct.price,
            imageUrl: shopeeProduct.images?.[0] ?? null,
          },
        });
        imported++;
      }

      // Update progress
      const totalImported = offset + imported;
      await job.updateProgress({
        imported: totalImported,
        total: result.totalCount,
      });

      console.log(
        `[Shopee Import] Imported ${imported} products (${totalImported}/${result.totalCount})`
      );

      // Queue next page if there are more products
      if (result.hasNextPage) {
        console.log(`[Shopee Import] Queueing next page at offset ${result.nextOffset}`);
        await job.queue.add(
          "import-products",
          {
            shopId,
            offset: result.nextOffset,
          } as ImportProductsJobData,
          {
            jobId: `import-${shopId}`,
            delay: 1000, // Small delay to avoid rate limiting
          }
        );
      } else {
        // Update integration lastSyncAt
        await db.shopeeIntegration.update({
          where: { shopId },
          data: { lastSyncAt: new Date() },
        });
        console.log(`[Shopee Import] Completed import for shop ${shopId}`);
      }

      return {
        success: true,
        imported,
        totalImported,
        total: result.totalCount,
        hasMore: result.hasNextPage,
      };
    } catch (error) {
      console.error(`[Shopee Import] Error importing products for shop ${shopId}:`, error);

      // Check if it's a token expiration error
      if (error instanceof Error && error.message.includes("token")) {
        try {
          console.log(`[Shopee Import] Attempting to refresh token for shop ${shopId}`);
          await shopeeClient.refreshAccessToken(shopId);
          // Retry the job
          throw new Error("Token refreshed, retrying import");
        } catch (refreshError) {
          console.error(`[Shopee Import] Failed to refresh token:`, refreshError);
          // Mark integration as unhealthy
          await db.shopeeIntegration.update({
            where: { shopId },
            data: {
              status: "UNHEALTHY",
              failureCount: { increment: 1 },
            },
          });
          throw refreshError;
        }
      }

      throw error;
    }
  },
  {
    connection,
    concurrency: 2, // Process 2 imports concurrently
    limiter: {
      max: 10,
      duration: 60000, // Max 10 requests per minute to avoid rate limiting
    },
  }
);

// Worker event handlers
shopeeImportWorker.on("completed", (job) => {
  console.log(`[Shopee Import] Job ${job.id} completed`);
});

shopeeImportWorker.on("failed", (job, err) => {
  console.error(`[Shopee Import] Job ${job?.id} failed:`, err);
});

shopeeImportWorker.on("error", (err) => {
  console.error(`[Shopee Import] Worker error:`, err);
});

console.log("[Shopee Import] Worker started and listening for jobs");
