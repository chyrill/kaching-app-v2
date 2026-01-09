/**
 * BullMQ Queue Infrastructure
 * 
 * Background job processing with Redis-backed queue.
 * Used for webhook processing, receipt generation, inventory sync, etc.
 */

import { Queue, QueueEvents, type Job } from "bullmq";
import { env } from "~/env";

// Parse Redis URL to extract connection details
function getRedisConnection() {
  if (!env.REDIS_URL) {
    console.warn("⚠️  BullMQ unavailable (no Redis connection)");
    return null;
  }

  // Parse redis://localhost:6379 or redis://:password@host:port
  const url = new URL(env.REDIS_URL);
  
  return {
    host: url.hostname,
    port: parseInt(url.port) || 6379,
    password: url.password || undefined,
  };
}

// Redis connection for BullMQ
const redisConnection = getRedisConnection();

// Job payload types (will be expanded in Epic 4, 5, 6)
export interface WebhookJobData {
  webhookId: string;
  platform: "shopee";
  eventType: string;
}

export interface ReceiptJobData {
  orderId: string;
  shopId: string;
}

export interface InventorySyncJobData {
  shopId: string;
  productIds: string[];
}

// Queue instances (will be used across the application)
export const webhookQueue = redisConnection
  ? new Queue<WebhookJobData>("webhook", {
      connection: redisConnection,
      defaultJobOptions: {
        attempts: 5,
        backoff: {
          type: "exponential",
          delay: 1000, // Start with 1 second, then 2s, 4s, 8s, 16s
        },
        removeOnComplete: {
          age: 3600, // Keep completed jobs for 1 hour
          count: 1000, // Keep max 1000 completed jobs
        },
        removeOnFail: {
          age: 86400, // Keep failed jobs for 24 hours
        },
      },
    })
  : null;

export const receiptQueue = redisConnection
  ? new Queue<ReceiptJobData>("receipt", {
      connection: redisConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 2000,
        },
      },
    })
  : null;

export const inventorySyncQueue = redisConnection
  ? new Queue<InventorySyncJobData>("inventory-sync", {
      connection: redisConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 1000,
        },
      },
    })
  : null;

// Helper function to add a job to the webhook queue
export async function addWebhookJob(data: WebhookJobData): Promise<Job<WebhookJobData> | null> {
  if (!webhookQueue) {
    console.warn("⚠️  Cannot add webhook job (BullMQ unavailable)");
    return null;
  }

  return await webhookQueue.add("process", data);
}

// Helper function to get job status
export async function getJobStatus(queueName: string, jobId: string): Promise<string | null> {
  if (!redisConnection) {
    return null;
  }

  const queue = new Queue(queueName, { connection: redisConnection });
  const job = await queue.getJob(jobId);
  
  if (!job) {
    return null;
  }

  return await job.getState();
}

// Worker placeholder (will be implemented in Epic 4 for webhook processing)
// Example:
// export const webhookWorker = redisConnection
//   ? new Worker<WebhookJobData>(
//       "webhook",
//       async (job) => {
//         console.log(`Processing webhook job ${job.id}:`, job.data);
//         // Actual webhook processing logic will be in Epic 4
//       },
//       { connection: redisConnection }
//     )
//   : null;

// Log queue initialization status
if (redisConnection) {
  console.log("✅ BullMQ initialized with local Redis");
  console.log("   - Webhook queue ready");
  console.log("   - Receipt queue ready");
  console.log("   - Inventory sync queue ready");
} else {
  console.warn("⚠️  BullMQ unavailable (no Redis connection)");
}

// Export queue events for monitoring (Epic 10 - Admin dashboard)
export const webhookQueueEvents = redisConnection
  ? new QueueEvents("webhook", { connection: redisConnection })
  : null;
