import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import Stripe from 'stripe';
import { Payment, PaymentDocument } from './payment.schema';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';
import { TicketsService } from '../tickets/tickets.service';

@Injectable()
export class PaymentsService {
  private stripe: Stripe;
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    private ticketsService: TicketsService,
  ) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-12-15.clover',
    });
  }

  async createCheckoutSession(userId: string, dto: CreateCheckoutSessionDto) {
    try {
      const {
        eventId,
        ticketIds,
        totalAmount,
        buyerEmail,
        buyerName,
        buyerPhoneNumber,
        ticketType,
        successUrl,
        cancelUrl,
      } = dto;

      // Validate input
      if (!userId || !eventId || ticketIds.length === 0 || totalAmount <= 0) {
        throw new BadRequestException('Invalid checkout session parameters');
      }

      // Create Stripe Payment Intent
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(totalAmount * 100), // Convert to cents
        currency: 'usd',
        metadata: {
          userId,
          eventId,
          ticketIds: JSON.stringify(ticketIds),
        },
      });

      // Create Payment record in database (pending status)
      // For guest users (userId starts with 'guest-'), store as string
      // For authenticated users, convert to ObjectId
      let userIdValue: any;
      try {
        userIdValue = new Types.ObjectId(userId);
      } catch {
        // If not a valid ObjectId, use the string directly (guest user)
        userIdValue = userId;
      }

      const payment = new this.paymentModel({
        userId: userIdValue,
        eventId: new Types.ObjectId(eventId),
        ticketIds: ticketIds, // Store objects directly - don't stringify
        amount: Math.round(totalAmount * 100), // Store in cents for consistency
        currency: 'usd',
        stripePaymentIntentId: paymentIntent.id,
        status: 'pending',
        metadata: {
          buyerEmail,
          buyerName,
          buyerPhoneNumber,
          ticketType,
          successUrl,
          cancelUrl,
        },
      });

      await payment.save();

      return {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      };
    } catch (error) {
      this.logger.error('Error creating checkout session:', error);
      throw error;
    }
  }

  async handlePaymentSuccess(paymentIntentId: string) {
    try {
      const payment = await this.paymentModel.findOne({
        stripePaymentIntentId: paymentIntentId,
      });

      if (!payment) {
        throw new NotFoundException('Payment not found');
      }

      // Update payment status first
      payment.status = 'succeeded';
      payment.paidAt = new Date();
      await payment.save();

      this.logger.log(`Payment ${paymentIntentId} marked as succeeded`);

      // NOW create tickets after payment succeeds
      // Extract ticket creation data from payment metadata
      const ticketCreationData = payment.metadata || {};

      try {
        // Use ticketIds directly - they should be an array of objects with sectionId/seatId
        let parsedTicketIds: any[] = Array.isArray(payment.ticketIds)
          ? payment.ticketIds
          : [];

        const createdTickets =
          await this.ticketsService.createTicketsFromPayment(
            payment._id.toString(),
            payment.userId.toString(),
            payment.eventId.toString(),
            parsedTicketIds,
            ticketCreationData.buyerEmail || '',
            ticketCreationData.buyerName || '',
            ticketCreationData.buyerPhoneNumber || '',
            ticketCreationData.ticketType || 'Standard',
          );

        this.logger.log(
          `Created ${createdTickets.length} tickets for payment ${paymentIntentId}`,
        );
        return { payment, createdTickets };
      } catch (ticketError) {
        this.logger.error(
          `Failed to create tickets for payment ${paymentIntentId}:`,
          ticketError,
        );
        // Payment is marked succeeded, but tickets failed - log this critical issue
        throw new Error(
          `Payment succeeded but ticket creation failed: ${ticketError.message}`,
        );
      }
    } catch (error) {
      this.logger.error('Error handling payment success:', error);
      throw error;
    }
  }

  async handlePaymentFailure(paymentIntentId: string, reason: string) {
    try {
      const payment = await this.paymentModel.findOne({
        stripePaymentIntentId: paymentIntentId,
      });

      if (!payment) {
        throw new NotFoundException('Payment not found');
      }

      // Update payment status
      payment.status = 'failed';
      payment.failureReason = reason;
      await payment.save();

      this.logger.log(`Payment ${paymentIntentId} marked as failed: ${reason}`);
      return payment;
    } catch (error) {
      this.logger.error('Error handling payment failure:', error);
      throw error;
    }
  }

  async getPaymentById(paymentId: string) {
    const payment = await this.paymentModel.findById(paymentId);
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    return payment;
  }

  async getUserPayments(userId: string) {
    return this.paymentModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 });
  }

  async getPaymentByPaymentIntentId(paymentIntentId: string) {
    return this.paymentModel.findOne({
      stripePaymentIntentId: paymentIntentId,
    });
  }

  async getPaymentByIntent(paymentIntentId: string) {
    const payment = await this.paymentModel.findOne({
      stripePaymentIntentId: paymentIntentId,
    });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    return payment;
  }

  verifyWebhookSignature(body: string, signature: string): object {
    try {
      return this.stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET,
      );
    } catch (error) {
      this.logger.error('Webhook signature verification failed:', error);
      throw new BadRequestException('Invalid webhook signature');
    }
  }
}
