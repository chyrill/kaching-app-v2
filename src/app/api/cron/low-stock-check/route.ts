import { NextRequest, NextResponse } from 'next/server';
import { checkLowStockAndNotify } from '~/lib/notifications/low-stock-check';

/**
 * Cron endpoint for checking low stock and sending notifications
 * 
 * This can be triggered by:
 * - Vercel Cron Jobs
 * - External cron services (e.g., cron-job.org)
 * - Manual testing
 * 
 * Recommended schedule:
 * - Daily checks: Run at 9:00 AM daily
 * - Weekly checks: Run at 9:00 AM every Monday
 * 
 * Security: Add authorization header in production
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authorization (optional but recommended)
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.CRON_SECRET;
    
    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get frequency from query params (default to daily)
    const searchParams = request.nextUrl.searchParams;
    const frequency = searchParams.get('frequency') as 'instant' | 'daily' | 'weekly' | null;
    const shopId = searchParams.get('shopId') || undefined;

    console.log(`Starting low stock check - frequency: ${frequency || 'all'}, shopId: ${shopId || 'all'}`);

    // Run the check
    const results = await checkLowStockAndNotify({
      frequency: frequency || undefined,
      shopId,
    });

    // Calculate summary
    const summary = {
      totalShops: results.length,
      shopsChecked: results.filter(r => r.productsChecked > 0).length,
      totalLowStockProducts: results.reduce((sum, r) => sum + r.lowStockProducts, 0),
      notificationsSent: results.reduce((sum, r) => sum + r.notificationsSent, 0),
      errors: results.filter(r => r.errors.length > 0).length,
      timestamp: new Date().toISOString(),
    };

    console.log('Low stock check completed:', summary);

    return NextResponse.json({
      success: true,
      summary,
      details: results,
    });
  } catch (error) {
    console.error('Error in low stock cron job:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST endpoint for manual triggering (optional)
 */
export async function POST(request: NextRequest) {
  return GET(request);
}
