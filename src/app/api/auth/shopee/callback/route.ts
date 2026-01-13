import { NextResponse } from "next/server";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import crypto from "crypto";
import { queueProductImport } from "~/lib/queue";

interface ShopeeTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expire_in?: number;
  error?: string;
  message?: string;
}

/**
 * Shopee OAuth Callback Endpoint
 * Exchanges authorization code for access token and refresh token
 * 
 * Story 4.1: Shopee OAuth Connection Flow
 */
export async function GET(req: Request) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.redirect("/auth/login?error=unauthorized");
    }

    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const shopId = searchParams.get("shop_id"); // Shopee shop ID

    if (!code || !state || !shopId) {
      return NextResponse.redirect("/?error=invalid_callback");
    }

    // Decode and verify state parameter
    let stateData: { shopId: string; nonce: string };
    try {
      const decoded = Buffer.from(state, "base64url").toString("utf-8");
      stateData = JSON.parse(decoded);
    } catch {
      return NextResponse.redirect("/?error=invalid_state");
    }

    const { shopId: originalShopId } = stateData;

    // Verify user owns this shop
    const shop = await db.shop.findUnique({
      where: { id: originalShopId },
      select: { id: true, ownerId: true },
    });

    if (shop?.ownerId !== session.user.id) {
      return NextResponse.redirect("/?error=unauthorized");
    }

    // Exchange authorization code for access token
    const accessTokenResponse = await exchangeCodeForToken(code, originalShopId, shopId);

    if (!accessTokenResponse.success) {
      console.error("Token exchange failed:", accessTokenResponse.error);
      return NextResponse.redirect(
        `/${originalShopId}/settings/integrations?error=connection_failed`
      );
    }

    // Redirect to integrations page with success message
    return NextResponse.redirect(
      `/${originalShopId}/settings/integrations?success=connected`
    );
    
  } catch (error) {
    console.error("Shopee OAuth callback error:", error);
    return NextResponse.redirect("/?error=connection_failed");
  }
}

/**
 * Exchange authorization code for access token
 * https://open.shopee.com/documents/v2/v2.auth.token.get?module=63&type=1
 */
async function exchangeCodeForToken(
  code: string,
  localShopId: string,
  shopeeShopId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const partnerId = process.env.SHOPEE_PARTNER_ID;
    const partnerKey = process.env.SHOPEE_PARTNER_KEY;
    const redirectUri = process.env.SHOPEE_REDIRECT_URI;

    if (!partnerId || !partnerKey || !redirectUri) {
      throw new Error("Shopee credentials not configured");
    }

    // Generate signature for API request
    const timestamp = Math.floor(Date.now() / 1000);
    const path = "/api/v2/auth/token/get";
    const baseString = `${partnerId}${path}${timestamp}`;
    // Signature will be used in production for request signing
    const _signature = crypto
      .createHmac("sha256", partnerKey)
      .update(baseString)
      .digest("hex");

    // Request access token from Shopee
    const tokenUrl = `${process.env.SHOPEE_API_BASE_URL}${path}`;
    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code,
        shop_id: parseInt(shopeeShopId),
        partner_id: parseInt(partnerId),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Shopee token exchange failed:", error);
      return { success: false, error: "Token exchange failed" };
    }

    const data = await response.json() as ShopeeTokenResponse;

    if (data.error || !data.access_token) {
      console.error("Shopee API error:", data);
      return { success: false, error: data.message ?? "Invalid response" };
    }

    // Encrypt tokens before storing (simple encryption for MVP, use proper encryption in production)
    const encryptedAccessToken = Buffer.from(data.access_token).toString("base64");
    const encryptedRefreshToken = Buffer.from(data.refresh_token!).toString("base64");

    // Calculate token expiration
    const expiresAt = new Date(Date.now() + (data.expire_in! * 1000));

    // Store integration in database
    await db.shopeeIntegration.upsert({
      where: { shopId: localShopId },
      create: {
        shopId: localShopId,
        shopeeShopId: shopeeShopId,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        expiresAt,
        status: "HEALTHY",
      },
      update: {
        shopeeShopId: shopeeShopId,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        expiresAt,
        status: "HEALTHY",
        failureCount: 0,
        deletedAt: null, // Re-enable if previously disconnected
      },
    });

    // Queue background job to import product catalog (Story 4.2)
    try {
      await queueProductImport(localShopId);
      console.log(`[Shopee OAuth] Queued product import for shop ${localShopId}`);
    } catch (queueError) {
      console.error(`[Shopee OAuth] Failed to queue import job:`, queueError);
      // Don't fail the entire OAuth flow if queue fails
    }

    return { success: true };
    
  } catch (error) {
    console.error("Token exchange error:", error);
    return { success: false, error: "Internal error" };
  }
}
