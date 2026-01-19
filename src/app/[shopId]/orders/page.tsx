"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import DashboardNav from "~/components/DashboardNav";
import { api } from "~/trpc/react";

type OrdersPageProps = {
  params: { shopId: string | string[] };
  searchParams: Record<string, string | string[] | undefined>;
};

export default function OrdersPage({ params }: OrdersPageProps) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const rawShopId = params.shopId;
  const shopId = typeof rawShopId === 'string' ? rawShopId : Array.isArray(rawShopId) ? rawShopId[0] : undefined;

  const [mounted, setMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [dateRangeFilter, setDateRangeFilter] = useState<string>("all");

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

  // Fetch orders with pagination
  const {
    data: ordersData,
    isLoading: isLoadingOrders,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = api.shopee.getOrders.useInfiniteQuery(
    {
      shopId: shopId!,
      limit: 20,
    },
    {
      enabled: mounted && !!shopId && canViewOrders,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    }
  );

  const allOrders = ordersData?.pages.flatMap((page) => page.orders) ?? [];

  // Filter orders based on search and filters
  const filteredOrders = allOrders.filter((order) => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesOrderNumber = order.orderNumber.toLowerCase().includes(query);
      const matchesCustomer = order.customerName.toLowerCase().includes(query);
      if (!matchesOrderNumber && !matchesCustomer) return false;
    }

    // Status filter
    if (statusFilter !== "all" && order.status !== statusFilter) return false;

    // Platform filter
    if (platformFilter !== "all" && order.platform !== platformFilter) return false;

    // Date range filter
    if (dateRangeFilter !== "all") {
      const orderDate = new Date(order.orderDate);
      const now = new Date();
      const diffDays = Math.floor((now.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24));

      switch (dateRangeFilter) {
        case "today":
          if (diffDays !== 0) return false;
          break;
        case "week":
          if (diffDays > 7) return false;
          break;
        case "month":
          if (diffDays > 30) return false;
          break;
        case "quarter":
          if (diffDays > 90) return false;
          break;
      }
    }

    return true;
  });

  // Calculate summary stats
  const totalOrders = filteredOrders.length;
  const totalRevenue = filteredOrders.reduce((sum, order) => sum + Number(order.totalAmount), 0);
  const pendingOrders = filteredOrders.filter((o) => o.status === "pending").length;
  const completedOrders = filteredOrders.filter((o) => o.status === "completed").length;

  // Status badge color mapping
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed":
        return "bg-emerald-100 text-emerald-700";
      case "pending":
        return "bg-yellow-100 text-yellow-700";
      case "processing":
        return "bg-blue-100 text-blue-700";
      case "shipped":
        return "bg-purple-100 text-purple-700";
      case "cancelled":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  // Platform badge color mapping
  const getPlatformColor = (platform: string) => {
    switch (platform) {
      case "SHOPEE":
        return "bg-orange-100 text-orange-700";
      case "LAZADA":
        return "bg-blue-100 text-blue-700";
      case "TIKTOK":
        return "bg-pink-100 text-pink-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  if (status === "loading" || isLoadingShops || !shopId || !mounted) {
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
            <h1 className="mb-6 text-3xl font-bold text-gray-900">Orders</h1>
            <div className="rounded-lg border-2 border-gray-200 bg-gray-50 p-6 text-center">
              <p className="text-gray-600">You must be a shop owner or accountant to view orders.</p>
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
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Orders</h1>
            <p className="mt-1 text-sm text-gray-600">
              Manage and track all your orders from connected platforms
            </p>
          </div>

          {/* Summary Cards */}
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border-2 border-gray-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Orders</p>
                  <p className="mt-1 text-2xl font-bold text-gray-900">{totalOrders}</p>
                </div>
                <div className="rounded-lg bg-blue-100 p-3">
                  <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="rounded-lg border-2 border-gray-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                  <p className="mt-1 text-2xl font-bold text-gray-900">₱{totalRevenue.toFixed(2)}</p>
                </div>
                <div className="rounded-lg bg-emerald-100 p-3">
                  <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="rounded-lg border-2 border-gray-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Pending</p>
                  <p className="mt-1 text-2xl font-bold text-gray-900">{pendingOrders}</p>
                </div>
                <div className="rounded-lg bg-yellow-100 p-3">
                  <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="rounded-lg border-2 border-gray-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Completed</p>
                  <p className="mt-1 text-2xl font-bold text-gray-900">{completedOrders}</p>
                </div>
                <div className="rounded-lg bg-emerald-100 p-3">
                  <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Filters & Search */}
          <div className="mb-6 rounded-lg border-2 border-gray-200 bg-white p-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Search */}
              <div className="lg:col-span-2">
                <label className="mb-2 block text-sm font-medium text-gray-700">Search</label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Order number or customer name..."
                  className="w-full rounded-lg border-2 border-gray-200 px-4 py-2 text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* Status Filter */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full rounded-lg border-2 border-gray-200 px-4 py-2 text-gray-900 focus:border-emerald-500 focus:outline-none"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="processing">Processing</option>
                  <option value="shipped">Shipped</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              {/* Platform Filter */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Platform</label>
                <select
                  value={platformFilter}
                  onChange={(e) => setPlatformFilter(e.target.value)}
                  className="w-full rounded-lg border-2 border-gray-200 px-4 py-2 text-gray-900 focus:border-emerald-500 focus:outline-none"
                >
                  <option value="all">All Platforms</option>
                  <option value="SHOPEE">Shopee</option>
                  <option value="LAZADA">Lazada</option>
                  <option value="TIKTOK">TikTok Shop</option>
                </select>
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-sm font-medium text-gray-700">Date Range</label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setDateRangeFilter("all")}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                    dateRangeFilter === "all"
                      ? "bg-emerald-500 text-white"
                      : "border-2 border-gray-200 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  All Time
                </button>
                <button
                  onClick={() => setDateRangeFilter("today")}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                    dateRangeFilter === "today"
                      ? "bg-emerald-500 text-white"
                      : "border-2 border-gray-200 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  Today
                </button>
                <button
                  onClick={() => setDateRangeFilter("week")}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                    dateRangeFilter === "week"
                      ? "bg-emerald-500 text-white"
                      : "border-2 border-gray-200 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  Last 7 Days
                </button>
                <button
                  onClick={() => setDateRangeFilter("month")}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                    dateRangeFilter === "month"
                      ? "bg-emerald-500 text-white"
                      : "border-2 border-gray-200 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  Last 30 Days
                </button>
                <button
                  onClick={() => setDateRangeFilter("quarter")}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                    dateRangeFilter === "quarter"
                      ? "bg-emerald-500 text-white"
                      : "border-2 border-gray-200 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  Last 90 Days
                </button>
              </div>
            </div>
          </div>

          {/* Orders Table */}
          {isLoadingOrders ? (
            <div className="rounded-lg border-2 border-gray-200 bg-white p-12 text-center">
              <div className="text-gray-600">Loading orders...</div>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="rounded-lg border-2 border-gray-200 bg-white p-12 text-center">
              <svg
                className="mx-auto mb-4 h-12 w-12 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                />
              </svg>
              <h3 className="mb-2 text-lg font-semibold text-gray-900">No orders found</h3>
              <p className="text-sm text-gray-600">
                {searchQuery || statusFilter !== "all" || platformFilter !== "all" || dateRangeFilter !== "all"
                  ? "Try adjusting your filters or search query"
                  : "Orders from connected platforms will appear here"}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-hidden rounded-lg border-2 border-gray-200 bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b-2 border-gray-200 bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-600">
                          Order Number
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-600">
                          Customer
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-600">
                          Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-600">
                          Platform
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-600">
                          Amount
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-600">
                          Status
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-gray-600">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {filteredOrders.map((order) => (
                        <tr key={order.id} className="hover:bg-gray-50 transition">
                          <td className="px-6 py-4 text-sm font-medium text-gray-900">
                            {order.orderNumber}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-700">{order.customerName}</td>
                          <td className="px-6 py-4 text-sm text-gray-700">
                            {new Date(order.orderDate).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getPlatformColor(order.platform)}`}>
                              {order.platform}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                            ₱{Number(order.totalAmount).toFixed(2)}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getStatusColor(order.status)}`}>
                              {order.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => router.push(`/${shopId}/orders/${order.id}`)}
                              className="text-sm font-semibold text-emerald-600 hover:text-emerald-700"
                            >
                              View Details →
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Load More Button */}
              {hasNextPage && (
                <div className="mt-6 text-center">
                  <button
                    onClick={() => void fetchNextPage()}
                    disabled={isFetchingNextPage}
                    className="rounded-lg border-2 border-gray-200 bg-white px-6 py-2 font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {isFetchingNextPage ? "Loading..." : "Load More Orders"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
