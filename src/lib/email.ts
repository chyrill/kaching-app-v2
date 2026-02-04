/**
 * Email Sending Utility
 * 
 * MVP: Console logs email content for testing
 * Production: Replace with actual email service (Resend, SendGrid, AWS SES)
 */

/**
 * Send password reset email
 * @param email - User's email address
 * @param token - Password reset token
 */
export async function sendPasswordResetEmail(
  email: string,
  token: string,
): Promise<void> {
  const resetLink = `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/auth/reset-password?token=${token}`;

  // MVP: Log to console
  console.log("\n📧 ========== PASSWORD RESET EMAIL ==========");
  console.log(`To: ${email}`);
  console.log(`Subject: Reset your kaching_v2 password`);
  console.log(`\nReset Link: ${resetLink}`);
  console.log(`\nThis link will expire in 1 hour.`);
  console.log("===========================================\n");

  // TODO: Production implementation
  // Example with Resend:
  // await resend.emails.send({
  //   from: 'noreply@kaching.com',
  //   to: email,
  //   subject: 'Reset your kaching_v2 password',
  //   html: `<p>Click <a href="${resetLink}">here</a> to reset your password.</p>`
  // });
}

/**
 * Send team invitation email
 * @param to - Invitee's email address
 * @param shopName - Name of the shop
 * @param inviterName - Name of the person inviting
 * @param role - Role being assigned (ACCOUNTANT or PACKER)
 * @param token - Invitation token
 */
export interface InvitationEmailParams {
  to: string;
  shopName: string;
  inviterName: string;
  role: string;
  token: string;
}

export async function sendInvitationEmail(
  params: InvitationEmailParams,
): Promise<void> {
  const { to, shopName, inviterName, role, token } = params;

  const inviteUrl = `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/invitations/accept?token=${token}`;

  // MVP: Log to console
  console.log("\n📧 ========== TEAM INVITATION EMAIL ==========");
  console.log(`To: ${to}`);
  console.log(`Subject: You've been invited to join ${shopName}`);
  console.log(`\nHi there!`);
  console.log(
    `\n${inviterName} has invited you to join their shop "${shopName}" as a ${role}.`,
  );
  console.log(`\nClick the link below to accept the invitation:`);
  console.log(inviteUrl);
  console.log(`\nThis invitation will expire in 7 days.`);
  console.log(
    `\nIf you don't have an account, you'll be prompted to create one first.`,
  );
  console.log("===========================================\n");

  // TODO: Production implementation
  // Example with Resend:
  // await resend.emails.send({
  //   from: 'noreply@kaching.com',
  //   to: to,
  //   subject: `You've been invited to join ${shopName}`,
  //   html: `
  //     <h2>Team Invitation</h2>
  //     <p>${inviterName} has invited you to join their shop "${shopName}" as a ${role}.</p>
  //     <p><a href="${inviteUrl}">Accept Invitation</a></p>
  //     <p><small>This invitation expires in 7 days.</small></p>
  //   `
  // });
}

// ========== NOTIFICATION EMAIL SYSTEM (Epic 11) ==========

import { Resend } from 'resend';
import { db } from '~/server/db';
import {
  generateNewOrderEmail,
  generateOrderStatusEmail,
  generateLowStockEmail,
  type NewOrderEmailData,
  type OrderStatusEmailData,
  type LowStockEmailData,
} from './email-templates';

const resend = new Resend(process.env.RESEND_API_KEY);

export type EmailType = 'new_order' | 'order_status' | 'low_stock' | 'out_of_stock' | 'weekly_report';

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  emailType: EmailType;
  userId?: string;
  shopId?: string;
}

export async function sendEmail({ to, subject, html, emailType, userId, shopId }: SendEmailParams) {
  try {
    const { data, error } = await resend.emails.send({
      from: 'Kaching <notifications@kaching.app>',
      to: [to],
      subject,
      html,
    });

    // Log email
    await db.emailLog.create({
      data: {
        userId,
        shopId,
        emailType,
        recipient: to,
        subject,
        status: error ? 'failed' : 'sent',
        errorMessage: error?.message,
      },
    });

    if (error) {
      console.error('Email send error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    console.error('Email send exception:', error);
    
    // Log failed email
    await db.emailLog.create({
      data: {
        userId,
        shopId,
        emailType,
        recipient: to,
        subject,
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      },
    });

    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Check if user has enabled this notification type
export async function shouldSendNotification(
  userId: string,
  shopId: string,
  notificationType: 'emailNewOrders' | 'emailOrderStatusChange' | 'emailLowStock' | 'emailOutOfStock' | 'emailWeeklyReport'
): Promise<boolean> {
  const prefs = await db.notificationPreferences.findFirst({
    where: { userId, shopId },
  });

  // If no preferences set, default to enabled
  if (!prefs) return true;

  return prefs[notificationType] ?? true;
}

// High-level notification functions
export async function sendNewOrderNotification(data: NewOrderEmailData & { userEmail: string; userId: string; shopId: string }) {
  const shouldSend = await shouldSendNotification(data.userId, data.shopId, 'emailNewOrders');
  if (!shouldSend) {
    return { success: true, skipped: true };
  }

  const html = generateNewOrderEmail(data);
  return await sendEmail({
    to: data.userEmail,
    subject: `🎉 New Order #${data.orderNumber} - ${data.shopName}`,
    html,
    emailType: 'new_order',
    userId: data.userId,
    shopId: data.shopId,
  });
}

export async function sendOrderStatusNotification(data: OrderStatusEmailData & { userEmail: string; userId: string; shopId: string }) {
  const shouldSend = await shouldSendNotification(data.userId, data.shopId, 'emailOrderStatusChange');
  if (!shouldSend) {
    return { success: true, skipped: true };
  }

  const html = generateOrderStatusEmail(data);
  return await sendEmail({
    to: data.userEmail,
    subject: `📦 Order #${data.orderNumber} Status Updated - ${data.shopName}`,
    html,
    emailType: 'order_status',
    userId: data.userId,
    shopId: data.shopId,
  });
}

export async function sendLowStockNotification(data: LowStockEmailData & { userEmail: string; userId: string; shopId: string }) {
  const shouldSend = await shouldSendNotification(data.userId, data.shopId, 'emailLowStock');
  if (!shouldSend) {
    return { success: true, skipped: true };
  }

  const html = generateLowStockEmail(data);
  return await sendEmail({
    to: data.userEmail,
    subject: `⚠️ Low Stock Alert - ${data.products.length} Product${data.products.length !== 1 ? 's' : ''} - ${data.shopName}`,
    html,
    emailType: 'low_stock',
    userId: data.userId,
    shopId: data.shopId,
  });
}
