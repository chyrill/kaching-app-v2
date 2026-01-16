/**
 * Shopee Order Webhook Processor
 * 
 * Processes order-related webhooks from Shopee:
 * - order.created: New order placed
 * - order.status_updated: Order status changed
 * - order.cancelled: Order cancelled by buyer/seller
 * - order.payment_completed: Payment confirmed
 */

import { Worker } from "bullmq";
import { Redis } from "ioredis";
import { db } from "~/server/db";
import type { WebhookProcessJobData } from "~/lib/queue";

// Redis connection for worker
const connection = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

// Type definitions for Shopee order webhook payloads
interface ShopeeOrderWebhook {
  event_type: string;
  shop_id: number;
  order_id: string;
  order_sn: string;
  order_status: string;
  create_time: number;
  update_time: number;
  buyer_username?: string;
  buyer_email?: string;
  buyer_phone?: string;
  shipping_address?: string;
  total_amount: number;
  items: Array<{
    item_id: string;
    item_name: string;
    model_sku?: string;
    quantity: number;
    item_price: number;
  }>;
}

/**
 * Process order webhook
 */
async function processOrderWebhook(data: WebhookProcessJobData): Promise<void> {
  console.log(`🔄 Processing order webhook: ${data.webhookId}`);
  
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
    const payload = webhook.rawPayload as unknown as ShopeeOrderWebhook;
    const eventType = payload.event_type;
    
    // Parse order data
    const orderData = {
      shopId: data.shopId,
      platform: data.platform,
      shopeeOrderId: payload.order_id,
      orderNumber: payload.order_sn,
      totalAmount: payload.total_amount / 100000, // Shopee uses 5 decimal places
      customerName: payload.buyer_username ?? "Unknown",
      customerEmail: payload.buyer_email ?? null,
      customerPhone: payload.buyer_phone ?? null,
      shippingAddress: payload.shipping_address ?? null,
      orderDate: new Date(payload.create_time * 1000),
      items: payload.items,
      status: payload.order_status,
    };
    
    // Upsert order (create or update)
    const order = await db.order.upsert({
      where: {
        shopId_shopeeOrderId: {
          shopId: data.shopId,
          shopeeOrderId: payload.order_id,
        },
      },
      create: orderData,
      update: {
        status: payload.order_status,
        totalAmount: orderData.totalAmount,
        items: orderData.items,
        updatedAt: new Date(),
      },
    });
    
    console.log(`✅ Order ${eventType}: ${order.orderNumber}`);
    
    // TODO: Emit Socket.IO event for real-time updates (Epic 3 integration)
    // if (eventType === "order.created") {
    //   io?.to(`shop:${data.shopId}`).emit("shop:order:created", {
    //     orderId: order.id,
    //     shopId: data.shopId,
    //     orderNumber: order.orderNumber,
    //   });
    // }
    
    // Mark webhook as COMPLETED
    await db.webhookPayload.update({
      where: { id: data.webhookId },
      data: {
        status: "COMPLETED",
        processedAt: new Date(),
      },
    });
    
  } catch (error) {
    console.error(`❌ Failed to process order webhook ${data.webhookId}:`, error);
    
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
export const orderWebhookWorker = new Worker<WebhookProcessJobData>(
  "shopee-webhook-process",
  async (job) => {
    const { data } = job;
    
    // Only process order events
    if (!data.eventType.startsWith("order")) {
      console.log(`⏭️  Skipping non-order event: ${data.eventType}`);
      return;
    }
    
    await processOrderWebhook(data);
  },
  {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
    connection: connection as any, // Type mismatch with ioredis
    concurrency: 5, // Process 5 order webhooks concurrently
    limiter: {
      max: 20, // Max 20 jobs
      duration: 1000, // Per second
    },
  }
);

// Event handlers
orderWebhookWorker.on("completed", (job) => {
  console.log(`✅ Order webhook job ${job.id} completed`);
});

orderWebhookWorker.on("failed", (job, error) => {
  console.error(`❌ Order webhook job ${job?.id} failed:`, error);
});

orderWebhookWorker.on("error", (error) => {
  console.error("❌ Order webhook worker error:", error);
});

console.log("🚀 Order webhook worker started");
