import { Injectable, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as QRCode from 'qrcode';
import * as crypto from 'crypto';
import { Ticket, TicketStatus } from './ticket.schema';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { EventsService } from '../events/events.service';
import { SeatsService } from '../events/seats.service';
import { EmailService } from '../email/email.service';
import { LogsService } from '../logs/logs.service';
import { LogAction } from '../logs/log.schema';
import { AppLogger } from '../common/utils/logger';
import {
  TicketNotFoundException,
  InvalidTicketTypeException,
  SeatUnavailableException,
  EarlyBirdSoldOutException,
  PastEventException,
} from '../common/exceptions/custom-exceptions';

@Injectable()
export class TicketsService {
  private readonly encryptionKey =
    process.env.QR_ENCRYPTION_KEY ||
    'default-insecure-key-change-in-production';
  private readonly algorithm = 'aes-256-gcm';
  private readonly logger = new AppLogger(TicketsService.name);

  constructor(
    @InjectModel(Ticket.name) private ticketModel: Model<Ticket>,
    private readonly eventsService: EventsService,
    private readonly seatsService: SeatsService,
    private readonly emailService: EmailService,
    private readonly logsService: LogsService,
  ) {}

  // Generate a secure encrypted QR token
  private generateQrToken(): { token: string; encryptedToken: string } {
    const token = crypto.randomBytes(32).toString('hex');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      this.algorithm,
      Buffer.from(this.encryptionKey.padEnd(32, '0').slice(0, 32)),
      iv,
    );
    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    const encryptedToken = `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    return { token, encryptedToken };
  }

  // Decrypt an encrypted QR token
  private decryptQrToken(encryptedToken: string): string | null {
    try {
      const parts = encryptedToken.split(':');
      if (parts.length !== 3) {
        this.logger.warn('Invalid encrypted token format', TicketsService.name);
        return null;
      }

      const iv = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const encrypted = parts[2];

      const decipher = crypto.createDecipheriv(
        this.algorithm,
        Buffer.from(this.encryptionKey.padEnd(32, '0').slice(0, 32)),
        iv,
      );
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      this.logger.error('Decryption error', TicketsService.name, error);
      return null;
    }
  }

  // Generate unique ticket number using MongoDB counter pattern
  private async generateTicketNumber(): Promise<string> {
    let ticketNumber = '';
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!isUnique && attempts < maxAttempts) {
      const count = await this.ticketModel.countDocuments();
      ticketNumber = `TK${String(count + attempts + 1).padStart(6, '0')}`;

      try {
        // Try to find if this number exists
        const existing = await this.ticketModel.findOne({ ticketNumber });
        if (!existing) {
          isUnique = true;
        }
      } catch (err) {
        // Continue trying
      }
      attempts++;
    }

    if (!isUnique) {
      throw new ConflictException('Failed to generate unique ticket number');
    }

    return ticketNumber;
  }

  async create(createTicketDto: CreateTicketDto): Promise<Ticket> {
    try {
      this.logger.log('Creating ticket', TicketsService.name, {
        eventId: createTicketDto.eventId.toString(),
        ticketType: createTicketDto.ticketType,
        buyerEmail: createTicketDto.buyerEmail,
      });

      // Get event details
      const event = await this.eventsService.findById(
        createTicketDto.eventId.toString(),
      );

      if (!event) {
        throw new Error('Event not found');
      }

      // Check if event date has passed
      const now = new Date();
      const eventDate = new Date(event.date);
      if (eventDate < now) {
        this.logger.warn(
          'Ticket purchase attempt for past event',
          TicketsService.name,
          {
            eventId: createTicketDto.eventId.toString(),
            eventDate: eventDate.toISOString(),
          },
        );
        throw new PastEventException();
      }

      // VALIDATE TICKET TYPE AVAILABILITY BEFORE LOCKING SEATS
      const ticketType = createTicketDto.ticketType || 'Free';
      if (!event.ticketTypes?.[ticketType]?.enabled) {
        this.logger.warn('Invalid ticket type requested', TicketsService.name, {
          ticketType,
          eventId: createTicketDto.eventId.toString(),
        });
        throw new InvalidTicketTypeException(ticketType);
      }

      // Check Early Bird limit BEFORE locking seats
      if (ticketType === 'EarlyBird') {
        const earlyBirdLimit = event.ticketTypes.EarlyBird.limit;
        if (
          earlyBirdLimit &&
          earlyBirdLimit > 0 &&
          event.earlyBirdCount >= earlyBirdLimit
        ) {
          this.logger.warn('Early Bird tickets sold out', TicketsService.name, {
            eventId: createTicketDto.eventId.toString(),
          });
          throw new EarlyBirdSoldOutException();
        }
      }

      // VALIDATE TOTAL CAPACITY: Ensure purchase won't exceed total seats
      if (event.totalSeats && event.totalSeats > 0) {
        const seatsToAdd =
          (createTicketDto.seats && createTicketDto.seats.length) || 1;

        // For events with seating layout (sections): verify available seats in sections
        if (
          event.seatingLayout?.enabled &&
          event.seatingLayout.sections?.length > 0
        ) {
          // Count total available seats across all sections
          let totalAvailable = 0;
          for (const section of event.seatingLayout.sections) {
            if (section.seats && Array.isArray(section.seats)) {
              const availableInSection = section.seats.filter(
                (s) => s.status === 'available',
              ).length;
              totalAvailable += availableInSection;
            }
          }

          if (totalAvailable < seatsToAdd) {
            this.logger.warn(
              'Insufficient seats available',
              TicketsService.name,
              {
                eventId: createTicketDto.eventId.toString(),
                requested: seatsToAdd,
                available: totalAvailable,
              },
            );
            throw new SeatUnavailableException(
              `Not enough seats available. Requested: ${seatsToAdd}, Available: ${totalAvailable}`,
            );
          }
        } else {
          // For standing room events (no seating layout): compare against totalSeats vs soldTickets
          const remainingCapacity = event.totalSeats - (event.soldTickets || 0);
          if (remainingCapacity < seatsToAdd) {
            this.logger.warn('Event sold out', TicketsService.name, {
              eventId: createTicketDto.eventId.toString(),
              remaining: Math.max(0, remainingCapacity),
              requested: seatsToAdd,
            });
            throw new SeatUnavailableException(
              `Event is sold out or insufficient capacity. Remaining: ${Math.max(0, remainingCapacity)}, Requested: ${seatsToAdd}`,
            );
          }
        }
      }

      // Validate max 10 seat purchase limit
      if (createTicketDto.seats && createTicketDto.seats.length > 10) {
        this.logger.warn('Seat purchase limit exceeded', TicketsService.name, {
          eventId: createTicketDto.eventId.toString(),
          requested: createTicketDto.seats.length,
        });
        throw new Error(
          'Maximum 10 seats per purchase allowed. Please select fewer seats.',
        );
      }

      // Auto-assign seats if not provided
      if (!createTicketDto.seats || createTicketDto.seats.length === 0) {
        const ticketCountForEvent = await this.ticketModel.countDocuments({
          eventId: createTicketDto.eventId,
        });
        createTicketDto.seats = [
          {
            seatId: `SEAT-${String(ticketCountForEvent + 1).padStart(4, '0')}`,
          },
        ];
      }

      // CRITICAL: Atomically lock seats BEFORE creating ticket
      // This prevents double-booking by ensuring only one customer can buy each seat
      const seatsWithSection = createTicketDto.seats.filter((s) => s.sectionId);

      if (seatsWithSection.length > 0) {
        // Call finalizePurchase - this will throw ConflictException if seat already sold
        // If this throws, the ticket will NEVER be created
        await this.seatsService.finalizePurchase(
          createTicketDto.eventId.toString(),
          seatsWithSection as { sectionId: string; seatId: string }[],
        );
      }

      // NOW create the ticket (after seats are locked)
      const ticketNumber = await this.generateTicketNumber();
      const expiresAt = new Date(eventDate.getTime() + 15 * 60 * 1000);

      // Generate secure QR token
      const { token, encryptedToken } = this.generateQrToken();

      // QR code only contains the encrypted token (not sensitive data)
      const qrCode = await QRCode.toDataURL(encryptedToken);

      // Calculate total price based on ticket type
      let totalPrice = 0;
      // (ticketType already validated above before seat locking)

      // Determine base price from ticket type
      const basePrice = event.ticketTypes[ticketType]?.price || 0;

      // Calculate total price with seat modifiers
      if (
        createTicketDto.seats &&
        createTicketDto.seats.length > 0 &&
        event.seatingLayout?.enabled
      ) {
        for (const seat of createTicketDto.seats) {
          const section = event.seatingLayout.sections.find(
            (s) => s.id === seat.sectionId,
          );
          if (section) {
            totalPrice += basePrice + (section.priceModifier || 0);
          } else {
            totalPrice += basePrice;
          }
        }
      } else {
        totalPrice = basePrice;
      }

      const ticketData = {
        eventId: createTicketDto.eventId,
        seats: createTicketDto.seats,
        buyerEmail: createTicketDto.buyerEmail,
        buyerName: createTicketDto.buyerName,
        buyerPhoneNumber: createTicketDto.buyerPhoneNumber,
        ticketNumber,
        qrCode,
        qrToken: token,
        expiresAt,
        totalPrice,
        ticketType,
        metadata: createTicketDto.metadata || {},
      };

      const createdTicket = new this.ticketModel(ticketData);
      const savedTicket = await createdTicket.save();

      this.logger.log('Ticket created successfully', TicketsService.name, {
        id: savedTicket._id.toString(),
        ticketNumber,
        price: totalPrice,
      });

      // Log the ticket purchase
      await this.logsService.createLog(LogAction.TICKET_PURCHASED, {
        ticketName: `Ticket #${ticketNumber}`,
        eventName: event.name,
        eventId: createTicketDto.eventId.toString(),
        ticketId: savedTicket._id.toString(),
        metadata: {
          ticketType,
          buyerEmail: createTicketDto.buyerEmail,
          buyerName: createTicketDto.buyerName,
          totalPrice,
        },
      });

      // Update event's Early Bird count if applicable
      const updateData: any = {};
      if (ticketType === 'EarlyBird') {
        updateData.earlyBirdCount = (event.earlyBirdCount || 0) + 1;
      }

      // Update event's sold tickets count
      if (event.seatingLayout?.enabled) {
        // IMPORTANT: Fetch the event AGAIN to get the updated seat statuses after locking
        const updatedEvent = await this.eventsService.findById(
          createTicketDto.eventId.toString(),
        );
        if (updatedEvent?.seatingLayout) {
          let unavailableSeatsCount = 0;
          for (const section of updatedEvent.seatingLayout.sections) {
            if (section.seats && Array.isArray(section.seats)) {
              unavailableSeatsCount += section.seats.filter(
                (s) => s.status === 'unavailable',
              ).length;
            }
          }
          updateData.soldTickets = unavailableSeatsCount;
        }
      } else {
        const ticketCountForEvent = await this.ticketModel.countDocuments({
          eventId: createTicketDto.eventId,
        });
        updateData.soldTickets = ticketCountForEvent;
      }

      if (Object.keys(updateData).length > 0) {
        await this.eventsService.update(
          createTicketDto.eventId.toString(),
          updateData,
        );
      }

      // Send receipt email asynchronously (don't block the response)
      this.sendReceiptEmailAsync(savedTicket, event).catch((error) => {
        this.logger.warn('Failed to send receipt email', TicketsService.name, {
          ticketId: savedTicket._id.toString(),
          error: error.message,
        });
        // Don't throw - email failure shouldn't fail the ticket creation
      });

      // Convert to plain JSON object for response serialization
      return JSON.parse(JSON.stringify(savedTicket));
    } catch (error) {
      this.logger.error('Error creating ticket', TicketsService.name, error);
      throw error;
    }
  }

  // Helper method to update expired tickets based on event date
  private async updateExpiredTickets(): Promise<void> {
    const now = new Date();

    // Find all tickets that are still "valid" and belong to events that have passed
    const validTickets = await this.ticketModel
      .find({ status: TicketStatus.VALID })
      .populate('eventId')
      .exec();

    for (const ticket of validTickets) {
      // Check if eventId is populated (is an object with date property)
      if (
        ticket.eventId &&
        typeof ticket.eventId === 'object' &&
        'date' in ticket.eventId
      ) {
        const eventDate = new Date((ticket.eventId as any).date);
        // If event date has passed, mark ticket as expired
        if (eventDate < now) {
          await this.ticketModel.findByIdAndUpdate(ticket._id, {
            status: TicketStatus.EXPIRED,
          });
        }
      }
    }
  }

  async findByEventId(eventId: string): Promise<Ticket[]> {
    this.logger.log('Finding tickets by event ID', TicketsService.name, {
      eventId,
    });
    await this.updateExpiredTickets();
    return this.ticketModel.find({ eventId }).populate('eventId').lean().exec();
  }

  async findById(ticketId: string): Promise<Ticket | null> {
    this.logger.log('Finding ticket by ID', TicketsService.name, {
      ticketId,
    });
    const ticket = await this.ticketModel
      .findById(ticketId)
      .populate('eventId')
      .lean()
      .exec();

    if (!ticket) {
      this.logger.warn('Ticket not found', TicketsService.name, { ticketId });
      throw new TicketNotFoundException(ticketId);
    }

    return ticket;
  }

  /**
   * Send receipt email asynchronously
   */
  private async sendReceiptEmailAsync(ticket: any, event: any): Promise<void> {
    try {
      this.logger.log('Starting receipt email process', TicketsService.name, {
        ticketId: ticket._id.toString(),
        email: ticket.buyerEmail,
        ticketNumber: ticket.ticketNumber,
        eventName: event.name,
      });

      // Use the already-generated QR code from the ticket (don't regenerate)
      const qrCode = ticket.qrCode;

      this.logger.log(
        'Calling emailService.sendTicketReceipt',
        TicketsService.name,
        {
          email: ticket.buyerEmail,
          ticketNumber: ticket.ticketNumber,
          eventName: event.name,
          totalAmount: ticket.totalPrice,
          attachPdf: true,
          hasQrCode: !!qrCode,
        },
      );

      await this.emailService.sendTicketReceipt(
        {
          email: ticket.buyerEmail,
          ticketNumber: ticket.ticketNumber,
          eventName: event.name,
          ticketType: ticket.ticketType,
          purchaseDate: new Date(ticket.createdAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          }),
          totalAmount: ticket.totalPrice,
          customerName: ticket.buyerName,
          eventDate: new Date(event.date),
          eventLocation: event.venue,
          qrCode, // Include the QR code data URL
        },
        {
          attachPdf: true, // Enable PDF attachment with receipt
        },
      );

      this.logger.log(
        'Receipt email queued successfully',
        TicketsService.name,
        {
          ticketId: ticket._id.toString(),
          email: ticket.buyerEmail,
        },
      );
    } catch (error) {
      this.logger.error(
        'Error queuing receipt email',
        TicketsService.name,
        error,
      );
      // Re-throw to be caught by the caller
      throw error;
    }
  }

  async findAll(): Promise<Ticket[]> {
    this.logger.log('Finding all tickets', TicketsService.name);
    await this.updateExpiredTickets();
    return this.ticketModel.find().populate('eventId').lean().exec();
  }

  async search(query: string): Promise<Ticket[]> {
    this.logger.log('Searching tickets', TicketsService.name, { query });
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
      .lean()
      .exec();
  }

  async markAsUsed(ticketId: string): Promise<Ticket | null> {
    this.logger.log('Marking ticket as used', TicketsService.name, {
      ticketId,
    });
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

  async validateByQRToken(encryptedToken: string): Promise<{
    success: boolean;
    message: string;
    ticket?: Ticket;
  }> {
    this.logger.log('Validating ticket by QR token', TicketsService.name);

    // Decrypt the token
    const plainToken = this.decryptQrToken(encryptedToken);
    if (!plainToken) {
      this.logger.warn('Failed to decrypt QR token', TicketsService.name);
      return {
        success: false,
        message: 'Invalid QR code format. Could not decrypt token.',
      };
    }

    // Find ticket by qrToken
    const ticket = await this.ticketModel
      .findOne({ qrToken: plainToken })
      .populate('eventId')
      .exec();

    if (!ticket) {
      this.logger.warn('Ticket not found by QR token', TicketsService.name);
      return {
        success: false,
        message: 'Ticket not found. This QR code is invalid.',
      };
    }

    // Check if ticket is expired (15 minutes after event start)
    const now = new Date();
    if (ticket.expiresAt && now > new Date(ticket.expiresAt)) {
      // Update status to expired if not already
      if (ticket.status !== TicketStatus.EXPIRED) {
        await this.ticketModel.findByIdAndUpdate(ticket._id, {
          status: TicketStatus.EXPIRED,
        });
        ticket.status = TicketStatus.EXPIRED;
      }
      this.logger.warn('Ticket expired', TicketsService.name, {
        ticketId: ticket._id.toString(),
      });
      return {
        success: false,
        message:
          'This ticket has expired. The 15-minute entry window has closed.',
        ticket,
      };
    }

    if (ticket.status === TicketStatus.USED) {
      this.logger.warn('Ticket already used', TicketsService.name, {
        ticketId: ticket._id.toString(),
        usedAt: ticket.usedAt?.toISOString(),
      });
      return {
        success: false,
        message: `This ticket has already been used on ${ticket.usedAt?.toLocaleString() || 'a previous date'}.`,
        ticket,
      };
    }

    if (ticket.status === TicketStatus.EXPIRED) {
      this.logger.warn('Ticket is expired', TicketsService.name, {
        ticketId: ticket._id.toString(),
      });
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

    this.logger.log('Ticket validated successfully', TicketsService.name, {
      ticketId: ticket._id.toString(),
      ticketNumber: ticket.ticketNumber,
    });

    return {
      success: true,
      message: 'Ticket validated successfully! Entry granted.',
      ticket: updatedTicket || ticket,
    };
  }

  async validateTicketByNumber(ticketNumber: string): Promise<{
    success: boolean;
    message: string;
    ticket?: Ticket;
  }> {
    this.logger.log('Validating ticket by number', TicketsService.name, {
      ticketNumber,
    });

    const ticket = await this.ticketModel
      .findOne({ ticketNumber })
      .populate('eventId')
      .exec();

    if (!ticket) {
      this.logger.warn('Ticket not found by number', TicketsService.name, {
        ticketNumber,
      });
      return {
        success: false,
        message: 'Ticket not found. This QR code is invalid.',
      };
    }

    // Check if ticket is expired (15 minutes after event start)
    const now = new Date();
    if (ticket.expiresAt && now > new Date(ticket.expiresAt)) {
      // Update status to expired if not already
      if (ticket.status !== TicketStatus.EXPIRED) {
        await this.ticketModel.findByIdAndUpdate(ticket._id, {
          status: TicketStatus.EXPIRED,
        });
        ticket.status = TicketStatus.EXPIRED;
      }
      this.logger.warn('Ticket expired', TicketsService.name, {
        ticketId: ticket._id.toString(),
      });
      return {
        success: false,
        message:
          'This ticket has expired. The 15-minute entry window has closed.',
        ticket,
      };
    }

    if (ticket.status === TicketStatus.USED) {
      this.logger.warn('Ticket already used', TicketsService.name, {
        ticketId: ticket._id.toString(),
        usedAt: ticket.usedAt?.toISOString(),
      });
      return {
        success: false,
        message: `This ticket has already been used on ${ticket.usedAt?.toLocaleString() || 'a previous date'}.`,
        ticket,
      };
    }

    if (ticket.status === TicketStatus.EXPIRED) {
      this.logger.warn('Ticket is expired', TicketsService.name, {
        ticketId: ticket._id.toString(),
      });
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

    this.logger.log('Ticket validated successfully', TicketsService.name, {
      ticketId: ticket._id.toString(),
      ticketNumber,
    });

    return {
      success: true,
      message: 'Ticket validated successfully! Entry granted.',
      ticket: updatedTicket || ticket,
    };
  }

  async findByTicketNumber(ticketNumber: string): Promise<Ticket | null> {
    this.logger.log('Finding ticket by number', TicketsService.name, {
      ticketNumber,
    });
    return this.ticketModel
      .findOne({ ticketNumber })
      .populate('eventId')
      .lean()
      .exec();
  }

  async delete(id: string): Promise<{ success: boolean; message: string }> {
    try {
      this.logger.log('Deleting ticket', TicketsService.name, { id });

      // Find the ticket to get event info and seat info BEFORE deleting
      const ticket = await this.ticketModel.findById(id).exec();
      if (!ticket) {
        throw new TicketNotFoundException(id);
      }

      const eventId = ticket.eventId.toString();

      // Get the event to check seating status BEFORE deleting
      // Note: Event may have been deleted already, which is OK - we just skip seat cleanup
      let event: any = null;
      try {
        event = await this.eventsService.findById(eventId);
      } catch (err) {
        // Event was deleted - that's OK, we'll skip seat cleanup
        this.logger.warn(
          'Event not found during ticket deletion',
          TicketsService.name,
          { eventId },
        );
      }

      // STEP 1: Unreserve seats if this is a seated event (only if event still exists)
      if (
        event?.seatingLayout?.enabled &&
        ticket.seats &&
        ticket.seats.length > 0
      ) {
        // Mark all seats as available again
        for (const seat of ticket.seats) {
          if (seat.sectionId && seat.seatId) {
            // Atomically mark the seat as available
            await this.seatsService
              .markSeatAvailable(eventId, seat.sectionId, seat.seatId)
              .catch(() => {
                // Silently ignore if seat cleanup fails (event may not exist)
                this.logger.warn(
                  'Could not mark seat available',
                  TicketsService.name,
                  {
                    eventId,
                    sectionId: seat.sectionId,
                    seatId: seat.seatId,
                  },
                );
              });
          }
        }
      }

      // STEP 2: Delete the ticket
      await this.ticketModel.findByIdAndDelete(id).exec();

      this.logger.log('Ticket deleted', TicketsService.name, { id });

      // Log the ticket deletion
      await this.logsService.createLog(LogAction.TICKET_DELETED, {
        ticketName: `Ticket #${ticket.ticketNumber}`,
        eventName: event?.name || 'Event Unknown',
        eventId: eventId,
        ticketId: id,
        metadata: {
          ticketType: ticket.ticketType,
          buyerEmail: ticket.buyerEmail,
        },
      }).catch(() => {
        // Don't let logging errors affect the deletion
        this.logger.warn(
          'Failed to log ticket deletion',
          TicketsService.name,
          { id },
        );
      });

      // STEP 3: Recalculate event counts (only if event still exists)
      if (event) {
        const updateData: any = {};

        // Recalculate soldTickets
        if (event.seatingLayout?.enabled) {
          // For seated events, count unavailable seats
          let unavailableSeatsCount = 0;
          let updatedEvent: any = null;
          try {
            updatedEvent = await this.eventsService.findById(eventId);
          } catch (err) {
            // Event no longer exists, skip seat counting
            this.logger.warn(
              'Event not found during seat count update',
              TicketsService.name,
              { eventId },
            );
          }
          if (updatedEvent?.seatingLayout) {
            for (const section of updatedEvent.seatingLayout.sections) {
              if (section.seats && Array.isArray(section.seats)) {
                unavailableSeatsCount += section.seats.filter(
                  (s) => s.status === 'unavailable',
                ).length;
              }
            }
          }
          updateData.soldTickets = unavailableSeatsCount;
        } else {
          // For non-seated events, count remaining tickets
          const ticketCountForEvent = await this.ticketModel.countDocuments({
            eventId: eventId,
          });
          updateData.soldTickets = ticketCountForEvent;
        }

        // Recalculate earlyBirdCount
        if (ticket.ticketType === 'EarlyBird') {
          const earlyBirdCountForEvent = await this.ticketModel.countDocuments({
            eventId: eventId,
            ticketType: 'EarlyBird',
          });
          updateData.earlyBirdCount = earlyBirdCountForEvent;
        }

        // STEP 4: Update the event
        if (Object.keys(updateData).length > 0) {
          await this.eventsService.update(eventId, updateData).catch(() => {
            // Silently ignore if event update fails (event may have been deleted)
            this.logger.warn(
              'Could not update event counts',
              TicketsService.name,
              { eventId },
            );
          });
        }
      }

      return {
        success: true,
        message: 'Ticket deleted successfully and availability counts updated',
      };
    } catch (error) {
      // If event wasn't found, that's OK - ticket still got deleted
      if (
        error?.response?.statusCode === 404 ||
        (error instanceof Error && error.message?.includes('not found'))
      ) {
        this.logger.warn(
          'Event was deleted but ticket deletion succeeded',
          TicketsService.name,
          {
            id,
            errorMessage: error?.message,
          },
        );
        return {
          success: true,
          message: 'Ticket deleted successfully (event was already deleted)',
        };
      }

      // Only re-throw TicketNotFound errors
      if (error instanceof TicketNotFoundException) {
        throw error;
      }

      // For any other error, log it and re-throw
      this.logger.error('Error deleting ticket', TicketsService.name, {
        id,
        error,
      });
      throw error;
    }
  }
}
