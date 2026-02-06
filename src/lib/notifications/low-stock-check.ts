import { db } from '~/server/db';
import { sendLowStockNotification } from '~/lib/email';

interface LowStockCheckResult {
  shopId: string;
  shopName: string;
  productsChecked: number;
  lowStockProducts: number;
  notificationsSent: number;
  errors: string[];
}

/**
 * Check inventory levels and send low stock notifications
 * Can be called by cron jobs, API routes, or manually
 */
export async function checkLowStockAndNotify(options?: {
  shopId?: string; // Check specific shop only
  frequency?: 'instant' | 'daily' | 'weekly'; // Filter by frequency
}): Promise<LowStockCheckResult[]> {
  const results: LowStockCheckResult[] = [];

  // Get all active shops (or specific shop if provided)
  const shops = await db.shop.findMany({
    where: options?.shopId ? { id: options.shopId } : {},
    include: {
      products: {
        where: {
          isActive: true,
        },
        include: {
          shopeeProduct: true,
        },
      },
      members: {
        where: {
          role: 'OWNER', // Only notify owners
        },
        include: {
          user: true,
        },
      },
    },
  });

  for (const shop of shops) {
    const result: LowStockCheckResult = {
      shopId: shop.id,
      shopName: shop.name,
      productsChecked: shop.products.length,
      lowStockProducts: 0,
      notificationsSent: 0,
      errors: [],
    };

    try {
      // Get owner's notification preferences
      const owner = shop.members[0];
      if (!owner || !owner.user) {
        result.errors.push('No owner found for shop');
        results.push(result);
        continue;
      }

      // Get notification preferences
      const prefs = await db.notificationPreferences.findFirst({
        where: {
          userId: owner.userId,
          shopId: shop.id,
        },
      });

      // Check if low stock notifications are enabled
      if (prefs && !prefs.emailLowStock) {
        console.log(`Low stock notifications disabled for shop ${shop.name}`);
        results.push(result);
        continue;
      }

      // Check if we should send based on frequency
      if (options?.frequency && prefs?.lowStockFrequency !== options.frequency) {
        console.log(`Skipping shop ${shop.name} - frequency mismatch (${prefs?.lowStockFrequency} !== ${options.frequency})`);
        results.push(result);
        continue;
      }

      // Determine threshold (use preference override or default)
      const threshold = prefs?.lowStockThreshold ?? shop.lowStockThreshold ?? 10;

      // Find low stock products
      const lowStockProducts = shop.products.filter(product => {
        const stock = product.shopeeProduct?.stock ?? 0;
        return stock > 0 && stock <= threshold; // Only alert if stock is low but not zero
      });

      result.lowStockProducts = lowStockProducts.length;

      // If no low stock products, skip
      if (lowStockProducts.length === 0) {
        results.push(result);
        continue;
      }

      // Check if we've recently sent a notification (avoid duplicates)
      const shouldSend = await shouldSendLowStockNotification(
        owner.userId,
        shop.id,
        prefs?.lowStockFrequency ?? 'daily'
      );

      if (!shouldSend) {
        console.log(`Skipping shop ${shop.name} - notification sent recently`);
        results.push(result);
        continue;
      }

      // Prepare email data
      const emailData = {
        shopName: shop.name,
        products: lowStockProducts.map(p => ({
          name: p.name,
          sku: p.shopeeProduct?.itemSku ?? p.sku ?? 'N/A',
          currentStock: p.shopeeProduct?.stock ?? 0,
          threshold,
          platform: 'Shopee',
        })),
        inventoryUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/${shop.id}/inventory`,
        userEmail: owner.user.email!,
        userId: owner.userId,
        shopId: shop.id,
      };

      // Send notification
      const emailResult = await sendLowStockNotification(emailData);

      if (emailResult.success) {
        result.notificationsSent = 1;
        
        // Update last notification time in preferences
        await db.notificationPreferences.upsert({
          where: {
            userId_shopId: {
              userId: owner.userId,
              shopId: shop.id,
            },
          },
          create: {
            userId: owner.userId,
            shopId: shop.id,
          },
          update: {
            updatedAt: new Date(),
          },
        });
      } else {
        result.errors.push(emailResult.error ?? 'Unknown error');
      }
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
      console.error(`Error processing shop ${shop.name}:`, error);
    }

    results.push(result);
  }

  return results;
}

/**
 * Determine if we should send a low stock notification based on frequency
 */
async function shouldSendLowStockNotification(
  userId: string,
  shopId: string,
  frequency: 'instant' | 'daily' | 'weekly'
): Promise<boolean> {
  // Get the last low stock email sent
  const lastEmail = await db.emailLog.findFirst({
    where: {
      userId,
      shopId,
      emailType: 'low_stock',
      status: 'sent',
    },
    orderBy: {
      sentAt: 'desc',
    },
  });

  if (!lastEmail) {
    return true; // Never sent before
  }

  const now = new Date();
  const lastSent = new Date(lastEmail.sentAt);
  const hoursSinceLastSent = (now.getTime() - lastSent.getTime()) / (1000 * 60 * 60);

  switch (frequency) {
    case 'instant':
      // Always send for instant notifications
      return true;
    case 'daily':
      // Send if more than 23 hours have passed
      return hoursSinceLastSent >= 23;
    case 'weekly':
      // Send if more than 7 days have passed
      return hoursSinceLastSent >= 7 * 24;
    default:
      return false;
  }
}

/**
 * Get summary of low stock products without sending emails
 */
export async function getLowStockSummary(shopId?: string) {
  const shops = await db.shop.findMany({
    where: shopId ? { id: shopId } : {},
    include: {
      products: {
        where: {
          isActive: true,
        },
        include: {
          shopeeProduct: true,
        },
      },
    },
  });

  return shops.map(shop => {
    const threshold = shop.lowStockThreshold ?? 10;
    const lowStockProducts = shop.products.filter(product => {
      const stock = product.shopeeProduct?.stock ?? 0;
      return stock > 0 && stock <= threshold;
    });

    return {
      shopId: shop.id,
      shopName: shop.name,
      threshold,
      totalProducts: shop.products.length,
      lowStockCount: lowStockProducts.length,
      products: lowStockProducts.map(p => ({
        id: p.id,
        name: p.name,
        sku: p.shopeeProduct?.itemSku ?? p.sku ?? 'N/A',
        currentStock: p.shopeeProduct?.stock ?? 0,
      })),
    };
  });
}
