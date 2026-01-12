"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface DashboardNavProps {
  shopId: string;
  currentShop: {
    name: string;
    role: string;
  };
  userEmail?: string | null;
  onSignOut: () => void;
}

export default function DashboardNav({
  shopId,
  currentShop,
  userEmail,
  onSignOut,
}: DashboardNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const navRef = useRef<HTMLDivElement>(null);

  // Listen for toggle event from external button
  useEffect(() => {
    const handleToggle = () => setIsOpen(prev => !prev);
    const element = navRef.current;
    
    if (element) {
      element.addEventListener('toggleNav', handleToggle);
    }
    
    return () => {
      if (element) {
        element.removeEventListener('toggleNav', handleToggle);
      }
    };
  }, []);

  const isActive = (path: string) => pathname === path;

  const navItems = [
    {
      name: "Dashboard",
      href: `/${shopId}/dashboard`,
      icon: (
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
          />
        </svg>
      ),
    },
    {
      name: "Team Settings",
      href: `/${shopId}/settings/team`,
      icon: (
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      ),
      ownerOnly: true,
    },
  ];

  const visibleNavItems = navItems.filter(
    (item) => !item.ownerOnly || currentShop.role === "OWNER"
  );

  return (
    <>
      {/* Hidden ref element for event listening */}
      <div ref={navRef} data-mobile-nav className="sr-only" aria-hidden="true" />
      
      {/* Sidebar for desktop only */}
      <aside className="hidden lg:block lg:w-64 border-r-2 border-gray-200 bg-gray-50">
        <div className="flex h-full flex-col">
          {/* Shop info */}
          <div className="border-b-2 border-gray-200 p-4">
            <h2 className="text-lg font-semibold text-gray-900">
              {currentShop.name}
            </h2>
            <p className="text-sm text-gray-600">{userEmail}</p>
            <span
              className={`mt-2 inline-block rounded-full px-2 py-1 text-xs font-semibold ${
                currentShop.role === "OWNER"
                  ? "bg-emerald-100 text-emerald-700"
                  : currentShop.role === "ACCOUNTANT"
                    ? "bg-blue-100 text-blue-700"
                    : "bg-orange-100 text-orange-700"
              }`}
            >
              {currentShop.role}
            </span>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 p-4">
            {visibleNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-4 py-2 text-sm font-medium transition ${
                  isActive(item.href)
                    ? "bg-emerald-100 text-emerald-700"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                {item.icon}
                {item.name}
              </Link>
            ))}
          </nav>

          {/* Sign out */}
          <div className="border-t-2 border-gray-200 p-4">
            <button
              onClick={onSignOut}
              className="flex w-full items-center gap-3 rounded-lg px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile drawer */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setIsOpen(false)}
          />

          {/* Drawer */}
          <aside className="fixed inset-y-0 left-0 z-50 w-64 border-r-2 border-gray-200 bg-gray-50 lg:hidden">
            <div className="flex h-full flex-col">
              {/* Close button */}
              <div className="flex items-center justify-between border-b-2 border-gray-200 p-4">
                <h2 className="text-lg font-semibold text-gray-900">Menu</h2>
                <button
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg p-1 text-gray-700 hover:bg-gray-100"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {/* Shop info */}
              <div className="border-b-2 border-gray-200 p-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  {currentShop.name}
                </h3>
                <p className="text-sm text-gray-600">{userEmail}</p>
                <span
                  className={`mt-2 inline-block rounded-full px-2 py-1 text-xs font-semibold ${
                    currentShop.role === "OWNER"
                      ? "bg-emerald-100 text-emerald-700"
                      : currentShop.role === "ACCOUNTANT"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-orange-100 text-orange-700"
                  }`}
                >
                  {currentShop.role}
                </span>
              </div>

              {/* Navigation */}
              <nav className="flex-1 space-y-1 p-4">
                {visibleNavItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-4 py-2 text-sm font-medium transition ${
                      isActive(item.href)
                        ? "bg-emerald-100 text-emerald-700"
                        : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    {item.icon}
                    {item.name}
                  </Link>
                ))}
              </nav>

              {/* Sign out */}
              <div className="border-t-2 border-gray-200 p-4">
                <button
                  onClick={() => {
                    setIsOpen(false);
                    onSignOut();
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                    />
                  </svg>
                  Sign Out
                </button>
              </div>
            </div>
          </aside>
        </>
      )}
    </>
  );
}
