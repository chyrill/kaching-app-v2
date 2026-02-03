"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import DashboardNav from "~/components/DashboardNav";
import { api } from "~/trpc/react";

type InventoryAnalyticsPageProps = {
  params: { shopId: string | string[] };
};

export default function InventoryAnalyticsPage({ params }: InventoryAnalyticsPageProps) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const rawShopId = params.shopId;
  const shopId = typeof rawShopId === 'string' ? rawShopId : Array.isArray(rawShopId) ? rawShopId[0] : undefined;

  const [mounted, setMounted] = useState(false);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch user's shops
  const { data: userShops, isLoading: isLoadingShops } = api.shop.getUserShops.useQuery(
    undefined,
    { enabled: mounted }
  );
  const currentShop = userShops?.find((s) => s.shopId === shopId);

  // Fetch inventory analytics
  const { data: analytics, isLoading: isLoadingAnalytics } = api.shopee.getInventoryAnalytics.useQuery(
    { shopId: shopId!, dateRange },
    { enabled: mounted && !!shopId }
  );

  // Auth/loading states
  if (status === "loading" || isLoadingShops || !mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    router.push("/auth/signin");
    return null;
  }

  if (!currentShop) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
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

  const dateRangeLabels = {
    '7d': 'Last 7 Days',
    '30d': 'Last 30 Days',
    '90d': 'Last 90 Days',
    'all': 'All Time',
  };

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
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Inventory Analytics</h1>
              <p className="mt-1 text-sm text-gray-600">Track performance and optimize stock levels</p>
            </div>
            <button
              onClick={() => router.push(`/${shopId}/inventory`)}
              className="rounded-lg border-2 border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              ← Back to Inventory
            </button>
          </div>

          {/* Date Range Filter */}
          <div className="mb-6 rounded-lg border-2 border-gray-200 bg-white p-4">
            <label className="mb-2 block text-sm font-semibold text-gray-700">Date Range</label>
            <div className="flex gap-2">
              {(['7d', '30d', '90d', 'all'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setDateRange(range)}
                  className={`rounded-lg border-2 px-4 py-2 text-sm font-semibold transition ${
                    dateRange === range
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {dateRangeLabels[range]}
                </button>
              ))}
            </div>
          </div>

          {/* Analytics Content */}
          {isLoadingAnalytics ? (
            <div className="rounded-lg border-2 border-gray-200 bg-white p-12 text-center">
              <div className="text-gray-600">Loading analytics...</div>
            </div>
          ) : analytics ? (
            <>
              {/* Key Metrics */}
              <div className="mb-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-lg border-2 border-gray-200 bg-white p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Inventory Value</p>
                      <p className="mt-1 text-3xl font-bold text-gray-900">
                        ₱{analytics.totalInventoryValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="rounded-lg bg-purple-100 p-3">
                      <svg className="h-8 w-8 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border-2 border-gray-200 bg-white p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Turnover Rate</p>
                      <p className="mt-1 text-3xl font-bold text-gray-900">{analytics.turnoverRate}x</p>
                      <p className="mt-1 text-xs text-gray-500">Higher is better</p>
                    </div>
                    <div className="rounded-lg bg-blue-100 p-3">
                      <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border-2 border-gray-200 bg-white p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Units Sold</p>
                      <p className="mt-1 text-3xl font-bold text-gray-900">{analytics.totalUnitsSold.toLocaleString()}</p>
                      <p className="mt-1 text-xs text-gray-500">{dateRangeLabels[analytics.dateRange]}</p>
                    </div>
                    <div className="rounded-lg bg-emerald-100 p-3">
                      <svg className="h-8 w-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Top Sellers */}
              <div className="mb-6 rounded-lg border-2 border-gray-200 bg-white p-6">
                <h2 className="mb-4 text-xl font-bold text-gray-900">Top Selling Products</h2>
                {analytics.topSellers.length === 0 ? (
                  <p className="text-center py-8 text-gray-600">No sales data available for this period</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="border-b-2 border-gray-200 bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Rank</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Product</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Units Sold</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Revenue</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Stock</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {analytics.topSellers.map((item, index) => (
                          <tr key={item.product.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full font-bold ${
                                index === 0 ? 'bg-yellow-100 text-yellow-700' :
                                index === 1 ? 'bg-gray-200 text-gray-700' :
                                index === 2 ? 'bg-orange-100 text-orange-700' :
                                'bg-gray-100 text-gray-600'
                              }`}>
                                {index + 1}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                {item.product.imageUrl && (
                                  <img
                                    src={item.product.imageUrl}
                                    alt={item.product.name}
                                    className="h-10 w-10 rounded-lg border-2 border-gray-200 object-cover"
                                  />
                                )}
                                <div>
                                  <p className="font-semibold text-gray-900">{item.product.name}</p>
                                  <p className="text-xs text-gray-500">{item.product.sku || 'N/A'}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 font-semibold text-gray-900">{item.unitsSold}</td>
                            <td className="px-4 py-3 font-semibold text-emerald-600">
                              ₱{item.revenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`font-semibold ${
                                item.product.stock <= 0 ? 'text-red-600' :
                                item.product.stock <= (item.product.lowStockThreshold ?? 10) ? 'text-yellow-600' :
                                'text-emerald-600'
                              }`}>
                                {item.product.stock}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Reorder Suggestions */}
              <div className="mb-6 rounded-lg border-2 border-yellow-200 bg-yellow-50 p-6">
                <div className="mb-4 flex items-center gap-2">
                  <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <h2 className="text-xl font-bold text-gray-900">Reorder Suggestions</h2>
                </div>
                {analytics.reorderSuggestions.length === 0 ? (
                  <p className="text-center py-4 text-gray-600">No reorder suggestions at this time</p>
                ) : (
                  <div className="space-y-3">
                    {analytics.reorderSuggestions.map((item) => (
                      <div key={item.product.id} className="rounded-lg border-2 border-yellow-200 bg-white p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex gap-3 flex-1">
                            {item.product.imageUrl && (
                              <img
                                src={item.product.imageUrl}
                                alt={item.product.name}
                                className="h-16 w-16 rounded-lg border-2 border-gray-200 object-cover"
                              />
                            )}
                            <div className="flex-1">
                              <h3 className="font-bold text-gray-900">{item.product.name}</h3>
                              <p className="text-sm text-gray-600 mb-2">SKU: {item.product.sku || 'N/A'}</p>
                              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                                <span className="text-gray-600">Current Stock: <span className="font-bold text-red-600">{item.currentStock}</span></span>
                                <span className="text-gray-600">Units Sold: <span className="font-bold">{item.unitsSold}</span></span>
                                <span className="text-gray-600">Avg Daily Sales: <span className="font-bold">{item.avgDailySales}</span></span>
                                <span className="text-gray-600">Days Left: <span className="font-bold text-orange-600">{item.daysOfStockLeft}</span></span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-gray-600">Suggested Reorder</p>
                            <p className="text-2xl font-bold text-emerald-600">{item.suggestedReorderQty}</p>
                            <p className="text-xs text-gray-500">units (2 weeks supply)</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Dead Stock */}
              <div className="rounded-lg border-2 border-gray-200 bg-white p-6">
                <h2 className="mb-4 text-xl font-bold text-gray-900">Dead Stock (No Movement)</h2>
                {analytics.deadStock.length === 0 ? (
                  <p className="text-center py-8 text-gray-600">All products have recent movement - great job!</p>
                ) : (
                  <div className="space-y-3">
                    {analytics.deadStock.map((item) => (
                      <div key={item.product.id} className="rounded-lg border-2 border-gray-200 bg-gray-50 p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex gap-3 flex-1">
                            {item.product.imageUrl && (
                              <img
                                src={item.product.imageUrl}
                                alt={item.product.name}
                                className="h-12 w-12 rounded-lg border-2 border-gray-200 object-cover"
                              />
                            )}
                            <div className="flex-1">
                              <h3 className="font-semibold text-gray-900">{item.product.name}</h3>
                              <p className="text-sm text-gray-600">SKU: {item.product.sku || 'N/A'} • Platform: {item.product.platform}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-600">Stock: <span className="font-bold">{item.product.stock}</span></p>
                            <p className="text-sm text-gray-600">Value: <span className="font-bold">₱{item.inventoryValue.toFixed(2)}</span></p>
                            <p className="text-xs text-red-600 font-semibold">{item.daysStagnant} days stagnant</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      </main>
    </div>
  );
}
