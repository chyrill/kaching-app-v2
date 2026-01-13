"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { api } from "~/trpc/react";
import DashboardNav from "~/components/DashboardNav";

export default function IntegrationsPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      router.push(`/auth/login?callbackUrl=${encodeURIComponent(typeof window !== 'undefined' ? window.location.pathname : '')}`);
    },
  });

  const rawShopId = params.shopId;
  const shopId = typeof rawShopId === 'string' ? rawShopId : Array.isArray(rawShopId) ? rawShopId[0] : undefined;

  const [mounted, setMounted] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    setMounted(true);

    // Check for OAuth callback messages
    const success = searchParams.get('success');
    const error = searchParams.get('error');

    if (success === 'connected') {
      setNotification({ type: 'success', message: 'Shopee connected successfully! Your product catalog is being imported.' });
    } else if (error) {
      const errorMessages: Record<string, string> = {
        'connection_failed': 'Failed to connect to Shopee. Please try again.',
        'unauthorized': 'You do not have permission to connect this shop.',
        'invalid_callback': 'Invalid Shopee callback. Please try again.',
      };
      setNotification({ type: 'error', message: errorMessages[error] ?? 'An error occurred during connection.' });
    }

    // Clear URL params after showing notification
    if (success || error) {
      const timer = setTimeout(() => {
        router.replace(`/${shopId}/settings/integrations`);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [searchParams, shopId, router]);

  // Fetch user's shops
  const { data: userShops, isLoading: isLoadingShops } = api.shop.getUserShops.useQuery(
    undefined,
    { enabled: mounted }
  );
  const currentShop = userShops?.find((s) => s.shopId === shopId);
  const isOwner = currentShop?.role === "OWNER";

  // Fetch Shopee integration status
  const {
    data: shopeeIntegration,
    isLoading: isLoadingIntegration,
    refetch: refetchIntegration,
  } = api.shopee.getIntegrationStatus.useQuery(
    { shopId: shopId! },
    { enabled: mounted && !!shopId && !!isOwner }
  );

  const handleConnectShopee = () => {
    if (!shopId) return;
    // Redirect to OAuth authorization endpoint
    window.location.href = `/api/auth/shopee/authorize?shopId=${shopId}`;
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
          <h1 className="mb-4 text-2xl font-bold text-gray-900">
            Access Denied
          </h1>
          <p className="mb-6 text-gray-600">
            You do not have access to this shop.
          </p>
          <button
            onClick={() => router.push("/")}
            className="w-full rounded-lg bg-emerald-500 px-6 py-3 font-semibold text-white hover:bg-emerald-600"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="flex min-h-screen bg-white">
        <DashboardNav
          shopId={shopId}
          currentShop={currentShop}
          userEmail={session?.user.email}
          onSignOut={() => setShowLogoutModal(true)}
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
            <h1 className="mb-6 text-3xl font-bold text-gray-900">Integrations</h1>
            <div className="rounded-lg border-2 border-gray-200 bg-gray-50 p-6 text-center">
              <p className="text-gray-600">
                You must be a shop owner to manage integrations.
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const isConnected = shopeeIntegration?.connected && !shopeeIntegration?.isDeleted;

  return (
    <div className="flex min-h-screen bg-white">
      <DashboardNav
        shopId={shopId}
        currentShop={currentShop}
        userEmail={session?.user.email}
        onSignOut={() => setShowLogoutModal(true)}
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
          <div className="mx-auto max-w-4xl">
            <h1 className="mb-6 text-3xl font-bold text-gray-900">Integrations</h1>

            {/* Notification */}
            {notification && (
              <div className={`mb-6 rounded-lg border-2 p-4 ${
                notification.type === 'success' 
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-red-200 bg-red-50 text-red-700'
              }`}>
                <div className="flex items-center justify-between">
                  <p>{notification.message}</p>
                  <button
                    onClick={() => setNotification(null)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ×
                  </button>
                </div>
              </div>
            )}

            {/* Shopee Integration Card */}
            <div className="rounded-lg border-2 border-gray-200 bg-white p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="rounded-lg bg-orange-100 p-3">
                    <svg className="h-8 w-8 text-orange-600" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"/>
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Shopee</h2>
                    <p className="mt-1 text-sm text-gray-600">
                      Connect your Shopee shop to sync orders and inventory automatically.
                    </p>
                    {isConnected && (
                      <div className="mt-3 flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                          <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                          Connected
                        </span>
                        {shopeeIntegration?.status === 'UNHEALTHY' && (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                            ⚠️ Connection Issue
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  {!isConnected ? (
                    <button
                      onClick={handleConnectShopee}
                      className="rounded-lg bg-emerald-500 px-6 py-2 font-semibold text-white hover:bg-emerald-600"
                    >
                      Connect Shopee
                    </button>
                  ) : (
                    <button
                      onClick={() => {/* TODO: Implement disconnect */}}
                      className="rounded-lg border-2 border-gray-200 bg-white px-6 py-2 font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      Disconnect
                    </button>
                  )}
                </div>
              </div>

              {isConnected && shopeeIntegration?.lastSyncAt && (
                <div className="mt-4 border-t-2 border-gray-100 pt-4">
                  <p className="text-sm text-gray-600">
                    Last synced: {new Date(shopeeIntegration.lastSyncAt).toLocaleString()}
                  </p>
                </div>
              )}
            </div>

            {/* Coming Soon Cards */}
            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <div className="rounded-lg border-2 border-gray-200 bg-gray-50 p-6 opacity-50">
                <div className="flex items-center gap-3 mb-2">
                  <div className="rounded-lg bg-blue-100 p-2">
                    <svg className="h-6 w-6 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"/>
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">Lazada</h3>
                </div>
                <p className="text-sm text-gray-600">Coming in Epic 7</p>
              </div>

              <div className="rounded-lg border-2 border-gray-200 bg-gray-50 p-6 opacity-50">
                <div className="flex items-center gap-3 mb-2">
                  <div className="rounded-lg bg-pink-100 p-2">
                    <svg className="h-6 w-6 text-pink-600" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"/>
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">TikTok Shop</h3>
                </div>
                <p className="text-sm text-gray-600">Coming in Epic 8</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
