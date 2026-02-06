import sgMail from '@sendgrid/mail';
import dotenv from 'dotenv';

// Load environment variables
const envFiles = ['.env.local', '.env'];
for (const envFile of envFiles) {
  const result = dotenv.config({ path: envFile, override: true });
  if (result.error && (result.error as NodeJS.ErrnoException).code !== 'ENOENT') {
    console.warn(`Failed to load environment variables from ${envFile}:`, result.error);
  }
}

// Initialize SendGrid
const sendGridApiKey = (process.env.SENDGRID_API_KEY || '').trim();
if (sendGridApiKey) {
  sgMail.setApiKey(sendGridApiKey);
} else {
  console.warn('SENDGRID_API_KEY not found in environment variables. Email sending will be disabled.');
}

// Default sender email (can be overridden)
const defaultFromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@rppcentral.com';

interface EmailResult {
  success: boolean;
  error?: string;
  /** SendGrid message ID (for correlating bounce/block webhook events) */
  messageId?: string;
}

/**
 * Base function to send emails via SendGrid
 */
async function sendEmail(
  to: string,
  subject: string,
  htmlContent: string,
  textContent?: string
): Promise<EmailResult> {
  if (!sendGridApiKey) {
    console.warn('SendGrid API key not configured. Email not sent to:', to);
    return { success: false, error: 'Email service not configured' };
  }

  try {
    const msg = {
      to,
      from: defaultFromEmail,
      subject,
      text: textContent || htmlContent.replace(/<[^>]*>/g, ''), // Strip HTML for text version
      html: htmlContent,
    };

    const response = await sgMail.send(msg);
    // SendGrid returns [HttpResponse]; capture x-message-id for webhook correlation
    const raw = Array.isArray(response) ? response[0] : response;
    const headers = (raw as any)?.headers || {};
    const messageId = headers['x-message-id'] ?? headers['X-Message-Id'];
    const messageIdStr = typeof messageId === 'string' ? messageId.trim() : undefined;
    console.log(`Email sent successfully to ${to}`);
    return { success: true, messageId: messageIdStr };
  } catch (error: any) {
    console.error('Error sending email:', error);
    if (error.response) {
      console.error('SendGrid error details:', error.response.body);
    }
    return {
      success: false,
      error: error.message || 'Failed to send email',
    };
  }
}

/**
 * Send team member invitation email
 */
export async function sendTeamInviteEmail(
  recipientEmail: string,
  inviterName: string,
  inviterEmail: string,
  role: string,
  inviteLink: string
): Promise<EmailResult> {
  const roleDisplay = role === 'admin' ? 'Administrator' : 'Photographer';
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Team Invitation</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #f8f9fa; padding: 30px; border-radius: 8px;">
        <h1 style="color: #2563eb; margin-top: 0;">You've been invited to join a team!</h1>
        
        <p>Hello,</p>
        
        <p><strong>${inviterName}</strong> (${inviterEmail}) has invited you to join their team as a <strong>${roleDisplay}</strong> on RPP Central.</p>
        
        <div style="background-color: #ffffff; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #2563eb;">
          <p style="margin: 0 0 15px 0;"><strong>Your Role:</strong> ${roleDisplay}</p>
          <p style="margin: 0;"><strong>What this means:</strong> You'll be able to ${role === 'admin' ? 'manage team members, customers, and jobs' : 'view and work on assigned photography jobs'}.</p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${inviteLink}" 
             style="background-color: #2563eb; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
            Accept Invitation & Sign Up
          </a>
        </div>
        
        <p style="color: #666; font-size: 14px; margin-top: 30px;">
          Or copy and paste this link into your browser:<br>
          <a href="${inviteLink}" style="color: #2563eb; word-break: break-all;">${inviteLink}</a>
        </p>
        
        <p style="color: #999; font-size: 12px; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
          This invitation link will expire after 30 days. If you didn't expect this invitation, you can safely ignore this email.
        </p>
      </div>
    </body>
    </html>
  `;

  const textContent = `
You've been invited to join a team!

${inviterName} (${inviterEmail}) has invited you to join their team as a ${roleDisplay} on RPP Central.

Your Role: ${roleDisplay}
What this means: You'll be able to ${role === 'admin' ? 'manage team members, customers, and jobs' : 'view and work on assigned photography jobs'}.

Accept your invitation by visiting:
${inviteLink}

This invitation link will expire after 30 days. If you didn't expect this invitation, you can safely ignore this email.
  `;

  return sendEmail(
    recipientEmail,
    `You've been invited to join ${inviterName}'s team`,
    htmlContent,
    textContent
  );
}

/**
 * Send delivery email with download link
 */
export async function sendDeliveryEmail(
  recipientEmail: string,
  recipientName: string,
  subject: string,
  message: string,
  deliveryLink: string
): Promise<EmailResult> {
  // RPP brand: orange #F05A2A, greys, system font stack (match app index.css)
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1F2937; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #F3F4F6;">
      <div style="background-color: #ffffff; padding: 32px; border-radius: 16px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.06);">
        <h1 style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #F05A2A; margin-top: 0; font-size: 1.5rem; font-weight: 600; line-height: 1.4;">${subject}</h1>
        
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; white-space: pre-wrap; margin: 24px 0; color: #3F474F; font-size: 16px;">${message.replace(/\n/g, '<br>')}</div>
        
        <div style="text-align: center; margin: 32px 0;">
          <a href="${deliveryLink}" 
             style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #F05A2A; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 12px; display: inline-block; font-weight: 600; font-size: 15px; box-shadow: 0 2px 4px rgba(240, 90, 42, 0.2);">
            View & Download Your Photos
          </a>
        </div>
        
        <p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #6B7280; font-size: 14px; margin-top: 28px;">
          Or copy and paste this link into your browser:<br>
          <a href="${deliveryLink}" style="color: #F05A2A; word-break: break-all; text-decoration: underline;">${deliveryLink}</a>
        </p>
        
        <p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #9CA3AF; font-size: 13px; margin-top: 28px; border-top: 1px solid #E5E7EB; padding-top: 20px;">
          This link will be available for 30 days. If you have any questions or need revisions, please don't hesitate to reach out.
        </p>
      </div>
    </body>
    </html>
  `;

  const textContent = `
${subject}

${message}

View and download your photos:
${deliveryLink}

This link will be available for 30 days. If you have any questions or need revisions, please don't hesitate to reach out.
  `;

  return sendEmail(recipientEmail, subject, htmlContent, textContent);
}

/**
 * Send partnership invitation email
 */
export async function sendPartnershipInviteEmail(
  editorEmail: string,
  editorStudioName: string,
  partnerName: string,
  partnerEmail: string,
  inviteLink?: string
): Promise<EmailResult> {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Partnership Invitation</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #f8f9fa; padding: 30px; border-radius: 8px;">
        <h1 style="color: #2563eb; margin-top: 0;">Partnership Invitation</h1>
        
        <p>Hello ${editorStudioName},</p>
        
        <p><strong>${partnerName}</strong> (${partnerEmail}) has invited you to partner with them on RPP Central.</p>
        
        <div style="background-color: #ffffff; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #2563eb;">
          <p style="margin: 0 0 10px 0;"><strong>What this means:</strong></p>
          <ul style="margin: 0; padding-left: 20px;">
            <li>You'll receive photo editing jobs from ${partnerName}</li>
            <li>You can accept or decline jobs as they come in</li>
            <li>You'll be able to communicate directly with ${partnerName} about projects</li>
            <li>You'll have access to all files and project details</li>
          </ul>
        </div>
        
        ${inviteLink ? `
        <div style="text-align: center; margin: 30px 0;">
          <a href="${inviteLink}" 
             style="background-color: #2563eb; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
            Accept Partnership Invitation
          </a>
        </div>
        
        <p style="color: #666; font-size: 14px; margin-top: 30px;">
          Or copy and paste this link into your browser:<br>
          <a href="${inviteLink}" style="color: #2563eb; word-break: break-all;">${inviteLink}</a>
        </p>
        ` : `
        <p style="color: #666; font-size: 14px; margin-top: 30px;">
          Please log in to your RPP Central editor account to accept this partnership invitation.
        </p>
        `}
        
        <p style="color: #999; font-size: 12px; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
          If you didn't expect this invitation, you can safely ignore this email.
        </p>
      </div>
    </body>
    </html>
  `;

  const textContent = `
Partnership Invitation

Hello ${editorStudioName},

${partnerName} (${partnerEmail}) has invited you to partner with them on RPP Central.

What this means:
- You'll receive photo editing jobs from ${partnerName}
- You can accept or decline jobs as they come in
- You'll be able to communicate directly with ${partnerName} about projects
- You'll have access to all files and project details

${inviteLink ? `Accept your invitation by visiting:\n${inviteLink}` : 'Please log in to your RPP Central editor account to accept this partnership invitation.'}

If you didn't expect this invitation, you can safely ignore this email.
  `;

  return sendEmail(
    editorEmail,
    `Partnership Invitation from ${partnerName}`,
    htmlContent,
    textContent
  );
}

/**
 * Send revision request notification email to editor
 */
export async function sendRevisionRequestEmail(
  editorEmail: string,
  editorName: string,
  orderNumber: string,
  revisionNotes: string,
  customerName: string,
  jobAddress: string,
  services: string[],
  dashboardLink: string
): Promise<EmailResult> {
  const servicesHtml = services.map(s => `<li>${s}</li>`).join('');
  const servicesList = services.join(', ');
  
  // Format revision notes with proper line breaks
  const formattedNotes = revisionNotes.replace(/\n/g, '<br>');
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Revision Requested for Order #${orderNumber}</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #f8f9fa; padding: 30px; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <div style="background-color: #f97316; color: #ffffff; padding: 8px 16px; border-radius: 6px; display: inline-block; font-weight: bold;">
            Revision Requested
          </div>
        </div>
        
        <h1 style="color: #1a1a1a; margin-top: 0; text-align: center;">Order #${orderNumber}</h1>
        
        <p style="margin-bottom: 20px;">Hello ${editorName},</p>
        
        <p>A revision has been requested for one of your orders. Please review the details below and make the necessary adjustments.</p>
        
        <div style="background-color: #ffffff; padding: 20px; border-radius: 6px; margin: 20px 0; border: 1px solid #e5e7eb;">
          <h3 style="margin-top: 0; color: #374151;">Order Information</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">Order Number:</td>
              <td style="padding: 8px 0; font-weight: bold;">#${orderNumber}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">Customer:</td>
              <td style="padding: 8px 0;">${customerName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">Job Address:</td>
              <td style="padding: 8px 0;">${jobAddress}</td>
            </tr>
          </table>
        </div>
        
        <div style="background-color: #fff7ed; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #f97316;">
          <h3 style="margin-top: 0; color: #c2410c;">Revision Details</h3>
          
          <div style="margin-bottom: 15px;">
            <strong style="color: #374151;">Services Requiring Revision:</strong>
            <ul style="margin: 10px 0; padding-left: 20px;">
              ${servicesHtml}
            </ul>
          </div>
          
          <div>
            <strong style="color: #374151;">Revision Notes:</strong>
            <div style="margin-top: 10px; padding: 15px; background-color: #ffffff; border-radius: 4px; white-space: pre-wrap;">
              ${formattedNotes}
            </div>
          </div>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${dashboardLink}" 
             style="background-color: #f97316; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
            View Order in Dashboard
          </a>
        </div>
        
        <p style="color: #666; font-size: 14px; margin-top: 30px;">
          Or copy and paste this link into your browser:<br>
          <a href="${dashboardLink}" style="color: #f97316; word-break: break-all;">${dashboardLink}</a>
        </p>
        
        <p style="color: #999; font-size: 12px; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
          This order is now in "In Revision" status and will appear in your dashboard. Please address the revision request as soon as possible.
        </p>
      </div>
    </body>
    </html>
  `;

  const textContent = `
Revision Requested for Order #${orderNumber}

Hello ${editorName},

A revision has been requested for one of your orders. Please review the details below and make the necessary adjustments.

ORDER INFORMATION
-----------------
Order Number: #${orderNumber}
Customer: ${customerName}
Job Address: ${jobAddress}

REVISION DETAILS
----------------
Services Requiring Revision: ${servicesList}

Revision Notes:
${revisionNotes}

View your order in the dashboard:
${dashboardLink}

This order is now in "In Revision" status and will appear in your dashboard. Please address the revision request as soon as possible.
  `;

  return sendEmail(
    editorEmail,
    `Revision Requested for Order #${orderNumber}`,
    htmlContent,
    textContent
  );
}

