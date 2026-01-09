import { z } from "zod";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { TRPCError } from "@trpc/server";

import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { sendPasswordResetEmail } from "~/lib/email";

export const authRouter = createTRPCRouter({
  register: publicProcedure
    .input(
      z
        .object({
          email: z.string().email("Invalid email format"),
          password: z.string().min(8, "Password must be at least 8 characters"),
          confirmPassword: z.string(),
        })
        .refine((data) => data.password === data.confirmPassword, {
          message: "Passwords must match",
          path: ["confirmPassword"],
        }),
    )
    .mutation(async ({ ctx, input }) => {
      // Check if user already exists
      const existingUser = await ctx.db.user.findUnique({
        where: { email: input.email },
      });

      if (existingUser) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Email already registered",
        });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(input.password, 10);

      // Create user
      const user = await ctx.db.user.create({
        data: {
          email: input.email,
          password: hashedPassword,
        },
      });

      return {
        success: true,
        message: "Account created successfully",
        userId: user.id,
      };
    }),

  getCurrentUser: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.db.user.findUnique({
      where: { id: ctx.session.user.id },
      include: {
        shopMemberships: {
          include: {
            shop: true,
          },
        },
      },
    });

    if (!user) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      shops: user.shopMemberships.map((membership) => ({
        shopId: membership.shop.id,
        shopName: membership.shop.name,
        role: membership.role,
      })),
    };
  }),

  requestPasswordReset: publicProcedure
    .input(
      z.object({
        email: z.string().email("Invalid email format"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Check if user exists
      const user = await ctx.db.user.findUnique({
        where: { email: input.email },
      });

      // Always return success message (no user enumeration)
      if (!user) {
        return {
          success: true,
          message: "If account exists, reset email has been sent",
        };
      }

      // Generate secure random token
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Delete any existing reset tokens for this user
      await ctx.db.passwordResetToken.deleteMany({
        where: { userId: user.id },
      });

      // Create new reset token
      await ctx.db.passwordResetToken.create({
        data: {
          userId: user.id,
          token,
          expiresAt,
        },
      });

      // Send reset email
      await sendPasswordResetEmail(user.email, token);

      return {
        success: true,
        message: "If account exists, reset email has been sent",
      };
    }),

  resetPassword: publicProcedure
    .input(
      z.object({
        token: z.string(),
        newPassword: z.string().min(8, "Password must be at least 8 characters"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Find reset token
      const resetToken = await ctx.db.passwordResetToken.findUnique({
        where: { token: input.token },
        include: { user: true },
      });

      if (!resetToken) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid reset link",
        });
      }

      // Check if token is expired
      if (resetToken.expiresAt < new Date()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Reset link expired, request a new one",
        });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(input.newPassword, 10);

      // Update user password
      await ctx.db.user.update({
        where: { id: resetToken.userId },
        data: { password: hashedPassword },
      });

      // Delete used reset token
      await ctx.db.passwordResetToken.delete({
        where: { id: resetToken.id },
      });

      // Invalidate all sessions for this user (database sessions only)
      // Note: With JWT strategy (current), sessions cannot be invalidated server-side
      // JWT tokens remain valid until expiry across all devices
      // Current browser will be logged out via redirect, but other devices stay logged in
      // Future enhancement: Add User.sessionVersion field and check in JWT callback
      await ctx.db.session.deleteMany({
        where: { userId: resetToken.userId },
      });

      return {
        success: true,
        message: "Password reset successfully",
      };
    }),
});
