import { Queue, Worker, Job } from "bullmq";
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

// Queue for Shopee catalog import
export const shopeeImportQueue = new Queue("shopee:catalog:import", {
  connection,
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
