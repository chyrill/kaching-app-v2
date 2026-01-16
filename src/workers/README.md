# Shopee Integration Workers

## Overview

Background workers for processing Shopee webhooks and data synchronization using BullMQ.

## Workers

### 1. Product Import Worker (`shopee-import.ts`)
- Fetches product catalog from Shopee API after OAuth connection
- Handles pagination (50 products per batch)
- Updates progress in real-time
- Auto-refreshes expired access tokens

### 2. Order Webhook Worker (`shopee-webhook-order.ts`)
- Processes order-related webhooks:
  - `order.created` - New order placed
  - `order.status_updated` - Order status changed
  - `order.cancelled` - Order cancelled
  - `order.payment_completed` - Payment confirmed
- Creates/updates Order records in database
- Emits Socket.IO events for real-time UI updates (Epic 3)

### 3. Inventory Webhook Worker (`shopee-webhook-inventory.ts`)
- Processes inventory-related webhooks:
  - `product.stock_updated` - Stock quantity changed
  - `product.price_updated` - Price changed
  - `product.updated` - Product details changed
  - `product.deleted` - Product removed
- Syncs Product records with Shopee data
- Emits Socket.IO events for real-time UI updates (Epic 3)

## Running Workers

### Development (with auto-reload)
```bash
pnpm workers:dev
```

### Production
```bash
pnpm workers
```

### Separate Terminal
You need to run workers in a separate terminal from your Next.js dev server:

**Terminal 1:** Next.js app
```bash
pnpm dev
```

**Terminal 2:** Background workers
```bash
pnpm workers:dev
```

## Prerequisites

### Required Services
1. **Redis** - Queue storage and job management
   ```bash
   # macOS (Homebrew)
   brew install redis
   brew services start redis
   
   # Docker
   docker run -d -p 6379:6379 redis:alpine
   ```

2. **PostgreSQL** - Database
   ```bash
   # Already configured in .env
   DATABASE_URL="postgresql://..."
   ```

### Environment Variables
```env
# Redis connection
REDIS_URL="redis://localhost:6379"

# Shopee Partner API credentials
SHOPEE_PARTNER_ID="your-partner-id"
SHOPEE_PARTNER_KEY="your-partner-key"

# Database
DATABASE_URL="postgresql://..."
```

## Worker Configuration

### Concurrency
- **Order Worker:** 5 concurrent jobs
- **Inventory Worker:** 10 concurrent jobs
- **Product Import:** 2 concurrent jobs

### Rate Limiting
- **Order Worker:** Max 20 jobs/second
- **Inventory Worker:** Max 50 jobs/second
- **Product Import:** Max 10 requests/minute (Shopee API limit)

### Retry Strategy
- **Attempts:** 5 retries with exponential backoff
- **Initial Delay:** 2-3 seconds
- **Backoff Factor:** 2x (2s, 4s, 8s, 16s, 32s)
- **Failed Jobs:** Kept for 200 jobs (debugging)
- **Completed Jobs:** Kept for 100 jobs (audit trail)

## Monitoring

### View Queue Status
```bash
# Install BullMQ CLI
npm install -g bullmq-cli

# Monitor queues
bullmq-cli queue monitor shopee:catalog:import
bullmq-cli queue monitor shopee:webhook:process
```

### Logs
Workers log to stdout with emojis for easy filtering:
- 🚀 Worker started
- 🔄 Job processing
- ✅ Job completed
- ❌ Job failed
- ⏭️ Job skipped

## Webhook Flow

### 1. Webhook Received
```
POST /api/webhooks/shopee/order
POST /api/webhooks/shopee/inventory
```
- Verify HMAC signature
- Validate timestamp (5-minute window)
- Store raw payload in `WebhookPayload` table
- Queue job with unique ID (prevents duplicates)
- Return 200 OK immediately (<500ms)

### 2. Worker Processing
```
Worker picks job from queue
→ Update status to PROCESSING
→ Parse webhook payload
→ Update database (Order/Product)
→ Emit Socket.IO event
→ Update status to COMPLETED
```

### 3. Error Handling
```
If error occurs:
→ Update status to FAILED
→ Increment retry count
→ Store error message
→ Re-throw error (triggers BullMQ retry)
→ After 5 failures: permanently failed
```

## Database Schema

### WebhookPayload (Audit Trail)
```typescript
{
  id: string
  shopId: string
  platform: "SHOPEE" | "LAZADA" | "TIKTOK"
  eventType: string // "order.created", "product.stock_updated"
  rawPayload: JSON // Full webhook payload
  signature: string
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED"
  processedAt: DateTime?
  errorMessage: string?
  retryCount: number
}
```

### Order (Synced Data)
```typescript
{
  id: string
  shopId: string
  platform: "SHOPEE"
  shopeeOrderId: string
  orderNumber: string
  totalAmount: Decimal
  customerName: string
  customerEmail: string?
  customerPhone: string?
  shippingAddress: string?
  orderDate: DateTime
  items: JSON[] // Order line items
  status: string // "completed", "cancelled", "pending"
}
```

### Product (Synced Data)
```typescript
{
  id: string
  shopId: string
  platform: "SHOPEE"
  shopeeProductId: string
  name: string
  sku: string?
  stock: number
  price: Decimal
  imageUrl: string?
}
```

## Troubleshooting

### Workers not processing jobs
1. Check Redis is running: `redis-cli ping` (should return PONG)
2. Check worker logs for errors
3. Verify `REDIS_URL` in `.env`
4. Restart workers: `Ctrl+C` then `pnpm workers:dev`

### Jobs stuck in PENDING
1. Check if workers are running
2. Check Redis connection
3. Look for failed jobs: `bullmq-cli queue failed shopee:webhook:process`

### Webhook signature verification failed
1. Verify `SHOPEE_PARTNER_KEY` in `.env`
2. Check webhook payload structure
3. Ensure timestamp is recent (<5 minutes)

### Database connection errors
1. Check `DATABASE_URL` in `.env`
2. Run migrations: `pnpm db:migrate`
3. Check PostgreSQL is running

## Production Deployment

### Process Manager (PM2)
```bash
# Install PM2
npm install -g pm2

# Start workers
pm2 start "pnpm workers" --name kaching-workers

# Monitor
pm2 logs kaching-workers
pm2 monit

# Auto-restart on system reboot
pm2 startup
pm2 save
```

### Docker
```dockerfile
# Dockerfile.workers
FROM node:20-alpine
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile
COPY . .
RUN pnpm db:generate
CMD ["pnpm", "workers"]
```

### Systemd Service
```ini
# /etc/systemd/system/kaching-workers.service
[Unit]
Description=Kaching Background Workers
After=network.target redis.service postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/kaching-app
ExecStart=/usr/bin/pnpm workers
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable kaching-workers
sudo systemctl start kaching-workers
sudo systemctl status kaching-workers
```

## Next Steps (Epic 3)

- [ ] Integrate Socket.IO with Next.js API route
- [ ] Add real-time UI updates for order notifications
- [ ] Add real-time UI updates for inventory changes
- [ ] Implement multi-user collaboration features
- [ ] Add admin dashboard for queue monitoring

## Related Files

- `/src/lib/queue.ts` - Queue configuration
- `/src/lib/shopee-api.ts` - Shopee API client
- `/src/lib/shopee-webhook.ts` - Webhook verification
- `/src/app/api/webhooks/shopee/order/route.ts` - Order webhook endpoint
- `/src/app/api/webhooks/shopee/inventory/route.ts` - Inventory webhook endpoint
