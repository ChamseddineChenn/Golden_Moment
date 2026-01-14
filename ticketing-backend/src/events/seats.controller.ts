import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SeatsService } from './seats.service';

@Controller('seats')
export class SeatsController {
  constructor(private readonly seatsService: SeatsService) {}

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

  @Post('finalize')
  @HttpCode(HttpStatus.OK)
  async finalizePurchase(
    @Body()
    body: {
      eventId: string;
      seatIds: { sectionId: string; seatId: string }[];
    },
  ) {
    return this.seatsService.finalizePurchase(body.eventId, body.seatIds);
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
