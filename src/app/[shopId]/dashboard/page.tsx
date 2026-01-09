"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

import { api } from "~/trpc/react";
import ShopSwitcher from "~/components/ShopSwitcher";
import DashboardNav from "~/components/DashboardNav";

interface DashboardPageProps {
  params: Promise<{
    shopId: string;
  }>;
}

export default function DashboardPage({ params }: DashboardPageProps) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [shopId, setShopId] = React.useState<string | null>(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Unwrap params
  React.useEffect(() => {
    void params.then((p) => setShopId(p.shopId));
  }, [params]);

  // Fetch user's shops
  const { data: shops, isLoading: shopsLoading } =
    api.shop.getUserShops.useQuery();

  // Find current shop from shops array
  const currentShop = shops?.find((s) => s.shopId === shopId);

  const switchShopMutation = api.shop.switchShop.useMutation({
    onSuccess: (data) => {
      // Redirect to new shop's dashboard
      router.push(`/${data.shopId}/dashboard`);
      router.refresh(); // Refresh to update session
    },
  });

  const handleShopSwitch = (newShopId: string) => {
    switchShopMutation.mutate({ shopId: newShopId });
  };

  // Loading state
  if (status === "loading" || !shopId || shopsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (status === "unauthenticated") {
    router.push("/auth/login");
    return null;
  }

  // User no longer has access to this shop
  if (!currentShop) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white p-6">
        <div className="max-w-md rounded-lg border-2 border-gray-200 bg-gray-100 p-8 text-center">
          <h1 className="mb-4 text-2xl font-bold text-gray-900">
            Access Removed
          </h1>
          <p className="mb-6 text-gray-600">
            You no longer have access to this shop. You may have been removed by the owner.
          </p>
          {shops && shops.length > 0 ? (
            <button
              onClick={() => router.push(`/${shops[0]!.shopId}/dashboard`)}
              className="w-full rounded-lg bg-emerald-500 px-6 py-3 font-semibold text-white hover:bg-emerald-600"
            >
              Go to {shops[0]!.name}
            </button>
          ) : (
            <button
              onClick={() => router.push("/onboarding/create-shop")}
              className="w-full rounded-lg bg-emerald-500 px-6 py-3 font-semibold text-white hover:bg-emerald-600"
            >
              Create a New Shop
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-white">
      {/* Navigation Drawer */}
      <DashboardNav
        shopId={shopId}
        currentShop={currentShop}
        userEmail={session?.user.email}
        onSignOut={() => setShowLogoutModal(true)}
      />

      {/* Main Content */}
      <main className="flex-1">
        {/* Top bar with shop switcher */}
        <header className="border-b-2 border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-4">
              {/* Mobile menu button placeholder - handled in DashboardNav */}
              <div className="lg:hidden">
                <DashboardNav
                  shopId={shopId}
                  currentShop={currentShop}
                  userEmail={session?.user.email}
                  onSignOut={() => setShowLogoutModal(true)}
                />
              </div>
              
              {shops && shops.length > 1 && (
                <ShopSwitcher
                  shops={shops}
                  currentShopId={shopId}
                  onSwitch={handleShopSwitch}
                  isLoading={switchShopMutation.isPending}
                />
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <div className="p-6">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold text-gray-900">Dashboard</h2>
              <p className="mt-2 text-gray-600">
                Welcome to your shop management center
              </p>
            </div>
            <Link
              href="/onboarding/create-shop"
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600"
            >
              + Create Another Shop
            </Link>
          </div>

          {/* Empty State Cards */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* Connect Shopee Card */}
            <div className="rounded-xl border-2 border-gray-200 bg-gray-50 p-6">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-orange-100">
              <svg
                className="h-6 w-6 text-orange-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <h3 className="mb-2 text-xl font-semibold text-gray-900">
              Connect Shopee
            </h3>
            <p className="mb-4 text-sm text-gray-600">
              Link your Shopee account to sync orders and inventory
            </p>
            <button
              disabled
              className="w-full rounded-lg bg-gray-200 px-4 py-2 font-semibold text-gray-500 transition disabled:cursor-not-allowed"
            >
              Coming in Epic 4
            </button>
          </div>

          {/* Generate Receipt Card */}
          <div className="rounded-xl border-2 border-gray-200 bg-gray-50 p-6">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-100">
              <svg
                className="h-6 w-6 text-emerald-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h3 className="mb-2 text-xl font-semibold text-gray-900">
              Generate Receipt
            </h3>
            <p className="mb-4 text-sm text-gray-600">
              Create official receipts for your sales transactions
            </p>
            <button
              disabled
              className="w-full rounded-lg bg-gray-200 px-4 py-2 font-semibold text-gray-500 transition disabled:cursor-not-allowed"
            >
              Coming in Epic 5
            </button>
          </div>

          {/* Inventory Card */}
          <div className="rounded-xl border-2 border-gray-200 bg-gray-50 p-6">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
              <svg
                className="h-6 w-6 text-blue-600"
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
            </div>
            <h3 className="mb-2 text-xl font-semibold text-gray-900">
              Inventory
            </h3>
            <p className="mb-4 text-sm text-gray-600">
              Track stock levels and sync with Shopee
            </p>
            <button
              disabled
              className="w-full rounded-lg bg-gray-200 px-4 py-2 font-semibold text-gray-500 transition disabled:cursor-not-allowed"
            >
              Coming in Epic 6
            </button>
          </div>
        </div>

        {/* Info Message */}
        <div className="mt-8 rounded-xl border-2 border-emerald-200 bg-emerald-50 p-6">
          <h4 className="mb-2 font-semibold text-emerald-900">
            🎉 Shop Created Successfully!
          </h4>
          <p className="text-sm text-emerald-700">
            Your shop &quot;{currentShop.name}&quot; is ready. Connect to Shopee (Epic 4), 
            generate receipts (Epic 5), and manage inventory (Epic 6) coming soon!
          </p>
        </div>
      </div>
    </main>

    {/* Logout Confirmation Modal */}
    {showLogoutModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-lg border-2 border-gray-200 bg-white p-6 shadow-xl">
          <h2 className="mb-4 text-xl font-bold text-gray-900">
            Sign Out
          </h2>
          <p className="mb-6 text-gray-600">
            Are you sure you want to sign out?
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => {
                void signOut({ callbackUrl: "/auth/login?logout=success" });
              }}
              className="flex-1 rounded-lg bg-red-500 px-4 py-2 font-semibold text-white hover:bg-red-600"
            >
              Yes, Sign Out
            </button>
            <button
              onClick={() => setShowLogoutModal(false)}
              className="flex-1 rounded-lg border-2 border-gray-200 bg-white px-4 py-2 font-semibold text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )}
    </div>
  );
}
