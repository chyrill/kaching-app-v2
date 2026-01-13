import crypto from "crypto";
import { db } from "~/server/db";

interface ShopeeProduct {
  item_id: number;
  item_name: string;
  item_sku: string;
  stock: number;
  price: number;
  images?: string[];
}

interface ShopeeProductListResponse {
  error?: string;
  message?: string;
  response?: {
    item_list: ShopeeProduct[];
    has_next_page: boolean;
    next_offset: number;
    total_count: number;
  };
}

/**
 * Shopee API Client
 * Handles all Shopee Partner API requests with authentication
 */
export class ShopeeAPIClient {
  private partnerId: string;
  private partnerKey: string;
  private baseUrl: string;

  constructor() {
    const partnerId = process.env.SHOPEE_PARTNER_ID;
    const partnerKey = process.env.SHOPEE_PARTNER_KEY;
    const baseUrl = process.env.SHOPEE_API_BASE_URL;

    if (!partnerId || !partnerKey || !baseUrl) {
      throw new Error("Shopee API credentials not configured");
    }

    this.partnerId = partnerId;
    this.partnerKey = partnerKey;
    this.baseUrl = baseUrl;
  }

  /**
   * Generate signature for Shopee API request
   */
  private generateSignature(path: string, timestamp: number, accessToken: string): string {
    const baseString = `${this.partnerId}${path}${timestamp}${accessToken}`;
    return crypto
      .createHmac("sha256", this.partnerKey)
      .update(baseString)
      .digest("hex");
  }

  /**
   * Make authenticated request to Shopee API
   */
  private async makeRequest<T>(
    path: string,
    shopId: string,
    accessToken: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = this.generateSignature(path, timestamp, accessToken);

    const url = new URL(`${this.baseUrl}${path}`);
    url.searchParams.set("partner_id", this.partnerId);
    url.searchParams.set("timestamp", timestamp.toString());
    url.searchParams.set("access_token", accessToken);
    url.searchParams.set("shop_id", shopId);
    url.searchParams.set("sign", signature);

    const response = await fetch(url.toString(), {
      method: body ? "POST" : "GET",
      headers: {
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`Shopee API error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Get product list from Shopee (paginated)
   * https://open.shopee.com/documents/v2/v2.product.get_item_list?module=89&type=1
   */
  async getProductList(
    localShopId: string,
    offset = 0,
    limit = 50
  ): Promise<{
    products: ShopeeProduct[];
    hasNextPage: boolean;
    nextOffset: number;
    totalCount: number;
  }> {
    // Get integration to retrieve access token and shopeeShopId
    const integration = await db.shopeeIntegration.findUnique({
      where: { shopId: localShopId },
    });

    if (!integration || integration.deletedAt) {
      throw new Error("Shopee integration not found or disconnected");
    }

    // Decrypt access token (simple base64 decode for MVP)
    const accessToken = Buffer.from(integration.accessToken, "base64").toString("utf-8");

    const path = "/api/v2/product/get_item_list";
    const response = await this.makeRequest<ShopeeProductListResponse>(
      path,
      integration.shopeeShopId,
      accessToken,
      {
        offset,
        page_size: limit,
        item_status: ["NORMAL"], // Only get active products
      }
    );

    if (response.error || !response.response) {
      throw new Error(response.message ?? "Failed to fetch products");
    }

    return {
      products: response.response.item_list,
      hasNextPage: response.response.has_next_page,
      nextOffset: response.response.next_offset,
      totalCount: response.response.total_count,
    };
  }

  /**
   * Get detailed product information
   * https://open.shopee.com/documents/v2/v2.product.get_item_base_info?module=89&type=1
   */
  async getProductDetails(
    localShopId: string,
    itemIds: number[]
  ): Promise<ShopeeProduct[]> {
    const integration = await db.shopeeIntegration.findUnique({
      where: { shopId: localShopId },
    });

    if (!integration || integration.deletedAt) {
      throw new Error("Shopee integration not found or disconnected");
    }

    const accessToken = Buffer.from(integration.accessToken, "base64").toString("utf-8");

    const path = "/api/v2/product/get_item_base_info";
    const response = await this.makeRequest<{
      response?: { item_list: ShopeeProduct[] };
      error?: string;
      message?: string;
    }>(path, integration.shopeeShopId, accessToken, {
      item_id_list: itemIds,
    });

    if (response.error || !response.response) {
      throw new Error(response.message ?? "Failed to fetch product details");
    }

    return response.response.item_list;
  }

  /**
   * Refresh access token when expired
   */
  async refreshAccessToken(localShopId: string): Promise<void> {
    const integration = await db.shopeeIntegration.findUnique({
      where: { shopId: localShopId },
    });

    if (!integration || integration.deletedAt) {
      throw new Error("Shopee integration not found or disconnected");
    }

    const refreshToken = Buffer.from(integration.refreshToken, "base64").toString("utf-8");

    const timestamp = Math.floor(Date.now() / 1000);
    const path = "/api/v2/auth/access_token/get";
    const baseString = `${this.partnerId}${path}${timestamp}`;
    const signature = crypto
      .createHmac("sha256", this.partnerKey)
      .update(baseString)
      .digest("hex");

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        partner_id: parseInt(this.partnerId),
        shop_id: parseInt(integration.shopeeShopId),
        refresh_token: refreshToken,
      }),
    });

    const data = await response.json() as {
      access_token?: string;
      refresh_token?: string;
      expire_in?: number;
      error?: string;
      message?: string;
    };

    if (data.error || !data.access_token) {
      throw new Error(data.message ?? "Failed to refresh token");
    }

    // Update tokens in database
    await db.shopeeIntegration.update({
      where: { shopId: localShopId },
      data: {
        accessToken: Buffer.from(data.access_token).toString("base64"),
        refreshToken: Buffer.from(data.refresh_token!).toString("base64"),
        expiresAt: new Date(Date.now() + (data.expire_in! * 1000)),
      },
    });
  }
}
