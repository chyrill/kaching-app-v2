/**
 * Shopee Webhook Verification and Utilities
 * 
 * Handles HMAC signature verification for incoming Shopee webhooks.
 * Shopee uses HMAC-SHA256 with partner key to sign webhook payloads.
 */

import crypto from "crypto";
import { env } from "~/env";

/**
 * Verify Shopee webhook signature
 * 
 * Shopee webhook signature format:
 * HMAC-SHA256(partner_key, authorization + request_url + timestamp + request_body)
 * 
 * @param authorization - Authorization header value
 * @param requestUrl - Full request URL
 * @param timestamp - Timestamp from query param
 * @param body - Raw request body as string
 * @param signature - Signature from header
 * @returns true if signature is valid
 */
export function verifyShopeeWebhookSignature(
  authorization: string,
  requestUrl: string,
  timestamp: string,
  body: string,
  signature: string
): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const partnerKey = env.SHOPEE_PARTNER_KEY;
    
    if (!partnerKey || typeof partnerKey !== "string") {
      console.error("SHOPEE_PARTNER_KEY not configured");
      return false;
    }
    
    // Construct base string
    const baseString = authorization + requestUrl + timestamp + body;
    
    // Calculate HMAC-SHA256
    const expectedSignature = crypto
      .createHmac("sha256", partnerKey)
      .update(baseString)
      .digest("hex");
    
    // Compare signatures (timing-safe comparison)
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(signature)
    );
  } catch (error) {
    console.error("Error verifying Shopee webhook signature:", error);
    return false;
  }
}

/**
 * Extract shop ID from webhook payload
 * Different event types have different payload structures
 */
export function extractShopIdFromPayload(
  eventType: string,
  payload: unknown
): string | null {
  try {
    if (!payload || typeof payload !== "object") {
      return null;
    }
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
    const data = payload as any;
    
    // Most Shopee webhooks include shop_id in the root or data object
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (data.shop_id) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      return String(data.shop_id);
    }
    
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (data.data?.shop_id) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      return String(data.data.shop_id);
    }
    
    // Order events might have it nested differently
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (eventType.includes("order") && data.order_id) {
      // We'll need to look it up by order_id
      return null; // Handled by worker
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * Validate webhook timestamp (must be within 5 minutes)
 */
export function isTimestampValid(timestamp: string): boolean {
  try {
    const webhookTime = parseInt(timestamp);
    const now = Math.floor(Date.now() / 1000);
    const diff = Math.abs(now - webhookTime);
    
    // Allow 5 minutes clock skew
    return diff < 300;
  } catch {
    return false;
  }
}
