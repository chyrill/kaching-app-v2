import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
  enforceOwner,
} from "~/server/api/trpc";
import type { UserRole } from "../../../../generated/prisma";
import crypto from "crypto";
import { sendInvitationEmail } from "~/lib/email";

export const teamRouter = createTRPCRouter({
  /**
   * Invite a team member to the shop
   * Only OWNER can invite
   */
  inviteTeamMember: protectedProcedure
    .input(
      z.object({
        shopId: z.string(),
        email: z.string().email(),
        role: z.enum(["ACCOUNTANT", "PACKER"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Enforce owner access
      await enforceOwner(ctx, input.shopId);

      // Check if user is already a member
      const existingMember = await ctx.db.shopUser.findFirst({
        where: {
          shopId: input.shopId,
          user: { email: input.email },
        },
      });

      if (existingMember) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "User is already a member",
        });
      }

      // Check for pending invitation
      const pendingInvite = await ctx.db.invitation.findFirst({
        where: {
          shopId: input.shopId,
          email: input.email,
          acceptedAt: null,
          expiresAt: { gt: new Date() },
        },
      });

      if (pendingInvite) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Invitation already sent to this email",
        });
      }

      // Generate secure token
      const token = crypto.randomBytes(32).toString("hex");

      // Create invitation
      const invitation = await ctx.db.invitation.create({
        data: {
          email: input.email,
          shopId: input.shopId,
          role: input.role as UserRole,
          token: token,
          invitedById: ctx.session.user.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
        include: {
          shop: true,
          invitedBy: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      });

      // Send invitation email
      await sendInvitationEmail({
        to: input.email,
        shopName: invitation.shop.name,
        inviterName: invitation.invitedBy.name ?? invitation.invitedBy.email,
        role: input.role,
        token: token,
      });

      return {
        success: true,
        message: "Invitation sent successfully",
        invitation: {
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          expiresAt: invitation.expiresAt,
        },
      };
    }),

  /**
   * Get pending invitations for a shop
   * Only OWNER can view
   */
  getPendingInvitations: protectedProcedure
    .input(z.object({ shopId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Enforce owner access
      await enforceOwner(ctx, input.shopId);

      const invitations = await ctx.db.invitation.findMany({
        where: {
          shopId: input.shopId,
          acceptedAt: null,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: "desc" },
        include: {
          invitedBy: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      });

      return invitations.map((inv) => ({
        id: inv.id,
        email: inv.email,
        role: inv.role,
        invitedBy: inv.invitedBy.name ?? inv.invitedBy.email,
        createdAt: inv.createdAt,
        expiresAt: inv.expiresAt,
      }));
    }),

  /**
   * Resend invitation email
   * Only OWNER can resend
   */
  resendInvitation: protectedProcedure
    .input(
      z.object({
        shopId: z.string(),
        invitationId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Enforce owner access
      await enforceOwner(ctx, input.shopId);

      const invitation = await ctx.db.invitation.findUnique({
        where: { id: input.invitationId },
        include: {
          shop: true,
          invitedBy: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      });

      if (invitation?.shopId !== input.shopId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invitation not found",
        });
      }

      if (invitation.acceptedAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invitation already accepted",
        });
      }

      // Update expiration
      await ctx.db.invitation.update({
        where: { id: input.invitationId },
        data: {
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      // Resend email
      await sendInvitationEmail({
        to: invitation.email,
        shopName: invitation.shop.name,
        inviterName: invitation.invitedBy.name ?? invitation.invitedBy.email,
        role: invitation.role,
        token: invitation.token,
      });

      return {
        success: true,
        message: "Invitation resent successfully",
      };
    }),

  /**
   * Cancel pending invitation
   * Only OWNER can cancel
   */
  cancelInvitation: protectedProcedure
    .input(
      z.object({
        shopId: z.string(),
        invitationId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Enforce owner access
      await enforceOwner(ctx, input.shopId);

      const invitation = await ctx.db.invitation.findUnique({
        where: { id: input.invitationId },
      });

      if (invitation?.shopId !== input.shopId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invitation not found",
        });
      }

      if (invitation.acceptedAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot cancel accepted invitation",
        });
      }

      await ctx.db.invitation.delete({
        where: { id: input.invitationId },
      });

      return {
        success: true,
        message: "Invitation cancelled",
      };
    }),

  /**
   * Get invitation details by token (public - no auth required)
   */
  getInvitationByToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ ctx, input }) => {
      const invitation = await ctx.db.invitation.findUnique({
        where: { token: input.token },
        include: {
          shop: {
            select: {
              id: true,
              name: true,
            },
          },
          invitedBy: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      });

      if (!invitation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invalid invitation",
        });
      }

      if (invitation.acceptedAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invitation already accepted",
        });
      }

      if (invitation.expiresAt < new Date()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invitation expired, request a new one",
        });
      }

      return {
        email: invitation.email,
        role: invitation.role,
        shopId: invitation.shop.id,
        shopName: invitation.shop.name,
        inviterName: invitation.invitedBy.name ?? invitation.invitedBy.email,
        expiresAt: invitation.expiresAt,
      };
    }),

  /**
   * Accept invitation and join shop (requires auth)
   */
  acceptInvitation: protectedProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const invitation = await ctx.db.invitation.findUnique({
        where: { token: input.token },
        include: {
          shop: true,
        },
      });

      if (!invitation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invalid invitation",
        });
      }

      if (invitation.acceptedAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invitation already accepted",
        });
      }

      if (invitation.expiresAt < new Date()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invitation expired, request a new one",
        });
      }

      // Check if user is already a member
      const existingMember = await ctx.db.shopUser.findFirst({
        where: {
          shopId: invitation.shopId,
          userId: ctx.session.user.id,
        },
      });

      if (existingMember) {
        // Mark invitation as accepted
        await ctx.db.invitation.update({
          where: { id: invitation.id },
          data: { acceptedAt: new Date() },
        });

        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You are already a member of this shop",
        });
      }

      // Create ShopUser record
      await ctx.db.shopUser.create({
        data: {
          userId: ctx.session.user.id,
          shopId: invitation.shopId,
          role: invitation.role,
        },
      });

      // Mark invitation as accepted
      await ctx.db.invitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      });

      return {
        success: true,
        message: "Invitation accepted successfully",
        shopId: invitation.shop.id,
        shopName: invitation.shop.name,
      };
    }),

  /**
   * Get team members for a shop
   * Any shop member can view
   */
  getTeamMembers: protectedProcedure
    .input(z.object({ shopId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Verify user is a member of this shop
      const userShopMembership = await ctx.db.shopUser.findFirst({
        where: {
          userId: ctx.session.user.id,
          shopId: input.shopId,
        },
      });

      if (!userShopMembership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not a member of this shop",
        });
      }

      const members = await ctx.db.shopUser.findMany({
        where: { shopId: input.shopId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
      });

      return members.map((member) => ({
        id: member.id,
        userId: member.user.id,
        name: member.user.name,
        email: member.user.email,
        role: member.role,
        joinedAt: member.joinedAt,
        isCurrentUser: member.userId === ctx.session.user.id,
      }));
    }),

  /**
   * Update team member role
   * Only OWNER can update
   */
  updateMemberRole: protectedProcedure
    .input(
      z.object({
        shopId: z.string(),
        memberId: z.string(),
        role: z.enum(["ACCOUNTANT", "PACKER"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Enforce owner access
      await enforceOwner(ctx, input.shopId);

      const member = await ctx.db.shopUser.findUnique({
        where: { id: input.memberId },
      });

      if (member?.shopId !== input.shopId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Team member not found",
        });
      }

      // Prevent owner from changing their own role
      if (member.userId === ctx.session.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot change your own role",
        });
      }

      // Prevent changing OWNER role
      if (member.role === "OWNER") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot change owner role",
        });
      }

      await ctx.db.shopUser.update({
        where: { id: input.memberId },
        data: { role: input.role as UserRole },
      });

      return {
        success: true,
        message: "Role updated successfully",
      };
    }),

  /**
   * Remove team member
   * Only OWNER can remove
   */
  removeMember: protectedProcedure
    .input(
      z.object({
        shopId: z.string(),
        memberId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Enforce owner access
      await enforceOwner(ctx, input.shopId);

      const member = await ctx.db.shopUser.findUnique({
        where: { id: input.memberId },
        include: {
          user: {
            select: {
              email: true,
            },
          },
        },
      });

      if (!member || member.shopId !== input.shopId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Team member not found",
        });
      }

      // Prevent owner from removing themselves
      if (member.userId === ctx.session.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot remove yourself from the shop",
        });
      }

      // Prevent removing OWNER
      if (member.role === "OWNER") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot remove shop owner",
        });
      }

      await ctx.db.shopUser.delete({
        where: { id: input.memberId },
      });

      // TODO: Invalidate user's sessions for this shop
      // TODO: Send email notification to removed user

      return {
        success: true,
        message: "Team member removed successfully",
      };
    }),
});
