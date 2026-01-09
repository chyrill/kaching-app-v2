"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";

import { api } from "~/trpc/react";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resetSuccess = searchParams.get("reset") === "success";
  const loggedOut = searchParams.get("logout") === "success";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (resetSuccess) {
      setSuccessMessage("Password reset successfully! Please sign in with your new password.");
    }
    if (loggedOut) {
      setSuccessMessage("Logged out successfully");
    }
  }, [resetSuccess, loggedOut]);

  const getCurrentUserQuery = api.auth.getCurrentUser.useQuery(undefined, {
    enabled: false, // Only run manually after login
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    // Client-side validation
    if (!email || !password) {
      setError("All fields are required");
      setIsLoading(false);
      return;
    }

    // Attempt login
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("Invalid email or password");
      setIsLoading(false);
      return;
    }

    if (result?.ok) {
      // Fetch user's shops to determine redirect
      const userData = await getCurrentUserQuery.refetch();
      
      if (userData.data?.shops && userData.data.shops.length > 0) {
        // User has shops, redirect to first shop's dashboard
        const firstShop = userData.data.shops[0];
        if (firstShop) {
          router.push(`/${firstShop.shopId}/dashboard`);
        }
      } else {
        // No shops, redirect to onboarding
        router.push("/onboarding/create-shop");
      }
    } else {
      setError("Login failed. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="w-full max-w-md rounded-xl border-2 border-gray-200 bg-gray-50 p-8 shadow-sm">
        <h1 className="mb-6 text-center text-3xl font-bold text-gray-900">
          Sign In
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg border-2 border-gray-200 bg-white px-4 py-2 text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              placeholder="you@example.com"
              disabled={isLoading}
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-lg border-2 border-gray-200 bg-white px-4 py-2 text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              placeholder="Enter your password"
              disabled={isLoading}
            />
          </div>

          <div className="text-right">
            <Link
              href="/auth/forgot-password"
              className="text-sm text-gray-600 hover:text-emerald-600 hover:underline"
            >
              Forgot password?
            </Link>
          </div>

          {successMessage && (
            <div
              className="rounded-lg border-2 border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700"
              role="alert"
            >
              {successMessage}
            </div>
          )}

          {error && (
            <div
              className="rounded-lg border-2 border-red-200 bg-red-50 p-3 text-sm text-red-700"
              role="alert"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg bg-emerald-500 px-4 py-3 font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600">
          Don't have an account?{" "}
          <Link
            href="/auth/signup"
            className="font-medium text-emerald-600 hover:underline"
          >
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
