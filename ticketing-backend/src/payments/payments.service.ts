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
import { EventsService } from '../events/events.service';

@Injectable()
export class PaymentsService {
  private stripe: Stripe;
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    private ticketsService: TicketsService,
    private eventsService: EventsService,
  ) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-12-15.clover',
    });
  }

  async createCheckoutSession(userId: string, dto: CreateCheckoutSessionDto) {
    try {
      // Log raw DTO to see what's being received
      this.logger.debug('RAW DTO received from frontend:', {
        dtoType: typeof dto,
        dtoKeys: Object.keys(dto),
        ticketIdsType: typeof dto.ticketIds,
        ticketIdsIsArray: Array.isArray(dto.ticketIds),
        ticketIdsLength: Array.isArray(dto.ticketIds)
          ? dto.ticketIds.length
          : 'N/A',
        ticketIdsValue: JSON.stringify(dto.ticketIds),
        firstItemType:
          Array.isArray(dto.ticketIds) && dto.ticketIds[0]
            ? typeof dto.ticketIds[0]
            : 'N/A',
        firstItem:
          Array.isArray(dto.ticketIds) && dto.ticketIds[0]
            ? JSON.stringify(dto.ticketIds[0])
            : 'N/A',
      });

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

      // For guest users (userId starts with 'guest-'), store as string
      // For authenticated users, convert to ObjectId
      let userIdValue: any;
      try {
        userIdValue = new Types.ObjectId(userId);
      } catch {
        // If not a valid ObjectId, use the string directly (guest user)
        userIdValue = userId;
      }

      // Transform ticketIds for storage
      // If it's 'auto-assigned', convert to proper format
      this.logger.log('CHECKPOINT: ticketIds RECEIVED from frontend:', {
        ticketIds,
        type: typeof ticketIds,
        isArray: Array.isArray(ticketIds),
        length: Array.isArray(ticketIds) ? ticketIds.length : 'N/A',
        stringified: JSON.stringify(ticketIds),
      });

      let processedTicketIds = ticketIds;
      if (ticketIds.length === 1 && ticketIds[0] === 'auto-assigned') {
        // For events without seating, store a placeholder
        processedTicketIds = [
          { sectionId: 'general', seatId: 'auto-assigned' },
        ];
      }

      this.logger.log('CHECKPOINT: ticketIds AFTER PROCESSING:', {
        processedTicketIds,
        stringified: JSON.stringify(processedTicketIds),
      });

      const payment = new this.paymentModel({
        userId: userIdValue,
        eventId: new Types.ObjectId(eventId),
        ticketIds: processedTicketIds,
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

      this.logger.log('CHECKPOINT: Payment SAVED to DB:', {
        paymentId: payment._id.toString(),
        storedTicketIds: JSON.stringify(payment.ticketIds),
      });

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

      // IDEMPOTENCY CHECK: If payment already succeeded and tickets were created, don't process again
      if (payment.status === 'succeeded') {
        this.logger.log(
          `Payment ${paymentIntentId} already processed, skipping duplicate webhook`,
        );
        // Check if tickets already exist for this payment
        const existingTickets = await this.ticketsService.getTicketsByPaymentId(
          payment._id.toString(),
        );
        return { payment, createdTickets: existingTickets || [] };
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
        // Properly deserialize ticketIds from MongoDB - handle mixed types
        let parsedTicketIds: any[] = [];
        const event = await this.eventsService.findById(
          payment.eventId.toString(),
        );
        const isSeatingEvent = event?.seatingLayout?.enabled;

        this.logger.log('RAW payment.ticketIds from DB:', {
          type: typeof payment.ticketIds,
          isArray: Array.isArray(payment.ticketIds),
          value: JSON.stringify(payment.ticketIds),
          length: Array.isArray(payment.ticketIds)
            ? payment.ticketIds.length
            : 'N/A',
          isSeatingEvent,
        });

        if (Array.isArray(payment.ticketIds) && payment.ticketIds.length > 0) {
          // Convert Mongoose document to plain object and filter based on event type
          parsedTicketIds = payment.ticketIds
            .map((item: any, index: number) => {
              const converted =
                item && typeof item === 'object' && item.toObject
                  ? item.toObject()
                  : item;
              this.logger.log(`Processing ticketId[${index}]:`, {
                original: JSON.stringify(item),
                converted: JSON.stringify(converted),
                type: typeof item,
                hasToObject: item && typeof item.toObject === 'function',
              });
              return converted;
            })
            .filter((item: any) => {
              // For seating events: only keep valid seat objects with sectionId and seatId
              if (isSeatingEvent) {
                if (
                  item &&
                  typeof item === 'object' &&
                  item.sectionId &&
                  item.seatId
                ) {
                  return true;
                }
                return false;
              }
              // For non-seating events: keep auto-assigned or treat empty arrays as auto-assigned
              if (typeof item === 'string' && item === 'auto-assigned')
                return true;
              if (Array.isArray(item)) return true; // Keep arrays for counting purposes
              return false;
            });
        } else if (!isSeatingEvent) {
          // Non-seating event with no tickets - default to single auto-assigned
          parsedTicketIds = ['auto-assigned'];
        }

        this.logger.log('FINAL PARSED ticketIds after filtering:', {
          count: parsedTicketIds.length,
          data: JSON.stringify(parsedTicketIds),
        });

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
        // Mark payment with ticket creation error
        payment.status = 'ticket_creation_failed';
        payment.failureReason = ticketError.message;
        await payment.save();
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
    // Validate paymentId is provided and looks like a valid ObjectId
    if (!paymentId || paymentId === 'undefined') {
      throw new BadRequestException('Invalid payment ID provided');
    }

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

  async createFreeTicket(userId: string, dto: any) {
    try {
      this.logger.log('[PaymentsService] Creating free ticket for user:', {
        userId,
        eventId: dto.eventId,
        ticketIds: JSON.stringify(dto.ticketIds),
      });

      // Validate input
      if (
        !userId ||
        !dto.eventId ||
        !dto.ticketIds ||
        dto.ticketIds.length === 0
      ) {
        throw new BadRequestException('Invalid free ticket parameters');
      }

      // Get event to verify it exists and has a Free ticket type enabled
      const event = await this.eventsService.findById(dto.eventId);
      if (!event) {
        throw new NotFoundException('Event not found');
      }

      this.logger.log('[PaymentsService] Event found:', {
        eventName: event.name,
      });

      // For guest users (userId starts with 'guest-'), store as string
      // For authenticated users, convert to ObjectId
      let userIdValue: any;
      try {
        userIdValue = new Types.ObjectId(userId);
      } catch {
        // If not a valid ObjectId, use the string directly (guest user)
        userIdValue = userId;
        this.logger.log('[PaymentsService] Using guest user ID:', { userId });
      }

      // Check for idempotency - if we already created a free ticket for this user/event in the last minute, return it
      const oneMinuteAgo = new Date(Date.now() - 60000);
      const existingPayment = await this.paymentModel.findOne({
        userId: userIdValue,
        eventId: new Types.ObjectId(dto.eventId),
        amount: 0,
        createdAt: { $gte: oneMinuteAgo },
      });

      if (existingPayment) {
        this.logger.log(
          '[PaymentsService] Found existing free ticket payment, returning cached result:',
          { paymentId: existingPayment._id.toString() },
        );

        // Get existing tickets for this payment
        const existingTickets = await this.ticketsService.findByPaymentId(
          existingPayment._id.toString(),
        );

        if (existingTickets && existingTickets.length > 0) {
          const ticketId = existingTickets[0]._id.toString();
          const ticketNumber = existingTickets[0].ticketNumber;
          const paymentId = existingPayment._id.toString();

          this.logger.log('[PaymentsService] Returning existing free ticket:', {
            ticketId,
            ticketNumber,
            paymentId,
          });

          return {
            ticketId,
            ticketNumber,
            paymentId,
          };
        }
      }

      // Transform ticketIds for storage
      // If it's 'auto-assigned', convert to proper format
      let processedTicketIds = dto.ticketIds;
      if (dto.ticketIds.length === 1 && dto.ticketIds[0] === 'auto-assigned') {
        // For events without seating, store a placeholder
        processedTicketIds = [
          { sectionId: 'general', seatId: 'auto-assigned' },
        ];
      }

      // Create dummy payment record for free ticket (for audit trail)
      const payment = new this.paymentModel({
        userId: userIdValue,
        eventId: new Types.ObjectId(dto.eventId),
        ticketIds: processedTicketIds,
        amount: 0,
        currency: 'usd',
        stripePaymentIntentId: `free-${Date.now()}`, // Fake payment intent for free tickets
        status: 'succeeded', // Free tickets are immediately succeeded
        metadata: {
          buyerEmail: dto.buyerEmail,
          buyerName: dto.buyerName,
          buyerPhoneNumber: dto.buyerPhoneNumber,
          ticketType: dto.ticketType,
        },
      });

      await payment.save();

      this.logger.log(
        '[PaymentsService] Payment record created for free ticket:',
        {
          paymentId: payment._id.toString(),
          userId: payment.userId,
        },
      );

      // Create tickets directly (bypass the normal ticketIds filtering since there's no Stripe)
      this.logger.log(
        '[PaymentsService] About to create tickets from payment:',
        {
          processedTicketIds: JSON.stringify(processedTicketIds),
          paymentId: payment._id.toString(),
        },
      );

      const createdTickets = await this.ticketsService.createTicketsFromPayment(
        payment._id.toString(),
        userId,
        dto.eventId,
        processedTicketIds,
        dto.buyerEmail,
        dto.buyerName,
        dto.buyerPhoneNumber || '',
        dto.ticketType,
      );

      this.logger.log('[PaymentsService] Tickets created from payment:', {
        ticketCount: createdTickets.length,
        firstTicketId: createdTickets[0]?._id,
      });

      if (!createdTickets || createdTickets.length === 0) {
        throw new Error('Failed to create free ticket');
      }

      const ticketId = createdTickets[0]._id.toString();
      const ticketNumber = createdTickets[0].ticketNumber;
      const paymentId = payment._id.toString();

      this.logger.log('[PaymentsService] Free ticket created successfully:', {
        ticketId,
        ticketNumber,
        paymentId,
      });

      // Return just the data object - ResponseInterceptor will wrap it
      return {
        ticketId,
        ticketNumber,
        paymentId,
      };
    } catch (error) {
      this.logger.error(
        '[PaymentsService] Error creating free ticket:',
        error instanceof Error ? error.message : JSON.stringify(error),
      );
      if (error instanceof Error) {
        this.logger.error('[PaymentsService] Stack:', error.stack);
      }
      throw error;
    }
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
