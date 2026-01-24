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
import { Public } from '../auth/decorators/public.decorator';
import { Public } from '../auth/decorators/public.decorator';

@Controller('seats')
export class SeatsController {
  constructor(
    private readonly seatsService: SeatsService,
    @Inject(forwardRef(() => TicketsService))
    private readonly ticketsService: TicketsService,
  ) {}

  @Public()
  @Get('event/:eventId')
  async getSeatMap(@Param('eventId') eventId: string) {
    return this.seatsService.getSeatMap(eventId);
  }

  @Public()
  @Post('event/:eventId/initialize')
  async initializeSeats(@Param('eventId') eventId: string) {
    return this.seatsService.initializeSeats(eventId);
  }

  // ATOMIC PAYMENT-BASED SEAT LOCKING
  // This endpoint atomically:
  // 1. Verifies all seats are still available
  // 2. Marks seats as unavailable
  // 3. Creates and returns the ticket
  // 4. Detects and rejects if any seat was sold by another customer (race condition)
  @Public()
  @Post('finalize-purchase')
  @HttpCode(HttpStatus.CREATED)
  async finalizePurchase(
    @Body()
    body: {
      eventId: string;
      seats: { sectionId: string; seatId: string }[];
      buyerName: string;
      buyerEmail: string;
      buyerPhoneNumber: string;
      ticketType?: string;
    },
  ) {
    // Delegate to TicketsService which handles:
    // - Atomic seat locking
    // - Race condition detection (409 Conflict if seat sold)
    // - Ticket creation and generation
    return this.ticketsService.create({
      eventId: body.eventId,
      seats: body.seats,
      buyerName: body.buyerName,
      buyerEmail: body.buyerEmail,
      buyerPhoneNumber: body.buyerPhoneNumber,
      ticketType: (body.ticketType || 'Free') as
        | 'Free'
        | 'Standard'
        | 'EarlyBird'
        | 'VIP',
    });
  }

  @Public()
  @Post('event/:eventId/reserve')
  @HttpCode(HttpStatus.OK)
  async reserveSeats(
    @Param('eventId') eventId: string,
    @Body() body: { seats: { sectionId: string; seatId: string }[] },
  ) {
    return this.seatsService.reserveSeats(eventId, body.seats);
  }

  @Public()
  @Post('event/:eventId/release')
  @HttpCode(HttpStatus.OK)
  async releaseReservation(
    @Param('eventId') eventId: string,
    @Body() body: { seats: { sectionId: string; seatId: string }[] },
  ) {
    await this.seatsService.releaseReservation(eventId, body.seats);
    return { success: true };
  }

  @Public()
  @Post('event/:eventId/cleanup-expired')
  @HttpCode(HttpStatus.OK)
  async cleanupExpiredReservations(@Param('eventId') eventId: string) {
    const count = await this.seatsService.cleanupExpiredReservations(eventId);
    return { cleanedUp: count };
  }
}
