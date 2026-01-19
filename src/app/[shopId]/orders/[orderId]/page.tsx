"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import DashboardNav from "~/components/DashboardNav";
import { api } from "~/trpc/react";

type OrderDetailsPageProps = {
  params: { shopId: string | string[]; orderId: string | string[] };
};

interface OrderItem {
  item_id: string;
  item_name: string;
  item_sku?: string;
  quantity: number;
  item_price: number;
  subtotal: number;
}

export default function OrderDetailsPage({ params }: OrderDetailsPageProps) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const rawShopId = params.shopId;
  const rawOrderId = params.orderId;
  const shopId = typeof rawShopId === 'string' ? rawShopId : Array.isArray(rawShopId) ? rawShopId[0] : undefined;
  const orderId = typeof rawOrderId === 'string' ? rawOrderId : Array.isArray(rawOrderId) ? rawOrderId[0] : undefined;

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch user's shops
  const { data: userShops, isLoading: isLoadingShops } = api.shop.getUserShops.useQuery(
    undefined,
    { enabled: mounted }
  );
  const currentShop = userShops?.find((s) => s.shopId === shopId);
  const canViewOrders = currentShop?.role === "OWNER" || currentShop?.role === "ACCOUNTANT";

  // Fetch order details
  const {
    data: order,
    isLoading: isLoadingOrder,
    error: orderError,
  } = api.shopee.getOrderDetails.useQuery(
    {
      shopId: shopId!,
      orderId: orderId!,
    },
    {
      enabled: mounted && !!shopId && !!orderId && canViewOrders,
    }
  );

  // Parse order items from JSON
  let orderItems: OrderItem[] = [];
  if (order?.items && Array.isArray(order.items)) {
    orderItems = order.items as unknown as OrderItem[];
  }

  // Status badge color mapping
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed":
        return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case "pending":
        return "bg-yellow-100 text-yellow-700 border-yellow-200";
      case "processing":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "shipped":
        return "bg-purple-100 text-purple-700 border-purple-200";
      case "cancelled":
        return "bg-red-100 text-red-700 border-red-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  // Platform badge color mapping
  const getPlatformColor = (platform: string) => {
    switch (platform) {
      case "SHOPEE":
        return "bg-orange-100 text-orange-700 border-orange-200";
      case "LAZADA":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "TIKTOK":
        return "bg-pink-100 text-pink-700 border-pink-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  if (status === "loading" || isLoadingShops || !shopId || !orderId || !mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!currentShop) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white p-6">
        <div className="max-w-md rounded-lg border-2 border-gray-200 bg-gray-50 p-8 text-center">
          <h1 className="mb-4 text-2xl font-bold text-gray-900">Access Denied</h1>
          <p className="mb-6 text-gray-600">You do not have access to this shop.</p>
          <button
            onClick={() => router.push("/dashboard")}
            className="rounded-lg bg-emerald-500 px-6 py-2 font-semibold text-white hover:bg-emerald-600"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!canViewOrders) {
    return (
      <div className="flex min-h-screen bg-white">
        <DashboardNav
          shopId={shopId}
          currentShop={currentShop}
          userEmail={session?.user.email}
        />
        <main className="flex-1">
          <div className="border-b-2 border-gray-200 bg-gray-50 p-4 lg:hidden">
            <button
              onClick={() => {
                const nav = document.querySelector('[data-mobile-nav]');
                if (nav) {
                  const event = new CustomEvent('toggleNav');
                  nav.dispatchEvent(event);
                }
              }}
              className="rounded-lg p-2 text-gray-700 hover:bg-gray-100"
              aria-label="Toggle menu"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
          <div className="p-6">
            <h1 className="mb-6 text-3xl font-bold text-gray-900">Order Details</h1>
            <div className="rounded-lg border-2 border-gray-200 bg-gray-50 p-6 text-center">
              <p className="text-gray-600">You must be a shop owner or accountant to view orders.</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (isLoadingOrder) {
    return (
      <div className="flex min-h-screen bg-white">
        <DashboardNav
          shopId={shopId}
          currentShop={currentShop}
          userEmail={session?.user.email}
        />
        <main className="flex-1">
          <div className="border-b-2 border-gray-200 bg-gray-50 p-4 lg:hidden">
            <button
              onClick={() => {
                const nav = document.querySelector('[data-mobile-nav]');
                if (nav) {
                  const event = new CustomEvent('toggleNav');
                  nav.dispatchEvent(event);
                }
              }}
              className="rounded-lg p-2 text-gray-700 hover:bg-gray-100"
              aria-label="Toggle menu"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
          <div className="p-6">
            <div className="text-center text-gray-600">Loading order details...</div>
          </div>
        </main>
      </div>
    );
  }

  if (orderError || !order) {
    return (
      <div className="flex min-h-screen bg-white">
        <DashboardNav
          shopId={shopId}
          currentShop={currentShop}
          userEmail={session?.user.email}
        />
        <main className="flex-1">
          <div className="border-b-2 border-gray-200 bg-gray-50 p-4 lg:hidden">
            <button
              onClick={() => {
                const nav = document.querySelector('[data-mobile-nav]');
                if (nav) {
                  const event = new CustomEvent('toggleNav');
                  nav.dispatchEvent(event);
                }
              }}
              className="rounded-lg p-2 text-gray-700 hover:bg-gray-100"
              aria-label="Toggle menu"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
          <div className="p-6">
            <div className="rounded-lg border-2 border-red-200 bg-red-50 p-6 text-center">
              <p className="text-red-700">
                {orderError?.message ?? "Order not found"}
              </p>
              <button
                onClick={() => router.push(`/${shopId}/orders`)}
                className="mt-4 rounded-lg bg-red-500 px-6 py-2 font-semibold text-white hover:bg-red-600"
              >
                Back to Orders
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-white">
      <DashboardNav
        shopId={shopId}
        currentShop={currentShop}
        userEmail={session?.user.email}
      />

      <main className="flex-1">
        {/* Mobile Menu Toggle */}
        <div className="border-b-2 border-gray-200 bg-gray-50 p-4 lg:hidden">
          <button
            onClick={() => {
              const nav = document.querySelector('[data-mobile-nav]');
              if (nav) {
                const event = new CustomEvent('toggleNav');
                nav.dispatchEvent(event);
              }
            }}
            className="rounded-lg p-2 text-gray-700 hover:bg-gray-100"
            aria-label="Toggle menu"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>

        <div className="p-6">
          {/* Header with Back Button */}
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push(`/${shopId}/orders`)}
                className="rounded-lg border-2 border-gray-200 bg-white p-2 text-gray-700 hover:bg-gray-50"
                aria-label="Back to orders"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Order Details</h1>
                <p className="mt-1 text-sm text-gray-600">Order #{order.orderNumber}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <span className={`inline-flex items-center gap-2 rounded-full border-2 px-4 py-2 text-sm font-semibold ${getPlatformColor(order.platform)}`}>
                {order.platform}
              </span>
              <span className={`inline-flex items-center gap-2 rounded-full border-2 px-4 py-2 text-sm font-semibold ${getStatusColor(order.status)}`}>
                {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
              </span>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Left Column - Order Info & Items */}
            <div className="space-y-6 lg:col-span-2">
              {/* Order Information */}
              <div className="rounded-lg border-2 border-gray-200 bg-white p-6">
                <h2 className="mb-4 text-xl font-bold text-gray-900">Order Information</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Order Number</p>
                    <p className="mt-1 text-base font-semibold text-gray-900">{order.orderNumber}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Order Date</p>
                    <p className="mt-1 text-base text-gray-900">
                      {new Date(order.orderDate).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Platform Order ID</p>
                    <p className="mt-1 text-base font-mono text-gray-900">{order.shopeeOrderId}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Amount</p>
                    <p className="mt-1 text-xl font-bold text-emerald-600">
                      ₱{Number(order.totalAmount).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Order Items */}
              <div className="rounded-lg border-2 border-gray-200 bg-white p-6">
                <h2 className="mb-4 text-xl font-bold text-gray-900">Order Items</h2>
                <div className="space-y-3">
                  {orderItems.length > 0 ? (
                    orderItems.map((item, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between rounded-lg border-2 border-gray-100 bg-gray-50 p-4"
                      >
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900">{item.item_name}</p>
                          {item.item_sku && (
                            <p className="mt-1 text-sm text-gray-600">SKU: {item.item_sku}</p>
                          )}
                          <p className="mt-1 text-sm text-gray-600">
                            ₱{Number(item.item_price).toFixed(2)} × {item.quantity}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-gray-900">
                            ₱{Number(item.subtotal || item.item_price * item.quantity).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-lg border-2 border-gray-100 bg-gray-50 p-4 text-center text-gray-600">
                      No items data available
                    </div>
                  )}
                </div>

                {/* Order Total */}
                <div className="mt-4 border-t-2 border-gray-200 pt-4">
                  <div className="flex items-center justify-between">
                    <p className="text-lg font-bold text-gray-900">Total</p>
                    <p className="text-2xl font-bold text-emerald-600">
                      ₱{Number(order.totalAmount).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Timeline */}
              <div className="rounded-lg border-2 border-gray-200 bg-white p-6">
                <h2 className="mb-4 text-xl font-bold text-gray-900">Order Timeline</h2>
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100">
                        <svg className="h-4 w-4 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="h-full w-0.5 bg-gray-200"></div>
                    </div>
                    <div className="pb-4">
                      <p className="font-semibold text-gray-900">Order Created</p>
                      <p className="text-sm text-gray-600">
                        {new Date(order.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {order.updatedAt && order.updatedAt.toString() !== order.createdAt.toString() && (
                    <div className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100">
                          <svg className="h-4 w-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="h-full w-0.5 bg-gray-200"></div>
                      </div>
                      <div className="pb-4">
                        <p className="font-semibold text-gray-900">Last Updated</p>
                        <p className="text-sm text-gray-600">
                          {new Date(order.updatedAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-4">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100">
                      <svg className="h-4 w-4 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">Current Status</p>
                      <p className="text-sm text-gray-600">
                        {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Customer & Shipping */}
            <div className="space-y-6">
              {/* Customer Information */}
              <div className="rounded-lg border-2 border-gray-200 bg-white p-6">
                <h2 className="mb-4 text-xl font-bold text-gray-900">Customer Information</h2>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Name</p>
                    <p className="mt-1 text-base text-gray-900">{order.customerName}</p>
                  </div>
                  {order.customerEmail && (
                    <div>
                      <p className="text-sm font-medium text-gray-600">Email</p>
                      <p className="mt-1 text-base text-gray-900">{order.customerEmail}</p>
                    </div>
                  )}
                  {order.customerPhone && (
                    <div>
                      <p className="text-sm font-medium text-gray-600">Phone</p>
                      <p className="mt-1 text-base text-gray-900">{order.customerPhone}</p>
                    </div>
                  )}
                  {!order.customerEmail && !order.customerPhone && (
                    <p className="text-sm text-gray-500 italic">No contact information available</p>
                  )}
                </div>
              </div>

              {/* Shipping Address */}
              <div className="rounded-lg border-2 border-gray-200 bg-white p-6">
                <h2 className="mb-4 text-xl font-bold text-gray-900">Shipping Address</h2>
                {order.shippingAddress ? (
                  <p className="whitespace-pre-line text-base text-gray-900">
                    {order.shippingAddress}
                  </p>
                ) : (
                  <p className="text-sm text-gray-500 italic">No shipping address available</p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="space-y-2">
                <button
                  onClick={() => window.print()}
                  className="w-full rounded-lg border-2 border-gray-200 bg-white px-4 py-3 font-semibold text-gray-700 hover:bg-gray-50 transition"
                >
                  <div className="flex items-center justify-center gap-2">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                    Print Invoice
                  </div>
                </button>
                <button
                  disabled
                  className="w-full rounded-lg border-2 border-gray-200 bg-gray-100 px-4 py-3 font-semibold text-gray-400 cursor-not-allowed transition"
                  title="Coming in Story 5.3"
                >
                  <div className="flex items-center justify-center gap-2">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Update Status
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
