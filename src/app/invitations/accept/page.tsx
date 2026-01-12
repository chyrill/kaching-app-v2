"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession, signIn } from "next-auth/react";
import { api } from "~/trpc/react";

export default function AcceptInvitationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const token = searchParams.get("token");

  const [error, setError] = useState("");
  const [showSignup, setShowSignup] = useState(false);
  const [userExists, setUserExists] = useState<boolean | null>(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [isSigningUp, setIsSigningUp] = useState(false);

  // Get invitation details (fetch without auth to show signup form)
  const {
    data: invitation,
    isLoading: isLoadingInvitation,
    error: invitationError,
  } = api.team.getInvitationByToken.useQuery(
    { token: token ?? "" },
    { enabled: !!token },
  );

  // Check if user exists (only when invitation is loaded and user is not authenticated)
  const {
    data: userExistsData,
    isLoading: isCheckingUser,
  } = api.team.checkUserExists.useQuery(
    { email: invitation?.email ?? "" },
    { 
      enabled: !!invitation?.email && status === "unauthenticated",
    },
  );

  // Update userExists state when data is available
  useEffect(() => {
    if (userExistsData !== undefined) {
      setUserExists(userExistsData.exists);
    }
  }, [userExistsData]);

  // Accept invitation mutation
  const acceptMutation = api.team.acceptInvitation.useMutation({
    onSuccess: (data) => {
      router.push(`/${data.shopId}/dashboard`);
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const handleAccept = () => {
    if (!token) return;
    acceptMutation.mutate({ token });
  };

  const handleSignupAndAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invitation || !token) return;

    setIsSigningUp(true);
    setError("");

    try {
      // Create account
      const signupRes = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: invitation.email,
          password,
          name,
        }),
      });

      const data = await signupRes.json();

      if (!signupRes.ok) {
        // If user already exists, show message to login instead
        if (signupRes.status === 409) {
          setError("An account with this email already exists. Please sign in instead.");
          setIsSigningUp(false);
          return;
        }
        throw new Error(data.error || "Signup failed");
      }

      // Sign in
      const result = await signIn("credentials", {
        email: invitation.email,
        password,
        redirect: false,
      });

      if (result?.error) {
        throw new Error("Failed to sign in after signup");
      }

      // Accept invitation (will happen automatically after session loads)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create account");
      setIsSigningUp(false);
    }
  };

  // Auto-accept invitation if already authenticated
  useEffect(() => {
    if (status === "authenticated" && invitation && !acceptMutation.isSuccess) {
      handleAccept();
    }
  }, [status, invitation]);

  // Show signup form if unauthenticated and user doesn't exist
  useEffect(() => {
    if (status === "unauthenticated" && invitation && userExists === false) {
      setShowSignup(true);
    }
  }, [status, invitation, userExists]);

  if (status === "loading" || isLoadingInvitation || (status === "unauthenticated" && isCheckingUser)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="rounded-lg border-2 border-gray-200 bg-gray-50 p-8 text-center">
          <h1 className="mb-4 text-2xl font-bold text-gray-900">
            Invalid Invitation
          </h1>
          <p className="text-gray-600">No invitation token provided.</p>
        </div>
      </div>
    );
  }

  if (invitationError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="max-w-md rounded-lg border-2 border-gray-200 bg-gray-50 p-8 text-center">
          <h1 className="mb-4 text-2xl font-bold text-gray-900">
            Invitation Error
          </h1>
          <p className="mb-6 text-gray-600">{invitationError.message}</p>
          <button
            onClick={() => router.push("/")}
            className="rounded-lg bg-emerald-500 px-6 py-2 font-semibold text-white hover:bg-emerald-600"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!invitation) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="text-gray-600">Loading invitation...</div>
      </div>
    );
  }

  // Show login prompt if user already exists
  if (status === "unauthenticated" && userExists === true) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white p-6">
        <div className="max-w-md rounded-lg border-2 border-gray-200 bg-gray-50 p-8">
          <h1 className="mb-2 text-2xl font-bold text-gray-900">
            Sign In to Accept Invitation
          </h1>
          <p className="mb-6 text-sm text-gray-600">
            You've been invited to join <span className="font-semibold text-gray-900">{invitation.shopName}</span>
          </p>

          <div className="mb-6 rounded-lg border-2 border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm text-emerald-800">
              <strong>Good news!</strong> You already have an account with this email.
            </p>
            <p className="mt-2 text-sm text-emerald-700">
              Please sign in to accept the invitation.
            </p>
          </div>

          <button
            onClick={() => router.push(`/auth/login?callbackUrl=${encodeURIComponent(`/invitations/accept?token=${token}`)}`)}
            className="w-full rounded-lg bg-emerald-500 px-6 py-3 font-semibold text-white hover:bg-emerald-600"
          >
            Sign In to Accept
          </button>

          <p className="mt-4 text-center text-sm text-gray-600">
            Wrong email?{" "}
            <a href="/" className="text-emerald-600 hover:underline">
              Go back home
            </a>
          </p>
        </div>
      </div>
    );
  }

  // Show signup form if user is not authenticated and doesn't have an account
  if (showSignup && status === "unauthenticated" && userExists === false) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white p-6">
        <div className="max-w-md rounded-lg border-2 border-gray-200 bg-gray-50 p-8">
          <h1 className="mb-2 text-2xl font-bold text-gray-900">
            Create Your Account
          </h1>
          <p className="mb-6 text-sm text-gray-600">
            You've been invited to join <span className="font-semibold text-gray-900">{invitation.shopName}</span>
          </p>

          <form onSubmit={handleSignupAndAccept} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm text-gray-700">Email</label>
              <input
                type="email"
                value={invitation.email}
                disabled
                className="w-full rounded-lg border-2 border-gray-200 bg-gray-100 px-4 py-2 text-gray-600"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-gray-700">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Enter your name"
                className="w-full rounded-lg border-2 border-gray-200 bg-white px-4 py-2 text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-gray-700">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Choose a password"
                minLength={6}
                className="w-full rounded-lg border-2 border-gray-200 bg-white px-4 py-2 text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              />
            </div>

            {error && (
              <div className="rounded-lg border-2 border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSigningUp}
              className="w-full rounded-lg bg-emerald-500 px-6 py-3 font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
            >
              {isSigningUp ? "Creating Account..." : "Create Account & Join Team"}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-gray-600">
            Already have an account?{" "}
            <button
              onClick={() => router.push(`/auth/login?callbackUrl=${encodeURIComponent(`/invitations/accept?token=${token}`)}`)}
              className="text-emerald-600 hover:underline"
            >
              Sign in
            </button>
          </p>
        </div>
      </div>
    );
  }

  // Show accepting state
  if (status === "authenticated" && acceptMutation.isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="text-gray-600">Accepting invitation...</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-white p-6">
      <div className="max-w-md rounded-lg border-2 border-gray-200 bg-gray-50 p-8">
        <h1 className="mb-6 text-2xl font-bold text-gray-900">
          Team Invitation
        </h1>

        <div className="mb-6 space-y-3">
          <div>
            <p className="text-sm text-gray-600">You've been invited to join</p>
            <p className="text-xl font-semibold text-gray-900">
              {invitation.shopName}
            </p>
          </div>

          <div>
            <p className="text-sm text-gray-600">Invited by</p>
            <p className="text-gray-900">{invitation.inviterName}</p>
          </div>

          <div>
            <p className="text-sm text-gray-600">Your role</p>
            <span
              className={`inline-block rounded-full px-3 py-1 text-sm font-semibold ${
                invitation.role === "ACCOUNTANT"
                  ? "bg-blue-100 text-blue-700"
                  : "bg-emerald-100 text-emerald-700"
              }`}
            >
              {invitation.role}
            </span>
          </div>

          <div>
            <p className="text-sm text-gray-600">Expires</p>
            <p className="text-gray-900">
              {new Date(invitation.expiresAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border-2 border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleAccept}
            disabled={acceptMutation.isPending}
            className="flex-1 rounded-lg bg-emerald-500 px-6 py-3 font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
          >
            {acceptMutation.isPending ? "Accepting..." : "Accept Invitation"}
          </button>
          <button
            onClick={() => router.push("/")}
            className="rounded-lg border-2 border-gray-200 px-6 py-3 font-semibold text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
