"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { api } from "~/trpc/react";
import { useParams, useRouter } from "next/navigation";
import DashboardNav from "~/components/DashboardNav";

export default function TeamManagementPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      router.push(`/auth/login?callbackUrl=${encodeURIComponent(typeof window !== 'undefined' ? window.location.pathname : '')}`);
    },
  });
  
  // Safely extract shopId - handle both string and string[] from params
  const rawShopId = params.shopId;
  const shopId = typeof rawShopId === 'string' ? rawShopId : Array.isArray(rawShopId) ? rawShopId[0] : undefined;

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"ACCOUNTANT" | "PACKER">("ACCOUNTANT");
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Wait for client-side mount
  useEffect(() => {
    setMounted(true);
  }, []);

  // Check if user is owner
  const { data: userShops, isLoading: isLoadingShops } = api.shop.getUserShops.useQuery(
    undefined,
    { enabled: mounted }
  );
  const currentShop = userShops?.find((s) => s.shopId === shopId);
  const isOwner = currentShop?.role === "OWNER";

  // Fetch pending invitations - only when shopId exists and user is owner
  const {
    data: invitations,
    refetch: refetchInvitations,
    isLoading: isLoadingInvitations,
  } = api.team.getPendingInvitations.useQuery(
    { shopId: shopId! },
    { enabled: mounted && !!shopId && !!isOwner },
  );

  // Fetch team members - only when shopId exists
  const {
    data: teamMembers,
    refetch: refetchTeamMembers,
    isLoading: isLoadingTeamMembers,
  } = api.team.getTeamMembers.useQuery(
    { shopId: shopId! },
    { enabled: mounted && !!shopId },
  );

  // Invite mutation
  const inviteMutation = api.team.inviteTeamMember.useMutation({
    onSuccess: () => {
      setEmail("");
      setError("");
      void refetchInvitations();
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  // Resend mutation
  const resendMutation = api.team.resendInvitation.useMutation({
    onSuccess: () => {
      void refetchInvitations();
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  // Cancel mutation
  const cancelMutation = api.team.cancelInvitation.useMutation({
    onSuccess: () => {
      void refetchInvitations();
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  // Update role mutation
  const updateRoleMutation = api.team.updateMemberRole.useMutation({
    onSuccess: () => {
      void refetchTeamMembers();
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  // Remove member mutation
  const removeMemberMutation = api.team.removeMember.useMutation({
    onSuccess: () => {
      void refetchTeamMembers();
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email) {
      setError("Email is required");
      return;
    }

    if (!shopId) {
      setError("Shop ID is missing");
      return;
    }

    inviteMutation.mutate({
      shopId,
      email,
      role,
    });
  };

  const handleResend = (invitationId: string) => {
    resendMutation.mutate({
      shopId,
      invitationId,
    });
  };

  const handleCancel = (invitationId: string) => {
    if (
      window.confirm(
        "Are you sure you want to cancel this invitation? This action cannot be undone.",
      )
    ) {
      cancelMutation.mutate({
        shopId,
        invitationId,
      });
    }
  };

  const handleRoleChange = (memberId: string, newRole: "ACCOUNTANT" | "PACKER") => {
    updateRoleMutation.mutate({
      shopId,
      memberId,
      role: newRole,
    });
  };

  const handleRemoveMember = (memberId: string, memberName: string) => {
    if (
      window.confirm(
        `Are you sure you want to remove ${memberName} from this shop? They will lose access immediately.`,
      )
    ) {
      removeMemberMutation.mutate({
        shopId,
        memberId,
      });
    }
  };

  // Show loading while checking auth, user shops, or shopId
  if (status === "loading" || isLoadingShops || !shopId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  // User no longer has access to this shop
  if (!currentShop) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white p-6">
        <div className="max-w-md rounded-lg border-2 border-gray-200 bg-gray-50 p-8 text-center">
          <h1 className="mb-4 text-2xl font-bold text-gray-900">
            Access Removed
          </h1>
          <p className="mb-6 text-gray-600">
            You no longer have access to this shop. You may have been removed by the owner.
          </p>
          {userShops && userShops.length > 0 ? (
            <button
              onClick={() => router.push(`/${userShops[0]!.shopId}/dashboard`)}
              className="w-full rounded-lg bg-emerald-500 px-6 py-3 font-semibold text-white hover:bg-emerald-600"
            >
              Go to {userShops[0]!.name}
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

  // Check if user is owner (after confirming authentication and access)
  if (!isOwner) {
    return (
      <div className="flex min-h-screen bg-white">
        <DashboardNav
          shopId={shopId}
          currentShop={currentShop}
          userEmail={session?.user.email}
          onSignOut={() => setShowLogoutModal(true)}
        />
        <main className="flex-1 p-6">
          <h1 className="mb-6 text-3xl font-bold text-gray-900">
            Team Management
          </h1>
          <div className="rounded-lg border-2 border-gray-200 bg-gray-50 p-6 text-center">
            <p className="text-gray-600">
              You must be a shop owner to manage team members.
            </p>
          </div>
        </main>
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
      <main className="flex-1 p-6">
        <div className="mx-auto max-w-4xl">
          <h1 className="mb-6 text-3xl font-bold text-gray-900">Team Management</h1>

        {/* Invite Form */}
        <div className="mb-8 rounded-lg border-2 border-gray-200 bg-gray-50 p-6">
          <h2 className="mb-4 text-xl font-semibold text-gray-900">
            Invite Team Member
          </h2>
          <form onSubmit={handleInvite} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                Email Address
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border-2 border-gray-200 bg-white px-4 py-2 text-gray-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                placeholder="colleague@example.com"
                disabled={inviteMutation.isPending}
              />
            </div>

            <div>
              <label
                htmlFor="role"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                Role
              </label>
              <select
                id="role"
                value={role}
                onChange={(e) =>
                  setRole(e.target.value as "ACCOUNTANT" | "PACKER")
                }
                className="w-full rounded-lg border-2 border-gray-200 bg-white px-4 py-2 text-gray-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                disabled={inviteMutation.isPending}
              >
                <option value="ACCOUNTANT">Accountant</option>
                <option value="PACKER">Packer</option>
              </select>
              <p className="mt-1 text-sm text-gray-500">
                Accountants can manage receipts and expenses. Packers can manage
                inventory.
              </p>
            </div>

            {error && (
              <div className="rounded-lg border-2 border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={inviteMutation.isPending}
              className="w-full rounded-lg bg-emerald-500 px-4 py-2 font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
            >
              {inviteMutation.isPending ? "Sending..." : "Send Invitation"}
            </button>
          </form>
        </div>

        {/* Pending Invitations */}
        <div className="mb-8 rounded-lg border-2 border-gray-200 bg-gray-50 p-6">
          <h2 className="mb-4 text-xl font-semibold text-gray-900">
            Pending Invitations
          </h2>

          {isLoadingInvitations ? (
            <div className="text-center text-gray-500">
              Loading invitations...
            </div>
          ) : !invitations || invitations.length === 0 ? (
            <div className="text-center text-gray-500">
              No pending invitations
            </div>
          ) : (
            <div className="space-y-3">
              {invitations.map((invitation) => (
                <div
                  key={invitation.id}
                  className="flex items-center justify-between rounded-lg border-2 border-gray-200 bg-white p-4"
                >
                  <div className="flex-1">
                    <div className="text-gray-900">{invitation.email}</div>
                    <div className="mt-1 flex items-center gap-3 text-sm text-gray-600">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          invitation.role === "ACCOUNTANT"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {invitation.role}
                      </span>
                      <span>
                        Invited by {invitation.invitedBy} •{" "}
                        {new Date(invitation.createdAt).toLocaleDateString()}
                      </span>
                      <span>
                        Expires{" "}
                        {new Date(invitation.expiresAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleResend(invitation.id)}
                      disabled={resendMutation.isPending}
                      className="rounded-lg border-2 border-gray-200 px-3 py-1 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Resend
                    </button>
                    <button
                      onClick={() => handleCancel(invitation.id)}
                      disabled={cancelMutation.isPending}
                      className="rounded-lg border-2 border-red-200 px-3 py-1 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Team Members */}
        <div className="rounded-lg border-2 border-gray-200 bg-gray-50 p-6">
          <h2 className="mb-4 text-xl font-semibold text-gray-900">
            Team Members
          </h2>

          {isLoadingTeamMembers ? (
            <div className="text-center text-gray-500">
              Loading team members...
            </div>
          ) : !teamMembers || teamMembers.length === 0 ? (
            <div className="text-center text-gray-500">No team members</div>
          ) : (
            <div className="space-y-3">
              {teamMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between rounded-lg border-2 border-gray-200 bg-white p-4"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-900">
                        {member.name ?? member.email}
                      </span>
                      {member.role === "OWNER" && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                          OWNER
                        </span>
                      )}
                      {member.isCurrentUser && (
                        <span className="text-xs text-gray-500">(You)</span>
                      )}
                    </div>
                    <div className="mt-1 text-sm text-gray-600">
                      {member.email} •{" "}
                      Joined {new Date(member.joinedAt).toLocaleDateString()}
                    </div>
                  </div>

                  {isOwner && !member.isCurrentUser && member.role !== "OWNER" && (
                    <div className="flex gap-2">
                      <select
                        value={member.role}
                        onChange={(e) =>
                          handleRoleChange(
                            member.id,
                            e.target.value as "ACCOUNTANT" | "PACKER",
                          )
                        }
                        disabled={updateRoleMutation.isPending}
                        className="rounded-lg border-2 border-gray-200 bg-white px-3 py-1 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        <option value="ACCOUNTANT">Accountant</option>
                        <option value="PACKER">Packer</option>
                      </select>
                      <button
                        onClick={() =>
                          handleRemoveMember(
                            member.id,
                            member.name ?? member.email,
                          )
                        }
                        disabled={removeMemberMutation.isPending}
                        className="rounded-lg border-2 border-red-200 px-3 py-1 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                  )}

                  {(!isOwner || member.isCurrentUser || member.role === "OWNER") && (
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        member.role === "ACCOUNTANT"
                          ? "bg-blue-100 text-blue-700"
                          : member.role === "PACKER"
                            ? "bg-orange-100 text-orange-700"
                            : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {member.role}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
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
