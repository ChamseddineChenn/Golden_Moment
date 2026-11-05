import { Controller, Post, Body } from '@nestjs/common';
import { EmailService } from './email.service';
import { AppLogger } from '../common/utils/logger';
import { UserTypes } from '../auth/decorators/user-types.decorator';
import { UserType } from '../users/enums/user-type.enum';

@Controller('email')
@UserTypes(UserType.ADMIN)
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
      return await this.emailService.sendTicketReceipt(
        body.ticketData,
        body.options,
      );
    } catch (error) {
      this.logger.error(
        'Failed to send receipt via endpoint',
        EmailController.name,
        { error },
      );
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
      this.logger.error('Failed to send bulk receipts', EmailController.name, {
        error,
      });
      throw error;
    }
  }
}
