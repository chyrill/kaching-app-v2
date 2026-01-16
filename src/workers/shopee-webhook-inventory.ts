/**
 * Shopee Inventory Webhook Processor
 * 
 * Processes inventory-related webhooks from Shopee:
 * - product.stock_updated: Stock quantity changed
 * - product.price_updated: Price changed
 * - product.updated: Product details changed
 * - product.deleted: Product removed from shop
 */

import { Worker } from "bullmq";
import { Redis } from "ioredis";
import { db } from "~/server/db";
import type { WebhookProcessJobData } from "~/lib/queue";

// Redis connection for worker
const connection = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

// Type definitions for Shopee inventory webhook payloads
interface ShopeeInventoryWebhook {
  event_type: string;
  shop_id: number;
  item_id: string;
  model_sku?: string;
  stock?: number;
  price?: number;
  item_name?: string;
  images?: string[];
  update_time: number;
}

/**
 * Process inventory webhook
 */
async function processInventoryWebhook(data: WebhookProcessJobData): Promise<void> {
  console.log(`🔄 Processing inventory webhook: ${data.webhookId}`);
  
  // Fetch webhook record
  const webhook = await db.webhookPayload.findUnique({
    where: { id: data.webhookId },
  });
  
  if (!webhook) {
    throw new Error(`Webhook ${data.webhookId} not found`);
  }
  
  // Update status to PROCESSING
  await db.webhookPayload.update({
    where: { id: data.webhookId },
    data: { status: "PROCESSING" },
  });
  
  try {
    const payload = webhook.rawPayload as unknown as ShopeeInventoryWebhook;
    const eventType = payload.event_type;
    
    // Find existing product
    const existingProduct = await db.product.findFirst({
      where: {
        shopId: data.shopId,
        shopeeProductId: String(payload.item_id),
      },
    });
    
    if (!existingProduct && eventType !== "product.deleted") {
      // Product doesn't exist yet, create it
      const newProduct = await db.product.create({
        data: {
          shopId: data.shopId,
          platform: data.platform,
          shopeeProductId: String(payload.item_id),
          name: payload.item_name ?? "Unknown Product",
          sku: payload.model_sku ?? null,
          stock: payload.stock ?? 0,
          price: payload.price ? payload.price / 100000 : 0, // Shopee uses 5 decimal places
          imageUrl: payload.images?.[0] ?? null,
        },
      });
      
      console.log(`✅ Created product: ${newProduct.name}`);
      
      // TODO: Emit Socket.IO event (Epic 3 integration)
      // io?.to(`shop:${data.shopId}`).emit("shop:inventory:updated", {
      //   productId: newProduct.id,
      //   shopId: data.shopId,
      //   stock: newProduct.stock,
      // });
      
    } else if (existingProduct && eventType === "product.deleted") {
      // Delete product
      await db.product.delete({
        where: { id: existingProduct.id },
      });
      
      console.log(`✅ Deleted product: ${existingProduct.name}`);
      
      // TODO: Emit Socket.IO event (Epic 3 integration)
      // io?.to(`shop:${data.shopId}`).emit("shop:inventory:updated", {
      //   productId: existingProduct.id,
      //   shopId: data.shopId,
      //   stock: 0,
      // });
      
    } else if (existingProduct) {
      // Update existing product
      const updateData: {
        stock?: number;
        price?: number;
        name?: string;
        sku?: string;
        imageUrl?: string;
      } = {};
      
      if (eventType === "product.stock_updated" && payload.stock !== undefined) {
        updateData.stock = payload.stock;
      }
      
      if (eventType === "product.price_updated" && payload.price !== undefined) {
        updateData.price = payload.price / 100000;
      }
      
      if (eventType === "product.updated") {
        if (payload.stock !== undefined) updateData.stock = payload.stock;
        if (payload.price !== undefined) updateData.price = payload.price / 100000;
        if (payload.item_name) updateData.name = payload.item_name;
        if (payload.model_sku) updateData.sku = payload.model_sku;
        if (payload.images?.[0]) updateData.imageUrl = payload.images[0];
      }
      
      const updatedProduct = await db.product.update({
        where: { id: existingProduct.id },
        data: updateData,
      });
      
      console.log(`✅ Updated product: ${updatedProduct.name}`);
      
      // TODO: Emit Socket.IO event for stock changes (Epic 3 integration)
      // if (updateData.stock !== undefined) {
      //   io?.to(`shop:${data.shopId}`).emit("shop:inventory:updated", {
      //     productId: updatedProduct.id,
      //     shopId: data.shopId,
      //     stock: updatedProduct.stock,
      //   });
      // }
    }
    
    // Mark webhook as COMPLETED
    await db.webhookPayload.update({
      where: { id: data.webhookId },
      data: {
        status: "COMPLETED",
        processedAt: new Date(),
      },
    });
    
  } catch (error) {
    console.error(`❌ Failed to process inventory webhook ${data.webhookId}:`, error);
    
    // Update retry count
    const updatedWebhook = await db.webhookPayload.update({
      where: { id: data.webhookId },
      data: {
        status: "FAILED",
        errorMessage: error instanceof Error ? error.message : String(error),
        retryCount: { increment: 1 },
      },
    });
    
    // If retry count exceeds limit, mark as permanently failed
    if (updatedWebhook.retryCount >= 5) {
      console.error(`❌ Webhook ${data.webhookId} permanently failed after 5 retries`);
    }
    
    throw error; // Re-throw to trigger BullMQ retry
  }
}

// Create worker
export const inventoryWebhookWorker = new Worker<WebhookProcessJobData>(
  "shopee-webhook-process",
  async (job) => {
    const { data } = job;
    
    // Only process inventory/product events
    if (!data.eventType.startsWith("product") && !data.eventType.startsWith("inventory")) {
      console.log(`⏭️  Skipping non-inventory event: ${data.eventType}`);
      return;
    }
    
    await processInventoryWebhook(data);
  },
  {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
    connection: connection as any, // Type mismatch with ioredis
    concurrency: 10, // Process 10 inventory webhooks concurrently
    limiter: {
      max: 50, // Max 50 jobs
      duration: 1000, // Per second
    },
  }
);

// Event handlers
inventoryWebhookWorker.on("completed", (job) => {
  console.log(`✅ Inventory webhook job ${job.id} completed`);
});

inventoryWebhookWorker.on("failed", (job, error) => {
  console.error(`❌ Inventory webhook job ${job?.id} failed:`, error);
});

inventoryWebhookWorker.on("error", (error) => {
  console.error("❌ Inventory webhook worker error:", error);
});

console.log("🚀 Inventory webhook worker started");
