import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import * as puppeteer from 'puppeteer';
import { AppLogger } from '../common/utils/logger';
import { generateReceiptHTML } from './receipt-generator';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;
  private readonly logger = new AppLogger();

  constructor() {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    this.logger.log('Initializing email transporter', EmailService.name, {
      smtpHost: process.env.SMTP_HOST,
      smtpPort: process.env.SMTP_PORT,
      smtpUser: process.env.SMTP_USER,
      fromEmail: process.env.SMTP_FROM_EMAIL,
      fromName: process.env.SMTP_FROM_NAME,
    });

    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // Verify connection
    this.transporter.verify((error, success) => {
      if (error) {
        this.logger.error(
          'Email service initialization failed',
          EmailService.name,
          { error: error.message },
        );
      } else {
        this.logger.log(
          'Email service ready - SMTP connection verified',
          EmailService.name,
        );
      }
    });
  }

  /**
   * Generate PDF from HTML
   */
  async generatePdfFromHtml(htmlContent: string): Promise<Buffer> {
    const browser = await puppeteer.launch({
      headless: true as any, // Cast to any to avoid type issues with newer versions
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(htmlContent, { waitUntil: 'networkidle2' });

      const pdfBuffer = await page.pdf({
        format: 'A4',
        margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' },
      });

      return pdfBuffer as Buffer;
    } finally {
      await browser.close();
    }
  }

  /**
   * Send receipt email
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
    try {
      const { email, ticketNumber, eventName, customerName } = ticketData;

      this.logger.log('Starting sendTicketReceipt', EmailService.name, {
        email,
        ticketNumber,
        eventName,
        customerName,
        attachPdf: options?.attachPdf,
      });

      // Generate professional HTML email (WITHOUT QR code for email body)
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
          includeQrCode: false, // Don't include QR code in email body
        },
      );

      const attachments: any[] = [];

      // Generate PDF if requested (WITH QR code for PDF)
      if (options?.attachPdf) {
        try {
          this.logger.log('Generating PDF attachment', EmailService.name, {
            ticketNumber,
          });
          // Generate PDF with QR code included
          const pdfHtml = generateReceiptHTML(
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
              includeQrCode: true, // Include QR code in PDF
            },
          );
          const pdfBuffer = await this.generatePdfFromHtml(pdfHtml);
          attachments.push({
            filename: `receipt-${ticketNumber}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf',
          });
          this.logger.log('PDF generated successfully', EmailService.name, {
            ticketNumber,
          });
        } catch (pdfError) {
          this.logger.warn(
            'PDF generation failed, sending email without attachment',
            EmailService.name,
            {
              ticketNumber,
              error:
                pdfError instanceof Error ? pdfError.message : String(pdfError),
            },
          );
        }
      }

      const mailOptions = {
        from: `${process.env.SMTP_FROM_NAME || 'Golden Moment'} <${process.env.SMTP_USER}>`,
        to: email,
        subject: `Your Ticket Receipt - ${eventName}`,
        html: htmlContent,
        attachments,
      };

      this.logger.log('Sending email via SMTP', EmailService.name, {
        to: email,
        from: mailOptions.from,
        subject: mailOptions.subject,
        attachmentCount: attachments.length,
      });

      const info = await this.transporter.sendMail(mailOptions);

      this.logger.log('✅ Receipt email sent successfully', EmailService.name, {
        email,
        ticketNumber,
        messageId: info.messageId,
        response: info.response,
      });

      return {
        success: true,
        message: `Receipt sent to ${email}`,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack =
        error instanceof Error ? error.stack : 'No stack trace';

      this.logger.error('❌ Failed to send receipt email', EmailService.name, {
        ticketNumber: ticketData.ticketNumber,
        email: ticketData.email,
        errorMessage,
        errorStack,
        smtpConfig: {
          host: process.env.SMTP_HOST,
          port: process.env.SMTP_PORT,
          user: process.env.SMTP_USER,
        },
      });

      throw error;
    }
  }

  /**
   * Send bulk receipts
   */
  async sendBulkReceipts(
    tickets: Array<{
      email: string;
      ticketNumber: string;
      eventName: string;
      purchaseDate: string;
      totalAmount: number;
      customerName: string;
    }>,
  ): Promise<{ success: number; failed: number; errors: any[] }> {
    const results = {
      success: 0,
      failed: 0,
      errors: [] as any[],
    };

    for (const ticket of tickets) {
      try {
        await this.sendTicketReceipt(ticket);
        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          ticketNumber: ticket.ticketNumber,
          email: ticket.email,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return results;
  }
}
