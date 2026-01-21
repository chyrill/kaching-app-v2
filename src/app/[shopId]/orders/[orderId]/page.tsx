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
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showTrackingModal, setShowTrackingModal] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [carrier, setCarrier] = useState("");

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
    refetch: refetchOrder,
  } = api.shopee.getOrderDetails.useQuery(
    {
      shopId: shopId!,
      orderId: orderId!,
    },
    {
      enabled: mounted && !!shopId && !!orderId && canViewOrders,
    }
  );

  // Update order status mutation
  const updateStatusMutation = api.shopee.updateOrderStatus.useMutation({
    onSuccess: () => {
      setNotification({ type: 'success', message: 'Order status updated successfully!' });
      setShowStatusModal(false);
      void refetchOrder();
      setTimeout(() => setNotification(null), 5000);
    },
    onError: (error) => {
      setNotification({ type: 'error', message: error.message });
      setShowStatusModal(false);
      setTimeout(() => setNotification(null), 5000);
    },
  });

  // Update fulfillment tracking mutation
  const updateFulfillmentMutation = api.shopee.updateOrderFulfillment.useMutation({
    onSuccess: () => {
      setNotification({ type: 'success', message: 'Tracking information added successfully!' });
      setShowTrackingModal(false);
      setTrackingNumber("");
      setCarrier("");
      void refetchOrder();
      setTimeout(() => setNotification(null), 5000);
    },
    onError: (error) => {
      setNotification({ type: 'error', message: error.message });
      setTimeout(() => setNotification(null), 5000);
    },
  });

  // Mark order as delivered mutation
  const markDeliveredMutation = api.shopee.markOrderDelivered.useMutation({
    onSuccess: () => {
      setNotification({ type: 'success', message: 'Order marked as delivered!' });
      void refetchOrder();
      setTimeout(() => setNotification(null), 5000);
    },
    onError: (error) => {
      setNotification({ type: 'error', message: error.message });
      setTimeout(() => setNotification(null), 5000);
    },
  });

  const handleStatusUpdate = () => {
    if (!shopId || !orderId || !selectedStatus) return;
    updateStatusMutation.mutate({
      shopId,
      orderId,
      newStatus: selectedStatus as "pending" | "processing" | "shipped" | "completed" | "cancelled",
    });
  };

  const handleAddTracking = () => {
    if (!shopId || !orderId || !trackingNumber.trim() || !carrier.trim()) return;
    updateFulfillmentMutation.mutate({
      shopId,
      orderId,
      trackingNumber: trackingNumber.trim(),
      carrier: carrier.trim(),
    });
  };

  const handleMarkDelivered = () => {
    if (!shopId || !orderId) return;
    if (confirm('Mark this order as delivered and completed?')) {
      markDeliveredMutation.mutate({ shopId, orderId });
    }
  };

  // Get available status transitions
  const getAvailableStatuses = (currentStatus: string) => {
    const transitions: Record<string, Array<{ value: string; label: string; color: string }>> = {
      pending: [
        { value: "processing", label: "Processing", color: "bg-blue-500" },
        { value: "cancelled", label: "Cancelled", color: "bg-red-500" },
      ],
      processing: [
        { value: "shipped", label: "Shipped", color: "bg-purple-500" },
        { value: "cancelled", label: "Cancelled", color: "bg-red-500" },
      ],
      shipped: [
        { value: "completed", label: "Completed", color: "bg-emerald-500" },
        { value: "cancelled", label: "Cancelled", color: "bg-red-500" },
      ],
      completed: [],
      cancelled: [],
    };
    return transitions[currentStatus.toLowerCase()] ?? [];
  };

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

                  {order.shippedAt && (
                    <div className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100">
                          <svg className="h-4 w-4 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                            <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z" />
                          </svg>
                        </div>
                        {order.deliveredAt && <div className="h-full w-0.5 bg-gray-200"></div>}
                      </div>
                      <div className={order.deliveredAt ? "pb-4" : ""}>
                        <p className="font-semibold text-gray-900">Shipped</p>
                        <p className="text-sm text-gray-600">
                          {new Date(order.shippedAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  )}

                  {order.deliveredAt && (
                    <div className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100">
                          <svg className="h-4 w-4 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        </div>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">Delivered</p>
                        <p className="text-sm text-gray-600">
                          {new Date(order.deliveredAt).toLocaleString()}
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

              {/* Fulfillment Information */}
              <div className="rounded-lg border-2 border-gray-200 bg-white p-6">
                <h2 className="mb-4 text-xl font-bold text-gray-900">Fulfillment Information</h2>
                {order.trackingNumber ? (
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Carrier</p>
                      <p className="mt-1 text-base text-gray-900">{order.carrier}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">Tracking Number</p>
                      <p className="mt-1 text-base font-mono text-gray-900">{order.trackingNumber}</p>
                    </div>
                    {order.shippedAt && (
                      <div>
                        <p className="text-sm font-medium text-gray-600">Shipped Date</p>
                        <p className="mt-1 text-base text-gray-900">
                          {new Date(order.shippedAt).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                    {order.deliveredAt && (
                      <div>
                        <p className="text-sm font-medium text-gray-600">Delivered Date</p>
                        <p className="mt-1 text-base text-gray-900">
                          {new Date(order.deliveredAt).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                    {!order.deliveredAt && order.status === "shipped" && (
                      <button
                        onClick={handleMarkDelivered}
                        disabled={markDeliveredMutation.isPending}
                        className="mt-4 w-full rounded-lg border-2 border-emerald-500 bg-emerald-500 px-4 py-2 font-semibold text-white hover:bg-emerald-600 disabled:opacity-50 transition"
                      >
                        {markDeliveredMutation.isPending ? 'Marking...' : 'Mark as Delivered'}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="mb-4 text-sm text-gray-500 italic">No tracking information yet</p>
                    {(order.status === "shipped" || order.status === "completed") && (
                      <button
                        onClick={() => setShowTrackingModal(true)}
                        className="w-full rounded-lg border-2 border-blue-500 bg-blue-500 px-4 py-2 font-semibold text-white hover:bg-blue-600 transition"
                      >
                        Add Tracking
                      </button>
                    )}
                  </div>
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
                {getAvailableStatuses(order.status).length > 0 ? (
                  <button
                    onClick={() => setShowStatusModal(true)}
                    className="w-full rounded-lg border-2 border-emerald-500 bg-emerald-500 px-4 py-3 font-semibold text-white hover:bg-emerald-600 transition"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Update Status
                    </div>
                  </button>
                ) : (
                  <div className="w-full rounded-lg border-2 border-gray-200 bg-gray-50 px-4 py-3 text-center">
                    <p className="text-sm text-gray-600">
                      {order.status === "completed" ? "Order is completed" : "Order is cancelled"}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Notification Toast */}
          {notification && (
            <div className="fixed bottom-6 right-6 z-50 animate-slide-up">
              <div
                className={`rounded-lg border-2 px-6 py-4 shadow-lg ${
                  notification.type === 'success'
                    ? 'border-emerald-200 bg-emerald-50'
                    : 'border-red-200 bg-red-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  {notification.type === 'success' ? (
                    <svg className="h-5 w-5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  )}
                  <p
                    className={`font-medium ${
                      notification.type === 'success' ? 'text-emerald-900' : 'text-red-900'
                    }`}
                  >
                    {notification.message}
                  </p>
                  <button
                    onClick={() => setNotification(null)}
                    className={`ml-2 ${
                      notification.type === 'success' ? 'text-emerald-600 hover:text-emerald-800' : 'text-red-600 hover:text-red-800'
                    }`}
                  >
                    ×
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Status Update Modal */}
          {showStatusModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
              <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
                <h3 className="text-xl font-bold text-gray-900">Update Order Status</h3>
                <p className="mt-2 text-sm text-gray-600">
                  Current status: <span className="font-semibold">{order.status}</span>
                </p>
                
                <div className="mt-4 space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Select new status:
                  </label>
                  {getAvailableStatuses(order.status).map((status) => (
                    <button
                      key={status.value}
                      onClick={() => setSelectedStatus(status.value)}
                      className={`w-full rounded-lg border-2 px-4 py-3 text-left font-semibold transition ${
                        selectedStatus === status.value
                          ? `${status.color} border-transparent text-white`
                          : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {status.label}
                    </button>
                  ))}
                </div>

                <div className="mt-6 flex gap-3">
                  <button
                    onClick={() => {
                      setShowStatusModal(false);
                      setSelectedStatus("");
                    }}
                    disabled={updateStatusMutation.isPending}
                    className="flex-1 rounded-lg border-2 border-gray-200 bg-white px-4 py-2 font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleStatusUpdate}
                    disabled={!selectedStatus || updateStatusMutation.isPending}
                    className="flex-1 rounded-lg bg-emerald-500 px-4 py-2 font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
                  >
                    {updateStatusMutation.isPending ? 'Updating...' : 'Update Status'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Add Tracking Modal */}
          {showTrackingModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
              <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
                <h3 className="text-xl font-bold text-gray-900">Add Tracking Information</h3>
                <p className="mt-2 text-sm text-gray-600">
                  Order: <span className="font-semibold">{order.orderNumber}</span>
                </p>
                
                <div className="mt-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Carrier *
                    </label>
                    <input
                      type="text"
                      value={carrier}
                      onChange={(e) => setCarrier(e.target.value)}
                      placeholder="e.g., J&T Express, LBC, Ninja Van"
                      className="w-full rounded-lg border-2 border-gray-200 px-4 py-2 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tracking Number *
                    </label>
                    <input
                      type="text"
                      value={trackingNumber}
                      onChange={(e) => setTrackingNumber(e.target.value)}
                      placeholder="Enter tracking number"
                      className="w-full rounded-lg border-2 border-gray-200 px-4 py-2 font-mono focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="mt-6 flex gap-3">
                  <button
                    onClick={() => {
                      setShowTrackingModal(false);
                      setTrackingNumber("");
                      setCarrier("");
                    }}
                    disabled={updateFulfillmentMutation.isPending}
                    className="flex-1 rounded-lg border-2 border-gray-200 bg-white px-4 py-2 font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddTracking}
                    disabled={!trackingNumber.trim() || !carrier.trim() || updateFulfillmentMutation.isPending}
                    className="flex-1 rounded-lg bg-blue-500 px-4 py-2 font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
                  >
                    {updateFulfillmentMutation.isPending ? 'Adding...' : 'Add Tracking'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
