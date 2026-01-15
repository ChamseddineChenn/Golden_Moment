import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { SeatsService } from './seats.service';
import { TicketsService } from '../tickets/tickets.service';

@Controller('seats')
export class SeatsController {
  constructor(
    private readonly seatsService: SeatsService,
    @Inject(forwardRef(() => TicketsService))
    private readonly ticketsService: TicketsService,
  ) {}

  @Get('event/:eventId')
  async getSeatMap(@Param('eventId') eventId: string) {
    return this.seatsService.getSeatMap(eventId);
  }

  @Post('reserve')
  @HttpCode(HttpStatus.OK)
  async reserveSeats(
    @Body()
    body: {
      eventId: string;
      seats: { sectionId: string; seatId: string }[];
    },
  ) {
    return this.seatsService.reserveSeats(body.eventId, body.seats);
  }

  // ATOMIC PAYMENT-BASED SEAT LOCKING
  // This endpoint atomically:
  // 1. Verifies all seats are still available
  // 2. Marks seats as unavailable
  // 3. Creates and returns the ticket
  // 4. Detects and rejects if any seat was sold by another customer (race condition)
  @Post('finalize-purchase')
  @HttpCode(HttpStatus.CREATED)
  async finalizePurchase(
    @Body()
    body: {
      eventId: string;
      seats: { sectionId: string; seatId: string }[];
      buyerName: string;
      buyerEmail: string;
      ticketType?: string;
    },
  ) {
    console.log('[SeatsController] finalizePurchase called:', {
      eventId: body.eventId,
      seatCount: body.seats.length,
      buyerName: body.buyerName,
      ticketType: body.ticketType,
    });

    // Delegate to TicketsService which handles:
    // - Atomic seat locking
    // - Race condition detection (409 Conflict if seat sold)
    // - Ticket creation and generation
    return this.ticketsService.create({
      eventId: body.eventId,
      seats: body.seats,
      buyerName: body.buyerName,
      buyerEmail: body.buyerEmail,
      ticketType: (body.ticketType || 'Free') as
        | 'Free'
        | 'Standard'
        | 'EarlyBird'
        | 'VIP',
    });
  }

  @Post('unreserve')
  @HttpCode(HttpStatus.OK)
  async unreserveSeats(
    @Body()
    body: {
      eventId: string;
      seats: { sectionId: string; seatId: string }[];
    },
  ) {
    return this.seatsService.unreserveSeats(body.eventId, body.seats);
  }
}
