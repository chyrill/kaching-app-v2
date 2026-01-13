-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('SHOPEE', 'LAZADA', 'TIKTOK');

-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('HEALTHY', 'UNHEALTHY', 'DISCONNECTED');

-- CreateEnum
CREATE TYPE "WebhookStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "ShopeeIntegration" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "shopeeShopId" TEXT NOT NULL,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'HEALTHY',
    "lastSyncAt" TIMESTAMP(3),
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ShopeeIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "shopeeProductId" TEXT,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "price" DECIMAL(10,2) NOT NULL,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "shopeeOrderId" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT,
    "customerPhone" TEXT,
    "shippingAddress" TEXT,
    "orderDate" TIMESTAMP(3) NOT NULL,
    "items" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookPayload" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "eventType" TEXT NOT NULL,
    "rawPayload" JSONB NOT NULL,
    "signature" TEXT,
    "status" "WebhookStatus" NOT NULL DEFAULT 'PENDING',
    "processedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookPayload_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShopeeIntegration_shopId_key" ON "ShopeeIntegration"("shopId");

-- CreateIndex
CREATE INDEX "ShopeeIntegration_shopId_idx" ON "ShopeeIntegration"("shopId");

-- CreateIndex
CREATE INDEX "ShopeeIntegration_status_idx" ON "ShopeeIntegration"("status");

-- CreateIndex
CREATE INDEX "Product_shopId_idx" ON "Product"("shopId");

-- CreateIndex
CREATE INDEX "Product_platform_idx" ON "Product"("platform");

-- CreateIndex
CREATE INDEX "Product_shopeeProductId_idx" ON "Product"("shopeeProductId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_shopId_shopeeProductId_key" ON "Product"("shopId", "shopeeProductId");

-- CreateIndex
CREATE INDEX "Order_shopId_idx" ON "Order"("shopId");

-- CreateIndex
CREATE INDEX "Order_platform_idx" ON "Order"("platform");

-- CreateIndex
CREATE INDEX "Order_shopeeOrderId_idx" ON "Order"("shopeeOrderId");

-- CreateIndex
CREATE INDEX "Order_orderDate_idx" ON "Order"("orderDate");

-- CreateIndex
CREATE UNIQUE INDEX "Order_shopId_shopeeOrderId_key" ON "Order"("shopId", "shopeeOrderId");

-- CreateIndex
CREATE INDEX "WebhookPayload_shopId_idx" ON "WebhookPayload"("shopId");

-- CreateIndex
CREATE INDEX "WebhookPayload_platform_idx" ON "WebhookPayload"("platform");

-- CreateIndex
CREATE INDEX "WebhookPayload_status_idx" ON "WebhookPayload"("status");

-- CreateIndex
CREATE INDEX "WebhookPayload_eventType_idx" ON "WebhookPayload"("eventType");

-- CreateIndex
CREATE INDEX "WebhookPayload_createdAt_idx" ON "WebhookPayload"("createdAt");

-- AddForeignKey
ALTER TABLE "ShopeeIntegration" ADD CONSTRAINT "ShopeeIntegration_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookPayload" ADD CONSTRAINT "WebhookPayload_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
