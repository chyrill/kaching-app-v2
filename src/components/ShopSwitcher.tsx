"use client";

import { useState, useRef, useEffect } from "react";

interface Shop {
  shopId: string;
  name: string;
  role: string;
  memberCount: number;
}

interface ShopSwitcherProps {
  shops: Shop[];
  currentShopId: string;
  onSwitch: (shopId: string) => void;
  isLoading?: boolean;
}

export default function ShopSwitcher({
  shops,
  currentShopId,
  onSwitch,
  isLoading = false,
}: ShopSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentShop = shops.find((s) => s.shopId === currentShopId);
  const isSingleShop = shops.length === 1;

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleShopSelect = (shopId: string) => {
    if (shopId !== currentShopId) {
      onSwitch(shopId);
    }
    setIsOpen(false);
  };

  if (isSingleShop) {
    // Single shop: display as static text
    return (
      <div className="flex items-center gap-2 rounded-lg bg-white/5 px-4 py-2">
        <svg
          className="h-5 w-5 text-white/60"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
          />
        </svg>
        <div>
          <div className="text-sm font-medium text-white">
            {currentShop?.name}
          </div>
          <div className="text-xs text-white/60">{currentShop?.role}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        className="flex items-center gap-2 rounded-lg bg-white/5 px-4 py-2 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <svg
          className="h-5 w-5 text-white/60"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
          />
        </svg>
        <div className="text-left">
          <div className="text-sm font-medium text-white">
            {currentShop?.name}
          </div>
          <div className="text-xs text-white/60">{currentShop?.role}</div>
        </div>
        <svg
          className={`h-4 w-4 text-white/60 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-2 w-72 rounded-lg border border-white/10 bg-[#1a1a2e] shadow-xl">
          <div className="p-2">
            <div className="mb-2 px-3 py-2 text-xs font-semibold uppercase text-white/60">
              Your Shops
            </div>
            {shops.map((shop) => (
              <button
                key={shop.shopId}
                onClick={() => handleShopSelect(shop.shopId)}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition hover:bg-white/5"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10">
                    <svg
                      className="h-5 w-5 text-white/80"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                      />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white">
                      {shop.name}
                    </div>
                    <div className="text-xs text-white/60">
                      {shop.role} • {shop.memberCount}{" "}
                      {shop.memberCount === 1 ? "member" : "members"}
                    </div>
                  </div>
                </div>
                {shop.shopId === currentShopId && (
                  <svg
                    className="h-5 w-5 text-green-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
