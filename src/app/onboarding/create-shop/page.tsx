"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";

import { api } from "~/trpc/react";

export default function CreateShopPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [name, setName] = useState("");
  const [tinNumber, setTinNumber] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const createShopMutation = api.shop.createShop.useMutation({
    onSuccess: (data) => {
      // Redirect to shop dashboard
      router.push(`/${data.shop.id}/dashboard`);
    },
    onError: (err) => {
      setError(err.message);
      setIsLoading(false);
    },
  });

  // Redirect to login if not authenticated
  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    router.push("/auth/login");
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Client-side validation
    if (!name.trim()) {
      setError("Shop name is required");
      return;
    }

    if (!tinNumber.trim()) {
      setError("TIN is required");
      return;
    }

    if (!/^\d{12}$/.test(tinNumber)) {
      setError("TIN must be 12 digits");
      return;
    }

    if (!businessAddress.trim()) {
      setError("Business address is required");
      return;
    }

    setIsLoading(true);
    createShopMutation.mutate({
      name: name.trim(),
      tinNumber: tinNumber.trim(),
      businessAddress: businessAddress.trim(),
      contactNumber: contactNumber.trim() || undefined,
    });
  };

  const handleTinInput = (value: string) => {
    // Only allow digits, max 12
    const digitsOnly = value.replace(/\D/g, "").slice(0, 12);
    setTinNumber(digitsOnly);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4 py-12">
      <div className="w-full max-w-2xl rounded-xl border-2 border-gray-200 bg-gray-50 p-8 shadow-sm">
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-4xl font-bold text-gray-900">
            Create Your Shop
          </h1>
          <p className="text-gray-600">
            Welcome, {session?.user.email}! Let's set up your business profile.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="name"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Shop Name <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded-lg border-2 border-gray-200 bg-white px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              placeholder="e.g., My Awesome Shop"
              disabled={isLoading}
            />
          </div>

          <div>
            <label
              htmlFor="tinNumber"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              TIN Number <span className="text-red-500">*</span>
            </label>
            <input
              id="tinNumber"
              type="text"
              value={tinNumber}
              onChange={(e) => handleTinInput(e.target.value)}
              required
              maxLength={12}
              className="w-full rounded-lg border-2 border-gray-200 bg-white px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              placeholder="123456789000 (12 digits)"
              disabled={isLoading}
            />
            <p className="mt-1 text-xs text-gray-500">
              Enter your 12-digit Tax Identification Number
            </p>
          </div>

          <div>
            <label
              htmlFor="businessAddress"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Business Address <span className="text-red-500">*</span>
            </label>
            <textarea
              id="businessAddress"
              value={businessAddress}
              onChange={(e) => setBusinessAddress(e.target.value)}
              required
              rows={3}
              className="w-full rounded-lg border-2 border-gray-200 bg-white px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              placeholder="e.g., 123 Main St, Makati City, Metro Manila"
              disabled={isLoading}
            />
          </div>

          <div>
            <label
              htmlFor="contactNumber"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Contact Number (Optional)
            </label>
            <input
              id="contactNumber"
              type="text"
              value={contactNumber}
              onChange={(e) => setContactNumber(e.target.value)}
              className="w-full rounded-lg border-2 border-gray-200 bg-white px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              placeholder="e.g., +63 XXX XXX XXXX"
              disabled={isLoading}
            />
          </div>

          {error && (
            <div
              className="rounded-lg border-2 border-red-200 bg-red-50 p-3 text-sm text-red-700"
              role="alert"
            >
              {error}
            </div>
          )}

          <div className="flex gap-3">
            {session?.user.defaultShopId && (
              <Link
                href={`/${session.user.defaultShopId}/dashboard`}
                className="flex-1 rounded-lg border-2 border-gray-200 px-4 py-3 text-center font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                Cancel
              </Link>
            )}
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 rounded-lg bg-emerald-500 px-4 py-3 font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? "Creating shop..." : "Create Shop"}
            </button>
          </div>
        </form>

        <p className="mt-6 text-center text-xs text-gray-500">
          * Required fields
        </p>
      </div>
    </div>
  );
}
