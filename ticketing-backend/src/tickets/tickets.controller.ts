import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  Delete,
  ConflictException,
} from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { Public } from '../auth/decorators/public.decorator';
import { AppLogger } from '../common/utils/logger';

@Controller('tickets')
export class TicketsController {
  private readonly logger = new AppLogger(TicketsController.name);

  constructor(private readonly ticketsService: TicketsService) {}
  @Public()
  @Post()
  async create(@Body() createTicketDto: CreateTicketDto) {
    this.logger.log('POST /tickets - creating ticket', TicketsController.name, {
      eventId: createTicketDto.eventId.toString(),
      ticketType: createTicketDto.ticketType,
    });
    try {
      const result = await this.ticketsService.create(createTicketDto);
      this.logger.log('Ticket created successfully', TicketsController.name, {
        ticketId: result._id.toString(),
      });
      return result;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to create ticket';

      this.logger.error('Error creating ticket', TicketsController.name, {
        error: message,
      });

      // Return 409 for capacity/conflict errors, 400 for validation errors
      if (
        message.includes('sold out') ||
        message.includes('capacity') ||
        message.includes('Not enough')
      ) {
        throw new ConflictException(message);
      }

      throw error;
    }
  }
  @Public()
  @Post('validate-qr')
  async validateQR(@Body() body: { encryptedToken: string }) {
    this.logger.log('POST /tickets/validate-qr', TicketsController.name);
    const result = await this.ticketsService.validateByQRToken(
      body.encryptedToken,
    );
    this.logger.log('QR validation result', TicketsController.name, {
      success: result.success,
    });
    return result;
  }
  @Public()
  @Post('validate')
  async validateTicket(@Body() body: { ticketNumber: string }) {
    this.logger.log('POST /tickets/validate', TicketsController.name, {
      ticketNumber: body.ticketNumber,
    });
    const result = await this.ticketsService.validateTicketByNumber(
      body.ticketNumber,
    );
    this.logger.log('Ticket validation result', TicketsController.name, {
      success: result.success,
    });
    return result;
  }
  @Public()
  @Get('search')
  async search(@Query('q') query: string) {
    this.logger.log('GET /tickets/search', TicketsController.name, { query });
    return this.ticketsService.search(query);
  }
  @Public()
  @Get('by-number/:ticketNumber')
  async findByTicketNumber(@Param('ticketNumber') ticketNumber: string) {
    this.logger.log(
      'GET /tickets/by-number/:ticketNumber',
      TicketsController.name,
      {
        ticketNumber,
      },
    );
    return this.ticketsService.findByTicketNumber(ticketNumber);
  }
  @Public()
  @Get('event/:eventId')
  async findByEventId(@Param('eventId') eventId: string) {
    this.logger.log('GET /tickets/event/:eventId', TicketsController.name, {
      eventId,
    });
    return this.ticketsService.findByEventId(eventId);
  }
  @Public()
  @Get(':id')
  async findById(@Param('id') id: string) {
    this.logger.log('GET /tickets/:id', TicketsController.name, { id });
    return this.ticketsService.findById(id);
  }
  @Public()
  @Get()
  async findAll() {
    this.logger.log('GET /tickets', TicketsController.name);
    return this.ticketsService.findAll();
  }
  @Public()
  @Post(':id/mark-used')
  async markAsUsed(@Param('id') id: string) {
    this.logger.log('POST /tickets/:id/mark-used', TicketsController.name, {
      id,
    });
    return this.ticketsService.markAsUsed(id);
  }
  @Public()
  @Delete(':id')
  async delete(@Param('id') id: string) {
    this.logger.log('DELETE /tickets/:id', TicketsController.name, { id });
    return this.ticketsService.delete(id);
  }
}
