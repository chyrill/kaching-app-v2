"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import DashboardNav from "~/components/DashboardNav";
import { api } from "~/trpc/react";

type AnalyticsPageProps = {
  params: { shopId: string | string[] };
};

export default function AnalyticsPage({ params }: AnalyticsPageProps) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const rawShopId = params.shopId;
  const shopId = typeof rawShopId === 'string' ? rawShopId : Array.isArray(rawShopId) ? rawShopId[0] : undefined;

  const [mounted, setMounted] = useState(false);
  const [dateRange, setDateRange] = useState<"today" | "week" | "month" | "quarter" | "year" | "all">("month");

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch user's shops
  const { data: userShops, isLoading: isLoadingShops } = api.shop.getUserShops.useQuery(
    undefined,
    { enabled: mounted }
  );
  const currentShop = userShops?.find((s) => s.shopId === shopId);
  const canViewAnalytics = currentShop?.role === "OWNER" || currentShop?.role === "ACCOUNTANT";

  // Fetch analytics data
  const {
    data: analytics,
    isLoading: isLoadingAnalytics,
    error: analyticsError,
  } = api.shopee.getOrderAnalytics.useQuery(
    {
      shopId: shopId!,
      dateRange,
    },
    {
      enabled: mounted && !!shopId && canViewAnalytics,
    }
  );

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

  // Format percentage change
  const formatChange = (change: number) => {
    if (change === 0) return { text: "No change", color: "text-gray-600" };
    const sign = change > 0 ? "+" : "";
    const color = change > 0 ? "text-emerald-600" : "text-red-600";
    return { text: `${sign}${change.toFixed(1)}%`, color };
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

  if (!canViewAnalytics) {
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
            <h1 className="mb-6 text-3xl font-bold text-gray-900">Analytics</h1>
            <div className="rounded-lg border-2 border-gray-200 bg-gray-50 p-6 text-center">
              <p className="text-gray-600">You must be a shop owner or accountant to view analytics.</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (analyticsError) {
    return (
      <div className="flex min-h-screen bg-white">
        <DashboardNav
          shopId={shopId}
          currentShop={currentShop}
          userEmail={session?.user.email}
        />
        <main className="flex-1">
          <div className="p-6">
            <h1 className="mb-6 text-3xl font-bold text-gray-900">Analytics</h1>
            <div className="rounded-lg border-2 border-red-200 bg-red-50 p-6">
              <p className="font-semibold text-red-900">Error loading analytics</p>
              <p className="text-red-700">{analyticsError.message}</p>
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
          {/* Page Header */}
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-3xl font-bold text-gray-900">Order Analytics</h1>
            
            {/* Date Range Filter */}
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as typeof dateRange)}
              className="rounded-lg border-2 border-gray-200 px-4 py-2 font-semibold text-gray-900 focus:border-emerald-500 focus:outline-none"
            >
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
              <option value="quarter">Last 90 Days</option>
              <option value="year">Last Year</option>
              <option value="all">All Time</option>
            </select>
          </div>

          {isLoadingAnalytics ? (
            <div className="rounded-lg border-2 border-gray-200 bg-white p-12 text-center">
              <div className="text-gray-600">Loading analytics...</div>
            </div>
          ) : analytics ? (
            <>
              {/* Summary Stats */}
              <div className="mb-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-lg border-2 border-gray-200 bg-white p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                      <p className="mt-2 text-3xl font-bold text-gray-900">
                        ₱{analytics.summary.totalRevenue.toFixed(2)}
                      </p>
                      <p className={`mt-2 text-sm font-medium ${formatChange(analytics.summary.revenueChange).color}`}>
                        {formatChange(analytics.summary.revenueChange).text} from previous period
                      </p>
                    </div>
                    <div className="rounded-lg bg-emerald-100 p-3">
                      <svg className="h-8 w-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border-2 border-gray-200 bg-white p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Orders</p>
                      <p className="mt-2 text-3xl font-bold text-gray-900">
                        {analytics.summary.totalOrders}
                      </p>
                      <p className={`mt-2 text-sm font-medium ${formatChange(analytics.summary.ordersChange).color}`}>
                        {formatChange(analytics.summary.ordersChange).text} from previous period
                      </p>
                    </div>
                    <div className="rounded-lg bg-blue-100 p-3">
                      <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border-2 border-gray-200 bg-white p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Average Order Value</p>
                      <p className="mt-2 text-3xl font-bold text-gray-900">
                        ₱{analytics.summary.averageOrderValue.toFixed(2)}
                      </p>
                      <p className="mt-2 text-sm text-gray-600">Per order</p>
                    </div>
                    <div className="rounded-lg bg-purple-100 p-3">
                      <svg className="h-8 w-8 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Distribution & Revenue Trend */}
              <div className="mb-6 grid gap-6 lg:grid-cols-2">
                {/* Status Distribution */}
                <div className="rounded-lg border-2 border-gray-200 bg-white p-6">
                  <h2 className="mb-4 text-xl font-bold text-gray-900">Orders by Status</h2>
                  <div className="space-y-4">
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Completed</span>
                        <span className="text-sm font-bold text-gray-900">{analytics.statusCounts.completed}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                        <div 
                          className="h-full bg-emerald-500"
                          style={{ width: `${analytics.summary.totalOrders > 0 ? (analytics.statusCounts.completed / analytics.summary.totalOrders) * 100 : 0}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Shipped</span>
                        <span className="text-sm font-bold text-gray-900">{analytics.statusCounts.shipped}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                        <div 
                          className="h-full bg-purple-500"
                          style={{ width: `${analytics.summary.totalOrders > 0 ? (analytics.statusCounts.shipped / analytics.summary.totalOrders) * 100 : 0}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Processing</span>
                        <span className="text-sm font-bold text-gray-900">{analytics.statusCounts.processing}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                        <div 
                          className="h-full bg-blue-500"
                          style={{ width: `${analytics.summary.totalOrders > 0 ? (analytics.statusCounts.processing / analytics.summary.totalOrders) * 100 : 0}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Pending</span>
                        <span className="text-sm font-bold text-gray-900">{analytics.statusCounts.pending}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                        <div 
                          className="h-full bg-yellow-500"
                          style={{ width: `${analytics.summary.totalOrders > 0 ? (analytics.statusCounts.pending / analytics.summary.totalOrders) * 100 : 0}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Cancelled</span>
                        <span className="text-sm font-bold text-gray-900">{analytics.statusCounts.cancelled}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                        <div 
                          className="h-full bg-red-500"
                          style={{ width: `${analytics.summary.totalOrders > 0 ? (analytics.statusCounts.cancelled / analytics.summary.totalOrders) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Top Customers */}
                <div className="rounded-lg border-2 border-gray-200 bg-white p-6">
                  <h2 className="mb-4 text-xl font-bold text-gray-900">Top Customers</h2>
                  {analytics.topCustomers.length > 0 ? (
                    <div className="space-y-3">
                      {analytics.topCustomers.map((customer, index) => (
                        <div key={customer.name} className="flex items-center justify-between rounded-lg border-2 border-gray-100 bg-gray-50 p-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-600">
                              {index + 1}
                            </div>
                            <span className="font-medium text-gray-900">{customer.name}</span>
                          </div>
                          <span className="text-sm font-semibold text-gray-700">{customer.orderCount} orders</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-gray-500">No customer data available</p>
                  )}
                </div>
              </div>

              {/* Revenue Trend Chart */}
              <div className="mb-6 rounded-lg border-2 border-gray-200 bg-white p-6">
                <h2 className="mb-4 text-xl font-bold text-gray-900">Revenue Trend (Last 30 Days)</h2>
                {analytics.revenueTrend.length > 0 ? (
                  <div className="relative h-64">
                    <div className="absolute inset-0 flex items-end justify-between gap-1">
                      {analytics.revenueTrend.map((data) => {
                        const maxRevenue = Math.max(...analytics.revenueTrend.map(d => d.revenue));
                        const height = maxRevenue > 0 ? (data.revenue / maxRevenue) * 100 : 0;
                        return (
                          <div key={data.date} className="group relative flex-1">
                            <div 
                              className="w-full rounded-t bg-emerald-500 transition-all hover:bg-emerald-600"
                              style={{ height: `${height}%` }}
                            />
                            <div className="absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 rounded bg-gray-900 px-2 py-1 text-xs text-white group-hover:block">
                              <div className="whitespace-nowrap">
                                {new Date(data.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </div>
                              <div className="font-semibold">₱{data.revenue.toFixed(2)}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <p className="text-center text-gray-500">No revenue data available for the last 30 days</p>
                )}
              </div>

              {/* Recent Orders */}
              <div className="rounded-lg border-2 border-gray-200 bg-white p-6">
                <h2 className="mb-4 text-xl font-bold text-gray-900">Recent Orders</h2>
                {analytics.recentOrders.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="border-b-2 border-gray-200 bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Order Number</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Customer</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Date</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Platform</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Amount</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Status</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-600">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {analytics.recentOrders.map((order) => (
                          <tr key={order.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">{order.orderNumber}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">{order.customerName}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">
                              {new Date(order.orderDate).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getPlatformColor(order.platform)}`}>
                                {order.platform}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                              ₱{Number(order.totalAmount).toFixed(2)}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${getStatusColor(order.status)}`}>
                                {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() => router.push(`/${shopId}/orders/${order.id}`)}
                                className="text-sm font-semibold text-emerald-600 hover:text-emerald-700"
                              >
                                View Details
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-center text-gray-500">No recent orders</p>
                )}
              </div>
            </>
          ) : null}
        </div>
      </main>
    </div>
  );
}
