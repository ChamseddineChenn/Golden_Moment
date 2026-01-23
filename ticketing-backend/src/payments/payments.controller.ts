import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Request,
  RawBodyRequest,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { PaymentsService } from './payments.service';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';

@Controller('payments')
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  @Public()
  @Post('create-checkout-session')
  async createCheckoutSession(
    @Request() req,
    @Body() dto: CreateCheckoutSessionDto,
  ) {
    console.log('[PaymentsController] Received checkout request:', dto);
    // For unauthenticated users, use a temporary ID based on email or generate one
    const userId = req.user?.id || `guest-${Date.now()}`;
    return this.paymentsService.createCheckoutSession(userId, dto);
  }

  @Public()
  @Post('webhook')
  async handleWebhook(@Req() req: any) {
    const signature = req.headers['stripe-signature'] as string;
    if (!signature) {
      throw new BadRequestException('No Stripe signature provided');
    }

    // Get the raw body - handle Buffer objects from stringified body
    let body = req.rawBody;
    if (!body && req.body) {
      if (Buffer.isBuffer(req.body)) {
        body = req.body;
      } else if (typeof req.body === 'string') {
        body = req.body;
      } else if (req.body.type === 'Buffer' && Array.isArray(req.body.data)) {
        // Handle stringified Buffer object from middleware
        body = Buffer.from(req.body.data);
      } else {
        // Last resort: stringify the body
        body = JSON.stringify(req.body);
      }
    }

    if (!body) {
      throw new BadRequestException('No request body provided');
    }

    const event = this.paymentsService.verifyWebhookSignature(body, signature);

    switch (event['type']) {
      case 'payment_intent.succeeded':
        await this.paymentsService.handlePaymentSuccess(
          event['data']['object']['id'],
        );
        break;
      case 'payment_intent.payment_failed':
        await this.paymentsService.handlePaymentFailure(
          event['data']['object']['id'],
          event['data']['object']['last_payment_error']?.['message'] ||
            'Unknown error',
        );
        break;
      default:
        console.log(`Unhandled event type ${event['type']}`);
    }

    return { received: true };
  }

  @Public()
  @Get('by-intent/:paymentIntentId')
  async getPaymentByIntent(@Param('paymentIntentId') paymentIntentId: string) {
    return this.paymentsService.getPaymentByIntent(paymentIntentId);
  }

  @Public()
  @Get(':paymentId')
  async getPayment(@Param('paymentId') paymentId: string) {
    return this.paymentsService.getPaymentById(paymentId);
  }

  @Get('user/payments')
  async getUserPayments(@Request() req) {
    const userId = req.user?.id;
    if (!userId) {
      throw new BadRequestException('User not authenticated');
    }
    return this.paymentsService.getUserPayments(userId);
  }
}
