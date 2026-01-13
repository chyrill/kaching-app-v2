import { NextResponse } from "next/server";
import { auth } from "~/server/auth";
import crypto from "crypto";

/**
 * Shopee OAuth Authorization Endpoint
 * Redirects user to Shopee Partner API OAuth consent page
 * 
 * Story 4.1: Shopee OAuth Connection Flow
 */
export async function GET(req: Request) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get shopId from query params
    const { searchParams } = new URL(req.url);
    const shopId = searchParams.get("shopId");

    if (!shopId) {
      return NextResponse.json(
        { error: "Shop ID is required" },
        { status: 400 }
      );
    }

    // Verify user has access to this shop (must be owner)
    // TODO: Add actual authorization check via tRPC/Prisma

    // Generate state parameter for CSRF protection
    const state = crypto.randomBytes(32).toString("hex");
    
    // Store state in session/cookie for verification in callback
    // For now, we'll include shopId in state (in production, use encrypted JWT)
    const stateData = JSON.stringify({ shopId, nonce: state });
    const encodedState = Buffer.from(stateData).toString("base64url");

    // Shopee OAuth parameters
    const partnerId = process.env.SHOPEE_PARTNER_ID;
    const redirectUri = process.env.SHOPEE_REDIRECT_URI;
    
    if (!partnerId || !redirectUri) {
      throw new Error("Shopee credentials not configured");
    }

    // Build Shopee authorization URL
    // https://open.shopee.com/documents/v2/v2.auth.get_auth_url?module=63&type=1
    const authUrl = new URL(`${process.env.SHOPEE_API_BASE_URL}/api/v2/shop/auth_partner`);
    authUrl.searchParams.set("partner_id", partnerId);
    authUrl.searchParams.set("redirect", redirectUri);
    authUrl.searchParams.set("state", encodedState);

    // Redirect to Shopee OAuth consent page
    return NextResponse.redirect(authUrl.toString());
    
  } catch (error) {
    console.error("Shopee OAuth authorization error:", error);
    return NextResponse.json(
      { error: "Failed to initiate Shopee authorization" },
      { status: 500 }
    );
  }
}
