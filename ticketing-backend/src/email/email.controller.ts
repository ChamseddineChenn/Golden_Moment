import { Controller, Post, Body } from '@nestjs/common';
import { EmailService } from './email.service';
import { AppLogger } from '../common/utils/logger';

@Controller('email')
export class EmailController {
  private readonly logger = new AppLogger();

  constructor(private readonly emailService: EmailService) {}

  @Post('send-receipt')
  async sendReceipt(
    @Body()
    body: {
      ticketData: {
        email: string;
        ticketNumber: string;
        eventName: string;
        purchaseDate: string;
        totalAmount: number;
        customerName: string;
        receiptHtml?: string;
      };
      options?: {
        attachPdf?: boolean;
        receiptUrl?: string;
      };
    },
  ) {
    try {
      return await this.emailService.sendTicketReceipt(body.ticketData, body.options);
    } catch (error) {
      this.logger.error('Failed to send receipt via endpoint', EmailController.name, { error });
      throw error;
    }
  }

  @Post('send-bulk-receipts')
  async sendBulkReceipts(
    @Body()
    body: {
      tickets: Array<{
        email: string;
        ticketNumber: string;
        eventName: string;
        purchaseDate: string;
        totalAmount: number;
        customerName: string;
      }>;
    },
  ) {
    try {
      return await this.emailService.sendBulkReceipts(body.tickets);
    } catch (error) {
      this.logger.error('Failed to send bulk receipts', EmailController.name, { error });
      throw error;
    }
  }

  @Post('test')
  async testEmail() {
    try {
      const result = await this.emailService.sendTicketReceipt(
        {
          email: process.env.TEST_EMAIL || 'test@example.com',
          ticketNumber: 'TEST-' + Date.now(),
          eventName: 'Test Event',
          purchaseDate: new Date().toLocaleDateString(),
          totalAmount: 50,
          customerName: 'Test User',
        },
        {
          attachPdf: false,
          receiptUrl: `${process.env.FRONTEND_URL}/receipt/test-123`,
        },
      );

      this.logger.log('Test email sent successfully', EmailController.name);
      return result;
    } catch (error) {
      this.logger.error('Test email failed', EmailController.name, { error });
      throw error;
    }
  }
}
