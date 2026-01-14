/**
 * Shopee Order Webhook Endpoint
 * 
 * Captures order-related webhooks from Shopee:
 * - Order creation
 * - Order status updates
 * - Order cancellation
 * - Payment confirmation
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { Prisma } from "../../../../../../generated/prisma";
import { db } from "~/server/db";
import { queueWebhookProcessing } from "~/lib/queue";
import {
  verifyShopeeWebhookSignature,
  extractShopIdFromPayload,
  isTimestampValid,
} from "~/lib/shopee-webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    // Get signature and timestamp from headers/query
    const authorization = req.headers.get("authorization") ?? "";
    const signature = req.headers.get("x-shopee-signature") ?? "";
    const timestamp = req.nextUrl.searchParams.get("timestamp") ?? "";
    
    // Read raw body
    const rawBody = await req.text();
    
    // Verify timestamp is recent (prevent replay attacks)
    if (!isTimestampValid(timestamp)) {
      console.error("Invalid webhook timestamp:", timestamp);
      return NextResponse.json(
        { error: "Invalid timestamp" },
        { status: 401 }
      );
    }
    
    // Verify signature
    const requestUrl = req.url;
    const isValid = verifyShopeeWebhookSignature(
      authorization,
      requestUrl,
      timestamp,
      rawBody,
      signature
    );
    
    if (!isValid) {
      console.error("Invalid webhook signature");
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }
    
    // Parse payload
    let payload: unknown;
    try {
      payload = JSON.parse(rawBody) as unknown;
    } catch (error) {
      console.error("Failed to parse webhook payload:", error);
      return NextResponse.json(
        { error: "Invalid JSON" },
        { status: 400 }
      );
    }
    
    // Extract event type and shop ID
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
    const eventType: string = ((payload as any).event_type as string) ?? "order.unknown";
    const shopeeShopId = extractShopIdFromPayload(eventType, payload);
    
    if (!shopeeShopId) {
      console.error("Unable to extract shop_id from payload:", payload);
      return NextResponse.json(
        { error: "Missing shop_id" },
        { status: 400 }
      );
    }
    
    // Find our internal shop by Shopee shop ID
    const integration = await db.shopeeIntegration.findFirst({
      where: {
        shopeeShopId: shopeeShopId,
        deletedAt: null,
      },
      select: {
        shopId: true,
      },
    });
    
    if (!integration) {
      console.error("Shop not found for Shopee shop ID:", shopeeShopId);
      return NextResponse.json(
        { error: "Shop not found" },
        { status: 404 }
      );
    }
    
    // Store raw webhook payload
    const webhookRecord = await db.webhookPayload.create({
      data: {
        shopId: integration.shopId,
        platform: "SHOPEE",
        eventType,
        rawPayload: payload as Prisma.InputJsonValue,
        signature,
        status: "PENDING",
        retryCount: 0,
      },
    });
    
    // Queue for processing
    await queueWebhookProcessing({
      webhookId: webhookRecord.id,
      shopId: integration.shopId,
      platform: "SHOPEE",
      eventType,
    });
    
    console.log(`✅ Webhook captured: ${eventType} for shop ${integration.shopId}`);
    
    // Return 200 OK to Shopee (must respond quickly)
    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error("Error processing Shopee order webhook:", error);
    
    // Still return 200 to prevent Shopee from retrying immediately
    // We'll handle errors in the processing queue
    return NextResponse.json({ success: true });
  }
}
