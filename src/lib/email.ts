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
