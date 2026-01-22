import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  Delete,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { Public } from '../auth/decorators/public.decorator';

@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}
  @Public()
  @Post()
  async create(@Body() createTicketDto: CreateTicketDto) {
    try {
      return await this.ticketsService.create(createTicketDto);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to create ticket';

      // Return 409 for capacity/conflict errors, 400 for validation errors
      if (
        message.includes('sold out') ||
        message.includes('capacity') ||
        message.includes('Not enough')
      ) {
        throw new ConflictException(message);
      }

      throw new BadRequestException(message);
    }
  }
  @Public()
  @Post('validate-qr')
  async validateQR(@Body() body: { encryptedToken: string }) {
    return this.ticketsService.validateByQRToken(body.encryptedToken);
  }
  @Public()
  @Post('validate')
  async validateTicket(@Body() body: { ticketNumber: string }) {
    return this.ticketsService.validateTicketByNumber(body.ticketNumber);
  }
  @Public()
  @Get('search')
  async search(@Query('q') query: string) {
    return this.ticketsService.search(query);
  }
  @Public()
  @Get('by-number/:ticketNumber')
  async findByTicketNumber(@Param('ticketNumber') ticketNumber: string) {
    return this.ticketsService.findByTicketNumber(ticketNumber);
  }
  @Public()
  @Get('event/:eventId')
  async findByEventId(@Param('eventId') eventId: string) {
    return this.ticketsService.findByEventId(eventId);
  }
  @Public()
  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.ticketsService.findById(id);
  }
  @Public()
  @Get()
  async findAll() {
    return this.ticketsService.findAll();
  }
  @Public()
  @Post(':id/mark-used')
  async markAsUsed(@Param('id') id: string) {
    return this.ticketsService.markAsUsed(id);
  }
  @Public()
  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.ticketsService.delete(id);
  }
}
