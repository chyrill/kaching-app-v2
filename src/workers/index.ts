/**
 * Worker Entry Point
 * 
 * Starts all BullMQ workers for background job processing.
 * Run with: tsx src/workers/index.ts
 * 
 * Workers included:
 * - Shopee product import worker
 * - Shopee order webhook processor
 * - Shopee inventory webhook processor
 */

import "./shopee-import";
import "./shopee-webhook-order";
import "./shopee-webhook-inventory";

console.log("🚀 All workers started");

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n⏸️  Shutting down workers gracefully...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n⏸️  Shutting down workers gracefully...");
  process.exit(0);
});
