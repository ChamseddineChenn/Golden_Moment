import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as QRCode from 'qrcode';
import { Ticket, TicketStatus } from './ticket.schema';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { EventsService } from '../events/events.service';

@Injectable()
export class TicketsService {
  constructor(
    @InjectModel(Ticket.name) private ticketModel: Model<Ticket>,
    private readonly eventsService: EventsService,
  ) {}

  // Generate unique ticket number
  private async generateTicketNumber(eventId: string): Promise<string> {
    const count = await this.ticketModel.countDocuments({ eventId });
    // Format: EVT-{eventId}-{number}, e.g., TK-000001
    return `TK${String(count + 1).padStart(6, '0')}`;
  }

  async create(createTicketDto: CreateTicketDto): Promise<Ticket> {
    // Auto-generate ticket number
    const ticketNumber = await this.generateTicketNumber(
      createTicketDto.eventId.toString(),
    );

    // Generate QR code data (contains ticket info)
    const qrData = {
      ticketNumber,
      eventId: createTicketDto.eventId,
      seatNumber: createTicketDto.seatNumber,
      timestamp: new Date().toISOString(),
    };

    // Generate QR code as data URL
    const qrCode = await QRCode.toDataURL(JSON.stringify(qrData));
    const ticketData = { ...createTicketDto, ticketNumber, qrCode };

    const createdTicket = new this.ticketModel(ticketData);
    const savedTicket = await createdTicket.save();

    // Update event's sold tickets count
    await this.eventsService.update(createTicketDto.eventId.toString(), {
      soldTickets: (await this.ticketModel.countDocuments({
        eventId: createTicketDto.eventId,
      })) as any,
    });

    return savedTicket;
  }

  async findByEventId(eventId: string): Promise<Ticket[]> {
    return this.ticketModel.find({ eventId }).exec();
  }

  async findById(ticketId: string): Promise<Ticket | null> {
    return this.ticketModel.findById(ticketId).populate('eventId').exec();
  }

  async findAll(): Promise<Ticket[]> {
    return this.ticketModel.find().populate('eventId').exec();
  }

  async search(query: string): Promise<Ticket[]> {
    // Search by ticket number, event name, ticket holder name, or email
    return this.ticketModel
      .find({
        $or: [
          { ticketNumber: { $regex: query, $options: 'i' } },
          { buyerName: { $regex: query, $options: 'i' } },
          { buyerEmail: { $regex: query, $options: 'i' } },
        ],
      })
      .populate('eventId')
      .exec();
  }

  async markAsUsed(ticketId: string): Promise<Ticket | null> {
    return this.ticketModel
      .findByIdAndUpdate(
        ticketId,
        {
          status: TicketStatus.USED,
          usedAt: new Date(),
        },
        { new: true },
      )
      .exec();
  }

  async validateTicketByNumber(ticketNumber: string): Promise<{
    success: boolean;
    message: string;
    ticket?: Ticket;
  }> {
    const ticket = await this.ticketModel
      .findOne({ ticketNumber })
      .populate('eventId')
      .exec();

    if (!ticket) {
      return {
        success: false,
        message: 'Ticket not found. This QR code is invalid.',
      };
    }

    // Check if ticket is expired (event date has passed)
    const eventInfo = ticket.eventId as any;
    if (eventInfo && new Date(eventInfo.date) < new Date()) {
      // Update status to expired if not already
      if (ticket.status !== TicketStatus.EXPIRED) {
        await this.ticketModel.findByIdAndUpdate(ticket._id, {
          status: TicketStatus.EXPIRED,
        });
        ticket.status = TicketStatus.EXPIRED;
      }
      return {
        success: false,
        message: 'This ticket has expired. The event has already passed.',
        ticket,
      };
    }

    if (ticket.status === TicketStatus.USED) {
      return {
        success: false,
        message: `This ticket has already been used on ${ticket.usedAt?.toLocaleString() || 'a previous date'}.`,
        ticket,
      };
    }

    if (ticket.status === TicketStatus.EXPIRED) {
      return {
        success: false,
        message: 'This ticket has expired.',
        ticket,
      };
    }

    // Mark as used
    const updatedTicket = await this.ticketModel
      .findByIdAndUpdate(
        ticket._id,
        {
          status: TicketStatus.USED,
          usedAt: new Date(),
        },
        { new: true },
      )
      .populate('eventId')
      .exec();

    return {
      success: true,
      message: 'Ticket validated successfully! Entry granted.',
      ticket: updatedTicket || ticket,
    };
  }

  async findByTicketNumber(ticketNumber: string): Promise<Ticket | null> {
    return this.ticketModel
      .findOne({ ticketNumber })
      .populate('eventId')
      .exec();
  }
}
