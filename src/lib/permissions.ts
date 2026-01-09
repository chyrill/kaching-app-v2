import type { UserRole } from "../../generated/prisma";

/**
 * Role-based permissions configuration
 * Defines what actions each role can perform
 */
export const ROLE_PERMISSIONS = {
  OWNER: {
    canManageTeam: true,
    canManageShop: true,
    canAccessFinancials: true,
    canAccessInventory: true,
    canCreateReceipts: true,
    canCreateExpenses: true,
  },
  ACCOUNTANT: {
    canManageTeam: false,
    canManageShop: false,
    canAccessFinancials: true,
    canAccessInventory: false,
    canCreateReceipts: true,
    canCreateExpenses: true,
  },
  PACKER: {
    canManageTeam: false,
    canManageShop: false,
    canAccessFinancials: false,
    canAccessInventory: true,
    canCreateReceipts: false,
    canCreateExpenses: false,
  },
  ADMIN: {
    canManageTeam: false,
    canManageShop: false,
    canAccessFinancials: false,
    canAccessInventory: false,
    canCreateReceipts: false,
    canCreateExpenses: false,
    isSystemAdmin: true,
  },
} as const;

/**
 * Check if a role has a specific permission
 */
export function hasPermission(
  role: UserRole,
  permission: keyof typeof ROLE_PERMISSIONS.OWNER,
): boolean {
  const rolePerms = ROLE_PERMISSIONS[role];
  return (rolePerms[permission]) ?? false;
}

/**
 * Role descriptions for UI display
 */
export const ROLE_DESCRIPTIONS = {
  OWNER: "Full access to all shop features and settings",
  ACCOUNTANT: "Can manage receipts, expenses, and view financial reports",
  PACKER: "Can view and manage inventory only",
  ADMIN: "System administrator with cross-shop access",
} as const;

/**
 * Role display names
 */
export const ROLE_NAMES = {
  OWNER: "Owner",
  ACCOUNTANT: "Accountant",
  PACKER: "Packer",
  ADMIN: "Admin",
} as const;
