import { Queue } from "bullmq";
import { Redis } from "ioredis";

// Redis connection for BullMQ
const connection = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

// Job types
export interface ImportProductsJobData {
  shopId: string;
  offset?: number;
}

export interface WebhookProcessJobData {
  webhookId: string;
  shopId: string;
  platform: "SHOPEE" | "LAZADA" | "TIKTOK";
  eventType: string;
}

// Queue for Shopee catalog import
export const shopeeImportQueue = new Queue("shopee:catalog:import", {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
  connection: connection as any, // Type mismatch between ioredis versions
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: {
      count: 100, // Keep last 100 completed jobs
    },
    removeOnFail: {
      count: 50, // Keep last 50 failed jobs
    },
  },
});

/**
 * Add product import job to queue
 */
export async function queueProductImport(shopId: string): Promise<void> {
  await shopeeImportQueue.add(
    "import-products",
    { shopId, offset: 0 } as ImportProductsJobData,
    {
      jobId: `import-${shopId}`, // Prevent duplicate jobs
      removeOnComplete: true,
      removeOnFail: false,
    }
  );
}

/**
 * Get job status and progress
 */
export async function getImportJobStatus(shopId: string) {
  const jobId = `import-${shopId}`;
  const job = await shopeeImportQueue.getJob(jobId);

  if (!job) {
    return { status: "not-found", progress: 0 };
  }

  const state = await job.getState();
  const progress = job.progress as number | { imported: number; total: number };

  return {
    status: state,
    progress: typeof progress === "number" ? progress : progress,
    failedReason: job.failedReason,
  };
}

// Queue for webhook processing
export const webhookQueue = new Queue<WebhookProcessJobData>("shopee:webhook:process", {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
  connection: connection as any, // Type mismatch between ioredis versions
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: "exponential",
      delay: 3000,
    },
    removeOnComplete: {
      count: 100,
    },
    removeOnFail: {
      count: 200, // Keep more failed webhooks for debugging
    },
  },
});

/**
 * Queue webhook processing job
 */
export async function queueWebhookProcessing(data: WebhookProcessJobData): Promise<void> {
  await webhookQueue.add(
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
    "process-webhook" as any, // BullMQ type issue with job names
    data,
    {
      jobId: `webhook-${data.webhookId}`, // Prevent duplicate processing
      removeOnComplete: false, // Keep for audit
      removeOnFail: false,
    }
  );
}
