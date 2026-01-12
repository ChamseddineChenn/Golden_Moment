import { Controller, Post, Get, Body, Param, Query } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { CreateTicketDto } from './dto/create-ticket.dto';

@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post()
  async create(@Body() createTicketDto: CreateTicketDto) {
    return this.ticketsService.create(createTicketDto);
  }

  @Post('validate')
  async validateTicket(@Body() body: { ticketNumber: string }) {
    return this.ticketsService.validateTicketByNumber(body.ticketNumber);
  }

  @Get('search')
  async search(@Query('q') query: string) {
    return this.ticketsService.search(query);
  }

  @Get('by-number/:ticketNumber')
  async findByTicketNumber(@Param('ticketNumber') ticketNumber: string) {
    return this.ticketsService.findByTicketNumber(ticketNumber);
  }

  @Get('event/:eventId')
  async findByEventId(@Param('eventId') eventId: string) {
    return this.ticketsService.findByEventId(eventId);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.ticketsService.findById(id);
  }

  @Get()
  async findAll() {
    return this.ticketsService.findAll();
  }

  @Post(':id/mark-used')
  async markAsUsed(@Param('id') id: string) {
    return this.ticketsService.markAsUsed(id);
  }
}
