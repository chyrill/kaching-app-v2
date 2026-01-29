"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import DashboardNav from "~/components/DashboardNav";
import { api } from "~/trpc/react";

type InventoryPageProps = {
  params: { shopId: string | string[] };
};

type AdjustmentType = 'INCREASE' | 'DECREASE';

export default function InventoryPage({ params }: InventoryPageProps) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const rawShopId = params.shopId;
  const shopId = typeof rawShopId === 'string' ? rawShopId : Array.isArray(rawShopId) ? rawShopId[0] : undefined;

  const [mounted, setMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [stockFilter, setStockFilter] = useState<"all" | "in_stock" | "low_stock" | "out_of_stock">("all");

  // Adjustment modal state
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [adjustmentType, setAdjustmentType] = useState<AdjustmentType>('INCREASE');
  const [adjustmentQuantity, setAdjustmentQuantity] = useState<string>('');
  const [adjustmentReason, setAdjustmentReason] = useState<string>('');
  const [adjustmentNotes, setAdjustmentNotes] = useState<string>('');
  const [adjustmentError, setAdjustmentError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');

  // History modal state
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyProduct, setHistoryProduct] = useState<any>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch user's shops
  const { data: userShops, isLoading: isLoadingShops } = api.shop.getUserShops.useQuery(
    undefined,
    { enabled: mounted }
  );
  const currentShop = userShops?.find((s) => s.shopId === shopId);

  // Fetch inventory summary
  const { data: summary, isLoading: isLoadingSummary, refetch: refetchSummary } = api.shopee.getInventorySummary.useQuery(
    { shopId: shopId! },
    { enabled: mounted && !!shopId }
  );

  // Fetch inventory with pagination
  const {
    data: inventoryData,
    isLoading: isLoadingInventory,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch: refetchInventory,
  } = api.shopee.getInventory.useInfiniteQuery(
    {
      shopId: shopId!,
      limit: 20,
      search: searchQuery || undefined,
      platform: platformFilter !== "all" ? platformFilter : undefined,
      stockFilter,
    },
    {
      enabled: mounted && !!shopId,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    }
  );

  // Adjust stock mutation
  const adjustStock = api.shopee.adjustStock.useMutation({
    onSuccess: (data) => {
      setSuccessMessage(`Stock adjusted successfully! ${data.stockBefore} → ${data.stockAfter}`);
      setShowAdjustModal(false);
      resetAdjustmentForm();
      // Refresh data
      void refetchInventory();
      void refetchSummary();
      // Clear success message after 5 seconds
      setTimeout(() => setSuccessMessage(''), 5000);
    },
    onError: (error) => {
      setAdjustmentError(error.message);
    },
  });

  // Fetch stock movements for history modal
  const {
    data: movementsData,
    isLoading: isLoadingMovements,
    fetchNextPage: fetchNextMovements,
    hasNextPage: hasNextMovements,
    isFetchingNextPage: isFetchingNextMovements,
  } = api.shopee.getStockMovements.useInfiniteQuery(
    {
      productId: historyProduct?.id ?? '',
      shopId: shopId!,
      limit: 20,
    },
    {
      enabled: showHistoryModal && !!historyProduct && !!shopId,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    }
  );

  const allMovements = movementsData?.pages.flatMap((page) => page.movements) ?? [];

  const allProducts = inventoryData?.pages.flatMap((page) => page.products) ?? [];

  // Reset adjustment form
  const resetAdjustmentForm = () => {
    setSelectedProduct(null);
    setAdjustmentType('INCREASE');
    setAdjustmentQuantity('');
    setAdjustmentReason('');
    setAdjustmentNotes('');
    setAdjustmentError('');
  };

  // Open adjustment modal
  const openAdjustModal = (product: any) => {
    setSelectedProduct(product);
    setShowAdjustModal(true);
    resetAdjustmentForm();
    setSelectedProduct(product); // Set again after reset
  };

  // Open history modal
  const openHistoryModal = (product: any) => {
    setHistoryProduct(product);
    setShowHistoryModal(true);
  };

  // Handle adjustment submission
  const handleAdjustStock = () => {
    // Validate form
    if (!adjustmentQuantity || parseInt(adjustmentQuantity) < 1) {
      setAdjustmentError('Please enter a quantity of at least 1');
      return;
    }
    if (!adjustmentReason) {
      setAdjustmentError('Please select a reason');
      return;
    }

    adjustStock.mutate({
      productId: selectedProduct.id,
      shopId: shopId!,
      type: adjustmentType,
      quantity: parseInt(adjustmentQuantity),
      reason: adjustmentReason,
      notes: adjustmentNotes || undefined,
    });
  };

  // Format date for display
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  // Get source badge color
  const getSourceColor = (source: string) => {
    switch (source) {
      case 'MANUAL':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'WEBHOOK':
        return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'SYSTEM':
        return 'bg-gray-100 text-gray-700 border-gray-200';
      case 'ORDER_CREATED':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'ORDER_CANCELLED':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
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

  // Stock status indicator
  const getStockStatus = (stock: number, threshold: number | null) => {
    if (stock <= 0) {
      return { label: "Out of Stock", color: "bg-red-100 text-red-700 border-red-200" };
    } else if (stock <= (threshold ?? 10)) {
      return { label: "Low Stock", color: "bg-yellow-100 text-yellow-700 border-yellow-200" };
    } else {
      return { label: "In Stock", color: "bg-emerald-100 text-emerald-700 border-emerald-200" };
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
          <h1 className="mb-6 text-3xl font-bold text-gray-900">Inventory Management</h1>

          {/* Success Message */}
          {successMessage && (
            <div className="mb-6 rounded-lg border-2 border-green-200 bg-green-50 p-4">
              <div className="flex items-center gap-2">
                <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <p className="text-green-800">{successMessage}</p>
              </div>
            </div>
          )}

          {/* Summary Stats */}
          {isLoadingSummary ? (
            <div className="mb-6 rounded-lg border-2 border-gray-200 bg-white p-6 text-center">
              <div className="text-gray-600">Loading summary...</div>
            </div>
          ) : summary ? (
            <div className="mb-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
              <div className="rounded-lg border-2 border-gray-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Products</p>
                    <p className="mt-1 text-2xl font-bold text-gray-900">{summary.totalProducts}</p>
                  </div>
                  <div className="rounded-lg bg-blue-100 p-3">
                    <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border-2 border-gray-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">In Stock</p>
                    <p className="mt-1 text-2xl font-bold text-emerald-600">{summary.inStockCount}</p>
                  </div>
                  <div className="rounded-lg bg-emerald-100 p-3">
                    <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border-2 border-gray-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Low Stock</p>
                    <p className="mt-1 text-2xl font-bold text-yellow-600">{summary.lowStockCount}</p>
                  </div>
                  <div className="rounded-lg bg-yellow-100 p-3">
                    <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border-2 border-gray-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Out of Stock</p>
                    <p className="mt-1 text-2xl font-bold text-red-600">{summary.outOfStockCount}</p>
                  </div>
                  <div className="rounded-lg bg-red-100 p-3">
                    <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border-2 border-gray-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Inventory Value</p>
                    <p className="mt-1 text-2xl font-bold text-gray-900">
                      ₱{summary.totalInventoryValue.toFixed(2)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-purple-100 p-3">
                    <svg className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

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
                  placeholder="Product name or SKU..."
                  className="w-full rounded-lg border-2 border-gray-200 px-4 py-2 text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:outline-none"
                />
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

              {/* Stock Filter */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Stock Status</label>
                <select
                  value={stockFilter}
                  onChange={(e) => setStockFilter(e.target.value as typeof stockFilter)}
                  className="w-full rounded-lg border-2 border-gray-200 px-4 py-2 text-gray-900 focus:border-emerald-500 focus:outline-none"
                >
                  <option value="all">All Products</option>
                  <option value="in_stock">In Stock</option>
                  <option value="low_stock">Low Stock</option>
                  <option value="out_of_stock">Out of Stock</option>
                </select>
              </div>
            </div>
          </div>

          {/* Products Table */}
          {isLoadingInventory ? (
            <div className="rounded-lg border-2 border-gray-200 bg-white p-12 text-center">
              <div className="text-gray-600">Loading inventory...</div>
            </div>
          ) : allProducts.length === 0 ? (
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
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
              <h3 className="mb-2 text-lg font-semibold text-gray-900">No products found</h3>
              <p className="text-sm text-gray-600">
                {searchQuery || platformFilter !== "all" || stockFilter !== "all"
                  ? "Try adjusting your filters or search query"
                  : "Products from connected platforms will appear here"}
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
                          Product
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-600">
                          SKU
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-600">
                          Platform
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-600">
                          Price
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-600">
                          Stock
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-600">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-600">
                          Value
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-600">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {allProducts.map((product) => {
                        const stockStatus = getStockStatus(product.stock, product.lowStockThreshold);
                        const itemValue = product.cost ? Number(product.cost) * product.stock : 0;
                        
                        return (
                          <tr key={product.id} className="hover:bg-gray-50 transition">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                {product.imageUrl && (
                                  <img
                                    src={product.imageUrl}
                                    alt={product.name}
                                    className="h-10 w-10 rounded-lg border-2 border-gray-200 object-cover"
                                  />
                                )}
                                <span className="font-medium text-gray-900">{product.name}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-700">
                              {product.sku || "-"}
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getPlatformColor(product.platform)}`}>
                                {product.platform}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                              ₱{Number(product.price).toFixed(2)}
                            </td>
                            <td className="px-6 py-4">
                              <span className={`text-lg font-bold ${
                                product.stock <= 0 ? 'text-red-600' : 
                                product.stock <= (product.lowStockThreshold ?? 10) ? 'text-yellow-600' : 
                                'text-emerald-600'
                              }`}>
                                {product.stock}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${stockStatus.color}`}>
                                {stockStatus.label}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                              {product.cost ? `₱${itemValue.toFixed(2)}` : "-"}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex gap-2">
                                <button
                                  onClick={() => openAdjustModal(product)}
                                  className="rounded-lg border-2 border-emerald-500 bg-white px-3 py-2 text-sm font-semibold text-emerald-600 hover:bg-emerald-50 transition"
                                >
                                  Adjust
                                </button>
                                <button
                                  onClick={() => openHistoryModal(product)}
                                  className="rounded-lg border-2 border-blue-500 bg-white px-3 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50 transition"
                                >
                                  History
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Load More */}
              {hasNextPage && (
                <div className="mt-6 text-center">
                  <button
                    onClick={() => void fetchNextPage()}
                    disabled={isFetchingNextPage}
                    className="rounded-lg border-2 border-gray-200 bg-white px-6 py-2 font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {isFetchingNextPage ? "Loading..." : "Load More Products"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Adjustment Modal */}
      {showAdjustModal && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-lg border-2 border-gray-200 bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Adjust Stock</h2>
              <button
                onClick={() => {
                  setShowAdjustModal(false);
                  resetAdjustmentForm();
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Product Info */}
            <div className="mb-4 rounded-lg border-2 border-gray-200 bg-gray-50 p-4">
              <div className="flex items-center gap-3">
                {selectedProduct.imageUrl && (
                  <img
                    src={selectedProduct.imageUrl}
                    alt={selectedProduct.name}
                    className="h-12 w-12 rounded-lg border-2 border-gray-200 object-cover"
                  />
                )}
                <div>
                  <p className="font-semibold text-gray-900">{selectedProduct.name}</p>
                  <p className="text-sm text-gray-600">Current Stock: <span className="font-bold">{selectedProduct.stock}</span></p>
                </div>
              </div>
            </div>

            {/* Error Message */}
            {adjustmentError && (
              <div className="mb-4 rounded-lg border-2 border-red-200 bg-red-50 p-3">
                <p className="text-sm text-red-800">{adjustmentError}</p>
              </div>
            )}

            {/* Adjustment Type */}
            <div className="mb-4">
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Adjustment Type
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setAdjustmentType('INCREASE')}
                  className={`flex-1 rounded-lg border-2 px-4 py-2 font-semibold transition ${
                    adjustmentType === 'INCREASE'
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Increase
                </button>
                <button
                  onClick={() => setAdjustmentType('DECREASE')}
                  className={`flex-1 rounded-lg border-2 px-4 py-2 font-semibold transition ${
                    adjustmentType === 'DECREASE'
                      ? 'border-red-500 bg-red-50 text-red-700'
                      : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Decrease
                </button>
              </div>
            </div>

            {/* Quantity */}
            <div className="mb-4">
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Quantity
              </label>
              <input
                type="number"
                min="1"
                value={adjustmentQuantity}
                onChange={(e) => {
                  setAdjustmentQuantity(e.target.value);
                  setAdjustmentError('');
                }}
                className="w-full rounded-lg border-2 border-gray-200 p-2 focus:border-emerald-500 focus:outline-none"
                placeholder="Enter quantity"
              />
            </div>

            {/* Reason */}
            <div className="mb-4">
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Reason
              </label>
              <select
                value={adjustmentReason}
                onChange={(e) => {
                  setAdjustmentReason(e.target.value);
                  setAdjustmentError('');
                }}
                className="w-full rounded-lg border-2 border-gray-200 p-2 focus:border-emerald-500 focus:outline-none"
              >
                <option value="">Select a reason</option>
                <option value="Stock Received">Stock Received</option>
                <option value="Sale">Sale</option>
                <option value="Damaged">Damaged</option>
                <option value="Returned">Returned</option>
                <option value="Lost">Lost</option>
                <option value="Correction">Inventory Correction</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* Notes */}
            <div className="mb-6">
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Notes (Optional)
              </label>
              <textarea
                value={adjustmentNotes}
                onChange={(e) => setAdjustmentNotes(e.target.value)}
                className="w-full rounded-lg border-2 border-gray-200 p-2 focus:border-emerald-500 focus:outline-none"
                rows={3}
                placeholder="Add any additional notes..."
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowAdjustModal(false);
                  resetAdjustmentForm();
                }}
                className="flex-1 rounded-lg border-2 border-gray-200 bg-white px-4 py-2 font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAdjustStock}
                disabled={adjustStock.isPending}
                className="flex-1 rounded-lg border-2 border-emerald-500 bg-emerald-500 px-4 py-2 font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
              >
                {adjustStock.isPending ? 'Adjusting...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && historyProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-lg border-2 border-gray-200 bg-white shadow-xl flex flex-col">
            {/* Header */}
            <div className="border-b-2 border-gray-200 bg-gray-50 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Stock Movement History</h2>
                  <p className="mt-1 text-sm text-gray-600">{historyProduct.name}</p>
                </div>
                <button
                  onClick={() => {
                    setShowHistoryModal(false);
                    setHistoryProduct(null);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Product Info */}
              <div className="mt-4 flex items-center gap-3 rounded-lg border-2 border-gray-200 bg-white p-3">
                {historyProduct.imageUrl && (
                  <img
                    src={historyProduct.imageUrl}
                    alt={historyProduct.name}
                    className="h-12 w-12 rounded-lg border-2 border-gray-200 object-cover"
                  />
                )}
                <div>
                  <p className="font-semibold text-gray-900">{historyProduct.name}</p>
                  <p className="text-sm text-gray-600">
                    SKU: {historyProduct.sku || "N/A"} • Current Stock: <span className="font-bold">{historyProduct.stock}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Timeline Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {isLoadingMovements ? (
                <div className="text-center py-8">
                  <div className="text-gray-600">Loading movement history...</div>
                </div>
              ) : allMovements.length === 0 ? (
                <div className="text-center py-8">
                  <div className="rounded-lg border-2 border-gray-200 bg-gray-50 p-8">
                    <p className="text-gray-600">No stock movements recorded yet.</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Timeline */}
                  <div className="space-y-4">
                    {allMovements.map((movement, index) => (
                      <div key={movement.id} className="relative">
                        {/* Timeline line */}
                        {index < allMovements.length - 1 && (
                          <div className="absolute left-6 top-12 bottom-0 w-0.5 bg-gray-200" />
                        )}

                        {/* Movement card */}
                        <div className="flex gap-4">
                          {/* Timeline dot */}
                          <div className={`flex-shrink-0 mt-1 h-12 w-12 rounded-full border-4 flex items-center justify-center ${
                            movement.type === 'INCREASE' 
                              ? 'border-emerald-200 bg-emerald-100' 
                              : 'border-red-200 bg-red-100'
                          }`}>
                            {movement.type === 'INCREASE' ? (
                              <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                              </svg>
                            ) : (
                              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                              </svg>
                            )}
                          </div>

                          {/* Content */}
                          <div className="flex-1 rounded-lg border-2 border-gray-200 bg-white p-4">
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="flex items-center gap-2 mb-2">
                                  <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${
                                    movement.type === 'INCREASE' 
                                      ? 'bg-emerald-100 text-emerald-700 border-emerald-200' 
                                      : 'bg-red-100 text-red-700 border-red-200'
                                  }`}>
                                    {movement.type === 'INCREASE' ? '+' : '-'}{movement.quantity}
                                  </span>
                                  <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${getSourceColor(movement.source)}`}>
                                    {movement.source.replace(/_/g, ' ')}
                                  </span>
                                </div>
                                <p className="text-sm font-semibold text-gray-900 mb-1">
                                  {movement.reason}
                                </p>
                                {movement.notes && (
                                  <p className="text-sm text-gray-600 mb-2">
                                    {movement.notes}
                                  </p>
                                )}
                                <div className="flex items-center gap-4 text-xs text-gray-500">
                                  <span>
                                    Stock: <span className="font-semibold">{movement.stockBefore}</span> → <span className="font-semibold">{movement.stockAfter}</span>
                                  </span>
                                  <span>•</span>
                                  <span>
                                    By: {movement.user.name || movement.user.email}
                                  </span>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-gray-500">
                                  {formatDate(movement.createdAt)}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Load More */}
                  {hasNextMovements && (
                    <div className="mt-6 text-center">
                      <button
                        onClick={() => void fetchNextMovements()}
                        disabled={isFetchingNextMovements}
                        className="rounded-lg border-2 border-gray-200 bg-white px-6 py-2 font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        {isFetchingNextMovements ? "Loading..." : "Load More"}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="border-t-2 border-gray-200 bg-gray-50 p-4">
              <button
                onClick={() => {
                  setShowHistoryModal(false);
                  setHistoryProduct(null);
                }}
                className="w-full rounded-lg border-2 border-gray-200 bg-white px-4 py-2 font-semibold text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
