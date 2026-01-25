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
  UsePipes,
} from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  @Public()
  @Post('create-checkout-session')
  async createCheckoutSession(
    @Request() req,
    @Req() request: any, // Get raw express request to access body before transformation
  ) {
    // Get the raw body directly from Express request - bypasses class-transformer whitelist
    const rawBody = request.body;

    console.log('[PaymentsController] ===== CHECKOUT SESSION DEBUG =====');
    console.log(
      '[PaymentsController] Raw request.body:',
      JSON.stringify(rawBody),
    );
    console.log(
      '[PaymentsController] ticketIds:',
      JSON.stringify(rawBody?.ticketIds),
    );
    console.log(
      '[PaymentsController] ticketIds[0]:',
      JSON.stringify(rawBody?.ticketIds?.[0]),
    );

    // Manual validation
    if (!rawBody?.eventId || typeof rawBody.eventId !== 'string') {
      throw new BadRequestException('eventId is required');
    }
    if (
      !rawBody?.ticketIds ||
      !Array.isArray(rawBody.ticketIds) ||
      rawBody.ticketIds.length === 0
    ) {
      throw new BadRequestException('ticketIds array is required');
    }
    // totalAmount can be 0 for free tickets, but must be a number
    if (typeof rawBody?.totalAmount !== 'number') {
      throw new BadRequestException('totalAmount must be a number');
    }
    if (rawBody.totalAmount < 0) {
      throw new BadRequestException('totalAmount cannot be negative');
    }

    // Build DTO from raw body - preserving ticketIds exactly as received
    const dto = {
      eventId: rawBody.eventId,
      ticketIds: rawBody.ticketIds, // Preserved without stripping!
      totalAmount: rawBody.totalAmount,
      buyerEmail: rawBody.buyerEmail,
      buyerName: rawBody.buyerName,
      buyerPhoneNumber: rawBody.buyerPhoneNumber,
      ticketType: rawBody.ticketType,
      successUrl: rawBody.successUrl,
      cancelUrl: rawBody.cancelUrl,
    };

    console.log(
      '[PaymentsController] FINAL DTO being sent to service:',
      JSON.stringify(dto),
    );

    // For unauthenticated users, use a temporary ID based on email or generate one
    const userId = req.user?.id || `guest-${Date.now()}`;
    return this.paymentsService.createCheckoutSession(userId, dto as any);
  }

  @Public()
  @Post('create-free-ticket')
  async createFreeTicket(@Request() req, @Req() request: any) {
    // Get raw body - free ticket creation bypasses Stripe
    const rawBody = request.body;

    console.log('[PaymentsController] ===== CREATE FREE TICKET DEBUG =====');
    console.log(
      '[PaymentsController] Raw request.body:',
      JSON.stringify(rawBody),
    );

    // Validation
    if (!rawBody?.eventId || typeof rawBody.eventId !== 'string') {
      throw new BadRequestException('eventId is required');
    }
    if (
      !rawBody?.ticketIds ||
      !Array.isArray(rawBody.ticketIds) ||
      rawBody.ticketIds.length === 0
    ) {
      throw new BadRequestException('ticketIds array is required');
    }

    const dto = {
      eventId: rawBody.eventId,
      ticketIds: rawBody.ticketIds,
      buyerEmail: rawBody.buyerEmail,
      buyerName: rawBody.buyerName,
      buyerPhoneNumber: rawBody.buyerPhoneNumber,
      ticketType: rawBody.ticketType || 'Free',
    };

    const userId = req.user?.id || `guest-${Date.now()}`;
    const result = await this.paymentsService.createFreeTicket(
      userId,
      dto as any,
    );
    console.log(
      '[PaymentsController] Free ticket creation result:',
      JSON.stringify(result),
    );
    return result;
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
