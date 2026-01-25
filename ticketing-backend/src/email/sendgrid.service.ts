import { Injectable } from '@nestjs/common';
import sgMail from '@sendgrid/mail';
import PDFDocument from 'pdfkit';
import { AppLogger } from '../common/utils/logger';
import { generateReceiptHTML } from './receipt-generator';

@Injectable()
export class SendGridService {
  private readonly logger = new AppLogger();
  private isConfigured = false;

  constructor() {
    this.initializeSendGrid();
  }

  private initializeSendGrid() {
    const apiKey = process.env.SENDGRID_API_KEY;
    const fromEmail = process.env.SENDGRID_FROM_EMAIL;

    if (!apiKey || !fromEmail) {
      this.logger.warn(
        'SendGrid not configured - email sending disabled',
        SendGridService.name,
        { hasApiKey: !!apiKey, hasEmail: !!fromEmail },
      );
      this.isConfigured = false;
      return;
    }

    sgMail.setApiKey(apiKey);
    this.isConfigured = true;
    this.logger.log('SendGrid initialized successfully', SendGridService.name, {
      fromEmail,
    });
  }

  /**
   * Generate PDF from structured ticket data using PDFKit
   * Returns Buffer or null if generation fails
   */
  async generatePdfFromData(ticketData: {
    ticketNumber: string;
    eventName: string;
    customerName: string;
    amount: number;
    purchaseDate: string;
  }): Promise<Buffer | null> {
    try {
      this.logger.log('Generating PDF with PDFKit', SendGridService.name);

      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
      });

      // Header
      doc
        .fontSize(20)
        .font('Helvetica-Bold')
        .text('TICKET RECEIPT', { align: 'center' })
        .fontSize(11)
        .font('Helvetica')
        .text('Your booking is confirmed', { align: 'center' })
        .moveDown(0.5);

      // Orange divider line
      doc
        .strokeColor(217, 119, 6)
        .moveTo(40, doc.y)
        .lineTo(555, doc.y)
        .stroke()
        .moveDown(1);

      // Customer greeting
      doc
        .fontSize(11)
        .font('Helvetica')
        .fillColor(0, 0, 0)
        .text(`Thank you, ${ticketData.customerName}!`, { align: 'left' })
        .moveDown(0.5);

      // Event Section
      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .fillColor(184, 83, 9)
        .text('EVENT DETAILS', { underline: true })
        .moveDown(0.3);

      doc
        .fontSize(10)
        .font('Helvetica')
        .fillColor(0, 0, 0)
        .text(`Event: ${ticketData.eventName}`)
        .text(`Ticket Number: ${ticketData.ticketNumber}`)
        .text(`Purchase Date: ${ticketData.purchaseDate}`)
        .moveDown(0.5);

      // Price Section
      doc
        .fontSize(10)
        .font('Helvetica')
        .text('Total Amount:')
        .moveDown(0.2)
        .fontSize(28)
        .font('Helvetica-Bold')
        .fillColor(217, 119, 6)
        .text(`$${ticketData.amount.toFixed(2)}`)
        .moveDown(0.8);

      // Reset color
      doc.fillColor(0, 0, 0);

      // Gray divider line
      doc
        .strokeColor(229, 231, 235)
        .moveTo(40, doc.y)
        .lineTo(555, doc.y)
        .stroke()
        .moveDown(1);

      // Important Notice
      doc
        .fontSize(10)
        .font('Helvetica')
        .fillColor(22, 101, 52)
        .text(
          'IMPORTANT: This is your official ticket. Please keep it safe and bring it to the event entrance.',
          { align: 'left', width: 515 },
        )
        .moveDown(1);

      // Footer
      doc
        .fillColor(107, 114, 128)
        .fontSize(9)
        .font('Helvetica')
        .text('Golden Moment Events', { align: 'center' })
        .text('Thank you for your purchase!', { align: 'center' })
        .moveDown(0.3)
        .fontSize(8)
        .fillColor(156, 163, 175)
        .text(`Generated: ${new Date().toLocaleDateString()}`, { align: 'center' });

      // Convert stream to buffer
      const chunks: Buffer[] = [];
      return new Promise((resolve, reject) => {
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', (err) => {
          this.logger.error('PDF generation failed', SendGridService.name, {
            error: err.message,
          });
          reject(err);
        });
        doc.end();
      });
    } catch (error: any) {
      this.logger.warn('PDF generation error', SendGridService.name, {
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Legacy method - generate PDF from HTML (kept for backwards compatibility)
   * Returns Buffer or null if generation fails
   */
  async generatePdfFromHtml(htmlContent: string): Promise<Buffer | null> {
    try {
      this.logger.log('Generating PDF with PDFKit', SendGridService.name);

      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
      });

      // Extract key information from HTML

      const ticketMatch = htmlContent.match(/Ticket Number[^<]*<[^>]*>([^<]+)</i);
      const ticketNumber = ticketMatch ? ticketMatch[1].trim() : 'N/A';

      const eventMatch = htmlContent.match(/Event[^<]*<[^>]*>([^<]+)</i);
      const eventName = eventMatch ? eventMatch[1].trim() : 'Event';

      const customerMatch = htmlContent.match(/Thank you[,\s]+([^<]+[a-zA-Z])/i);
      const customerName = customerMatch ? customerMatch[1].trim() : 'Valued Customer';

      const amountMatch = htmlContent.match(/Total\s+(?:Amount|Paid)[^<]*<[^>]*>([^<]+)</i);
      const amount = amountMatch ? amountMatch[1].trim() : '$0.00';

      const dateMatch = htmlContent.match(/Purchase Date[^<]*<[^>]*>([^<]+)</i);
      const purchaseDate = dateMatch ? dateMatch[1].trim() : new Date().toLocaleDateString();

      // Header
      doc
        .fontSize(20)
        .font('Helvetica-Bold')
        .text('TICKET RECEIPT', { align: 'center' })
        .fontSize(11)
        .font('Helvetica')
        .text('Your booking is confirmed', { align: 'center' })
        .moveDown(0.5);

      // Orange divider line
      doc
        .strokeColor(217, 119, 6)
        .moveTo(40, doc.y)
        .lineTo(555, doc.y)
        .stroke()
        .moveDown(1);

      // Event Section
      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .fillColor(184, 83, 9)
        .text('EVENT DETAILS', { underline: true })
        .moveDown(0.3);

      doc
        .fontSize(10)
        .font('Helvetica')
        .fillColor(0, 0, 0)
        .text(`Event: ${eventName}`, { indent: 10 })
        .text(`Ticket Number: ${ticketNumber}`, { indent: 10 })
        .text(`Purchase Date: ${purchaseDate}`, { indent: 10 })
        .moveDown(0.5);

      // Price Section
      doc
        .fontSize(10)
        .font('Helvetica')
        .text('Total Amount:', { indent: 10 })
        .moveDown(0.2)
        .fontSize(24)
        .font('Helvetica-Bold')
        .fillColor(217, 119, 6)
        .text(amount, { indent: 20 })
        .moveDown(0.8);

      // Reset color
      doc.fillColor(0, 0, 0);

      // Gray divider line
      doc
        .strokeColor(229, 231, 235)
        .moveTo(40, doc.y)
        .lineTo(555, doc.y)
        .stroke()
        .moveDown(1);

      // Important Notice
      doc
        .fontSize(10)
        .font('Helvetica')
        .fillColor(22, 101, 52)
        .text(
          'IMPORTANT: This is your official ticket. Please keep it safe and bring it to the event entrance.',
          { align: 'left', width: 515 },
        )
        .moveDown(1);

      // Footer
      doc
        .fillColor(107, 114, 128)
        .fontSize(9)
        .font('Helvetica')
        .text('Golden Moment Events', { align: 'center' })
        .text('Thank you for your purchase!', { align: 'center' })
        .moveDown(0.3)
        .fontSize(8)
        .fillColor(156, 163, 175)
        .text(`Generated: ${new Date().toLocaleDateString()}`, { align: 'center' });

      // Convert stream to buffer
      const chunks: Buffer[] = [];
      return new Promise((resolve, reject) => {
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', (err) => {
          this.logger.error('PDF generation failed', SendGridService.name, {
            error: err.message,
          });
          reject(err);
        });
        doc.end();
      });
    } catch (error: any) {
      this.logger.warn('PDF generation error', SendGridService.name, {
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Simple HTML to text extraction
   */
  private extractTextFromHtml(html: string): string {
    // Remove script and style tags
    let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
    // Remove HTML tags
    text = text.replace(/<[^>]*>/g, '');
    // Decode HTML entities
    text = text
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
    return text;
  }

  /**
   * Send verification email via SendGrid
   */
  async sendVerificationEmail(
    email: string,
    token: string,
    frontendUrl?: string,
  ): Promise<{ success: boolean; message: string }> {
    if (!this.isConfigured) {
      this.logger.warn(
        'SendGrid not configured - skipping email send',
        SendGridService.name,
        { email },
      );
      return {
        success: false,
        message: 'Email service not configured',
      };
    }

    try {
      const verificationUrl = `${frontendUrl || process.env.FRONTEND_URL}/auth/verify-email?token=${token}`;

      const msg = {
        to: email,
        from: `${process.env.SENDGRID_FROM_NAME || 'Golden Moment'} <${process.env.SENDGRID_FROM_EMAIL}>`,
        subject: '✨ Verify Your Golden Moment Account',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
              .button { display: inline-block; padding: 15px 30px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
              .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🎉 Welcome to Golden Moment!</h1>
              </div>
              <div class="content">
                <p>Hi there,</p>
                <p>Thank you for signing up! We're excited to have you join our community of event enthusiasts.</p>
                <p>To get started, please verify your email address by clicking the button below:</p>
                <div style="text-align: center;">
                  <a href="${verificationUrl}" class="button">Verify Email Address</a>
                </div>
                <p>Or copy and paste this link into your browser:</p>
                <p style="word-break: break-all; color: #f59e0b;">${verificationUrl}</p>
                <p><strong>This link will expire in 24 hours.</strong></p>
                <p>If you didn't create an account with Golden Moment, please ignore this email.</p>
              </div>
              <div class="footer">
                <p>Golden Moment Events © 2026</p>
                <p>Tunis, Tunisia</p>
              </div>
            </div>
          </body>
          </html>
        `,
      };

      await sgMail.send(msg as any);

      this.logger.log('Verification email sent successfully', SendGridService.name, {
        email,
      });

      return {
        success: true,
        message: `Verification email sent to ${email}`,
      };
    } catch (error: any) {
      this.logger.error(
        'Failed to send verification email',
        SendGridService.name,
        { email, error: error.message },
      );
      throw error;
    }
  }

  /**
   * Send ticket receipt email via SendGrid
   */
  async sendTicketReceipt(
    ticketData: {
      email: string;
      ticketNumber: string;
      eventName: string;
      ticketType?: string;
      purchaseDate: string;
      totalAmount: number;
      customerName: string;
      receiptHtml?: string;
      eventDate?: Date;
      eventLocation?: string;
      qrCode?: string;
      seats?: Array<{ sectionId?: string; seatId: string }>;
    },
    options?: {
      attachPdf?: boolean;
      receiptUrl?: string;
    },
  ): Promise<{ success: boolean; message: string }> {
    if (!this.isConfigured) {
      this.logger.warn(
        'SendGrid not configured - skipping email send',
        SendGridService.name,
        { email: ticketData.email },
      );
      return {
        success: false,
        message: 'Email service not configured',
      };
    }

    try {
      const { email, ticketNumber, eventName, customerName } = ticketData;

      this.logger.log('Sending ticket receipt via SendGrid', SendGridService.name, {
        email,
        ticketNumber,
        eventName,
        attachPdf: options?.attachPdf,
      });

      const htmlContent = generateReceiptHTML(
        {
          ticketNumber,
          customerName,
          customerEmail: email,
          price: ticketData.totalAmount,
          ticketType: ticketData.ticketType || 'Standard',
          createdAt: new Date(),
          qrCode: ticketData.qrCode,
          seats: ticketData.seats,
        },
        {
          name: eventName,
          date: ticketData.eventDate,
          location: ticketData.eventLocation,
        },
        {
          includeQrCode: false, // Don't include QR in email body
        },
      );

      const attachments: any[] = [];

      // Generate PDF if requested
      if (options?.attachPdf) {
        try {
          const pdfBuffer = await this.generatePdfFromData({
            ticketNumber,
            eventName,
            customerName,
            amount: ticketData.totalAmount,
            purchaseDate: ticketData.purchaseDate,
          });
          if (pdfBuffer) {
            attachments.push({
              filename: `receipt_${ticketNumber}.pdf`,
              content: pdfBuffer.toString('base64'),
              type: 'application/pdf',
            });
            this.logger.log('PDF attachment generated', SendGridService.name, {
              ticketNumber,
            });
          }
        } catch (pdfError: any) {
          this.logger.warn(
            'PDF generation failed - sending without attachment',
            SendGridService.name,
            { error: pdfError.message },
          );
        }
      }

      const msg = {
        to: email,
        from: `${process.env.SENDGRID_FROM_NAME || 'Golden Moment'} <${process.env.SENDGRID_FROM_EMAIL}>`,
        subject: `Your Ticket Receipt - ${eventName}`,
        html: htmlContent,
        attachments,
      };

      await sgMail.send(msg as any);

      this.logger.log('Receipt email sent successfully', SendGridService.name, {
        email,
        ticketNumber,
        attachmentCount: attachments.length,
      });

      return {
        success: true,
        message: `Receipt sent to ${email}`,
      };
    } catch (error: any) {
      this.logger.error(
        'Failed to send receipt email',
        SendGridService.name,
        { ticketNumber: ticketData.ticketNumber, email: ticketData.email, error: error.message },
      );
      throw error;
    }
  }

  /**
   * Send password reset email via SendGrid
   */
  async sendPasswordResetEmail(
    email: string,
    token: string,
    frontendUrl?: string,
  ): Promise<{ success: boolean; message: string }> {
    if (!this.isConfigured) {
      this.logger.warn(
        'SendGrid not configured - skipping email send',
        SendGridService.name,
        { email },
      );
      return {
        success: false,
        message: 'Email service not configured',
      };
    }

    try {
      const resetUrl = `${frontendUrl || process.env.FRONTEND_URL}/auth/reset-password?token=${token}`;

      const msg = {
        to: email,
        from: `${process.env.SENDGRID_FROM_NAME || 'Golden Moment'} <${process.env.SENDGRID_FROM_EMAIL}>`,
        subject: '🔐 Reset Your Golden Moment Password',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
              .button { display: inline-block; padding: 15px 30px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
              .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
              .warning { background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🔐 Password Reset Request</h1>
              </div>
              <div class="content">
                <p>Hello,</p>
                <p>We received a request to reset your password for your Golden Moment account.</p>
                <p>Click the button below to reset your password:</p>
                <div style="text-align: center;">
                  <a href="${resetUrl}" class="button">Reset Password</a>
                </div>
                <p>Or copy and paste this link into your browser:</p>
                <p style="word-break: break-all; color: #f59e0b;">${resetUrl}</p>
                <div class="warning">
                  <strong>⚠️ This link will expire in 1 hour.</strong><br>
                  If you did not request a password reset, please ignore this email or contact our support team.
                </div>
                <p>For security reasons, we recommend using a strong password that includes uppercase and lowercase letters, numbers, and special characters.</p>
              </div>
              <div class="footer">
                <p>Golden Moment Events © 2026</p>
                <p>Tunis, Tunisia</p>
              </div>
            </div>
          </body>
          </html>
        `,
      };

      await sgMail.send(msg as any);

      this.logger.log('Password reset email sent successfully', SendGridService.name, {
        email,
      });

      return {
        success: true,
        message: `Password reset email sent to ${email}`,
      };
    } catch (error: any) {
      this.logger.error(
        'Failed to send password reset email',
        SendGridService.name,
        { email, error: error.message },
      );
      throw error;
    }
  }

  /**
   * Send password reset confirmation email via SendGrid
   */
  async sendPasswordResetConfirmation(
    email: string,
  ): Promise<{ success: boolean; message: string }> {
    if (!this.isConfigured) {
      this.logger.warn(
        'SendGrid not configured - skipping email send',
        SendGridService.name,
        { email },
      );
      return {
        success: false,
        message: 'Email service not configured',
      };
    }

    try {
      const msg = {
        to: email,
        from: `${process.env.SENDGRID_FROM_NAME || 'Golden Moment'} <${process.env.SENDGRID_FROM_EMAIL}>`,
        subject: '✅ Password Changed Successfully',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
              .button { display: inline-block; padding: 15px 30px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
              .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
              .success { background-color: #d1fae5; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>✅ Password Changed Successfully</h1>
              </div>
              <div class="content">
                <p>Hello,</p>
                <p>Your password has been successfully changed.</p>
                <div class="success">
                  <strong>✓ Your account is now secure with your new password.</strong>
                </div>
                <p>You can now log in with your new password:</p>
                <div style="text-align: center;">
                  <a href="${process.env.FRONTEND_URL || 'https://golden-moment.tn'}/auth/login" class="button">Log In to Your Account</a>
                </div>
                <p>If you did not make this change or have any concerns about your account security, please contact our support team immediately.</p>
              </div>
              <div class="footer">
                <p>Golden Moment Events © 2026</p>
                <p>Tunis, Tunisia</p>
              </div>
            </div>
          </body>
          </html>
        `,
      };

      await sgMail.send(msg as any);

      this.logger.log('Password reset confirmation sent successfully', SendGridService.name, {
        email,
      });

      return {
        success: true,
        message: `Confirmation email sent to ${email}`,
      };
    } catch (error: any) {
      this.logger.error(
        'Failed to send password reset confirmation',
        SendGridService.name,
        { email, error: error.message },
      );
      throw error;
    }
  }
}
