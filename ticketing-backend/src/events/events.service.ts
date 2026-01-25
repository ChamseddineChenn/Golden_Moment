import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Event } from './event.schema';
import { CreateEventDto } from './dto/create-event.dto';
import { SeatsService } from './seats.service';
import { UploadService } from '../upload/upload.service';
import { AppLogger } from '../common/utils/logger';
import {
  EventNotFoundException,
  PastEventException,
} from '../common/exceptions/custom-exceptions';

@Injectable()
export class EventsService {
  private readonly logger = new AppLogger(EventsService.name);

  constructor(
    @InjectModel(Event.name) private eventModel: Model<Event>,
    private seatsService: SeatsService,
    private uploadService: UploadService,
  ) {}

  async create(createEventDto: CreateEventDto): Promise<Event> {
    try {
      this.logger.log('Creating event', EventsService.name, {
        name: createEventDto.name,
      });

      // Ensure category is set, default to 'Concert' if not provided
      let eventData: any = {
        ...createEventDto,
        category: createEventDto.category || 'Concert',
      };

      // Convert date to Date object if it's a string
      if (typeof eventData.date === 'string') {
        eventData.date = new Date(eventData.date);
      }

      // Calculate totalSeats from seating layout if not provided
      if (!eventData.totalSeats && eventData.seatingLayout?.sections) {
        eventData.totalSeats = eventData.seatingLayout.sections.reduce(
          (total: number, section: any) => {
            return total + (section.columns || 0) * (section.rows || 0);
          },
          0,
        );
        this.logger.log(
          'Calculated totalSeats from seating layout',
          EventsService.name,
          { totalSeats: eventData.totalSeats },
        );
      } else if (!eventData.totalSeats) {
        // Default to 0 if not provided and no seating layout
        eventData.totalSeats = 0;
      }

      // Ensure ticketTypes has the proper structure
      if (!eventData.ticketTypes) {
        eventData.ticketTypes = {
          Free: { enabled: true, price: 0 },
          Standard: { enabled: false, price: 0 },
          EarlyBird: { enabled: false, price: 0, limit: 0 },
          VIP: { enabled: false, price: 0 },
        };
      } else {
        // Fill in any missing ticketType fields
        eventData.ticketTypes = {
          Free: eventData.ticketTypes.Free || {
            enabled: true,
            price: 0,
          },
          Standard: eventData.ticketTypes.Standard || {
            enabled: false,
            price: 0,
          },
          EarlyBird: eventData.ticketTypes.EarlyBird || {
            enabled: false,
            price: 0,
            limit: 0,
          },
          VIP: eventData.ticketTypes.VIP || {
            enabled: false,
            price: 0,
          },
        };
      }

      this.logger.log('Processed event data', EventsService.name, {
        name: createEventDto.name,
        category: eventData.category,
        hasSeating: !!eventData.seatingLayout?.enabled,
      });

      const createdEvent = new this.eventModel(eventData);
      const savedEvent = await createdEvent.save();

      this.logger.log('Event saved successfully', EventsService.name, {
        id: savedEvent._id.toString(),
        name: savedEvent.name,
      });

      // If seating is enabled, initialize the seat matrix
      if (
        createEventDto.seatingLayout?.enabled &&
        createEventDto.seatingLayout?.sections?.length > 0
      ) {
        this.logger.log('Initializing seats for event', EventsService.name, {
          eventId: savedEvent._id.toString(),
          sections: createEventDto.seatingLayout.sections.length,
        });
        await this.seatsService.initializeSeats(
          savedEvent._id.toString(),
          createEventDto.seatingLayout.sections,
        );
        // Reload the event to get the initialized seating
        const reloadedEvent = await this.eventModel
          .findById(savedEvent._id)
          .lean()
          .exec();

        this.logger.log(
          'Reloaded event after seat initialization',
          EventsService.name,
          {
            eventId: savedEvent._id.toString(),
            hasTicketTypes: !!reloadedEvent?.ticketTypes,
            ticketTypesCount: reloadedEvent?.ticketTypes
              ? Object.keys(reloadedEvent.ticketTypes).length
              : 0,
          },
        );

        return reloadedEvent || JSON.parse(JSON.stringify(savedEvent));
      }

      return JSON.parse(JSON.stringify(savedEvent));
    } catch (error) {
      this.logger.error('Error creating event', EventsService.name, error);
      throw error;
    }
  }

  async findAll(): Promise<Event[]> {
    try {
      const events = await this.eventModel
        .find({ isActive: true })
        .lean()
        .exec();
      this.logger.log('Retrieved all active events', EventsService.name, {
        count: events.length,
      });
      return events;
    } catch (error) {
      this.logger.error('Error fetching all events', EventsService.name, error);
      throw error;
    }
  }

  async findAllPublished(): Promise<Event[]> {
    try {
      // Only return published events (hide drafts from customers)
      let events = await this.eventModel
        .find({ isActive: true, isDraft: false })
        .lean()
        .exec();

      // Ensure all events have totalSeats calculated
      events = events.map((event: any) => {
        if (!event.totalSeats || event.totalSeats === 0) {
          if (
            event.seatingLayout?.sections &&
            Array.isArray(event.seatingLayout.sections)
          ) {
            event.totalSeats = event.seatingLayout.sections.reduce(
              (total: number, section: any) => {
                // Sections have their own rows/columns that need multiplication
                if (section.rows && section.columns) {
                  return total + section.columns * section.rows;
                }
                // Or if they already have seats array, count those
                return total + (section.seats?.length || 0);
              },
              0,
            );
          } else {
            event.totalSeats = 0;
          }
        }
        return event;
      });

      this.logger.log('Retrieved published events', EventsService.name, {
        count: events.length,
      });
      return events;
    } catch (error) {
      this.logger.error(
        'Error fetching published events',
        EventsService.name,
        error,
      );
      throw error;
    }
  }

  async findAllAdmin(): Promise<Event[]> {
    try {
      // Return all events for admin (including drafts, excluding inactive)
      let events = await this.eventModel.find({ isActive: true }).lean().exec();

      // Ensure all events have totalSeats calculated
      events = events.map((event: any) => {
        if (!event.totalSeats || event.totalSeats === 0) {
          if (
            event.seatingLayout?.sections &&
            Array.isArray(event.seatingLayout.sections)
          ) {
            event.totalSeats = event.seatingLayout.sections.reduce(
              (total: number, section: any) => {
                // Sections have their own rows/columns that need multiplication
                if (section.rows && section.columns) {
                  return total + section.columns * section.rows;
                }
                // Or if they already have seats array, count those
                return total + (section.seats?.length || 0);
              },
              0,
            );
          } else {
            event.totalSeats = 0;
          }
        }
        return event;
      });

      this.logger.log('Retrieved admin events', EventsService.name, {
        count: events.length,
        drafts: events.filter((e) => e.isDraft).length,
      });
      return events;
    } catch (error) {
      this.logger.error(
        'Error fetching admin events',
        EventsService.name,
        error,
      );
      throw error;
    }
  }

  async findById(id: string): Promise<Event | null> {
    try {
      let event = await this.eventModel.findById(id).lean().exec();

      if (!event) {
        throw new EventNotFoundException(id);
      }

      if (event && (!event.totalSeats || event.totalSeats === 0)) {
        if (
          (event as any).seatingLayout?.sections &&
          Array.isArray((event as any).seatingLayout.sections)
        ) {
          (event as any).totalSeats = (
            event as any
          ).seatingLayout.sections.reduce((total: number, section: any) => {
            // Sections have their own rows/columns that need multiplication
            if (section.rows && section.columns) {
              return total + section.columns * section.rows;
            }
            // Or if they already have seats array, count those
            return total + (section.seats?.length || 0);
          }, 0);
        } else {
          (event as any).totalSeats = 0;
        }
      }

      // DEBUG LOGGING FOR TICKET TYPES
      console.log(`[EventsService.findById] Event ${id}:`, {
        name: event.name,
        hasTicketTypes: !!event.ticketTypes,
        ticketTypesKeys: event.ticketTypes
          ? Object.keys(event.ticketTypes)
          : null,
        ticketTypes: event.ticketTypes,
      });

      this.logger.log('Retrieved event by ID', EventsService.name, {
        id,
        name: event.name,
      });
      return event;
    } catch (error) {
      if (error instanceof EventNotFoundException) {
        throw error;
      }
      this.logger.error('Error fetching event by ID', EventsService.name, {
        id,
        error,
      });
      throw error;
    }
  }

  async update(
    id: string,
    updateData: Partial<Event> | any,
    skipLogging: boolean = false,
  ): Promise<Event | null> {
    try {
      // Verify event exists
      const eventExists = await this.eventModel.findById(id).exec();
      if (!eventExists) {
        throw new EventNotFoundException(id);
      }

      // Convert date to Date object if it's a string
      if (updateData.date && typeof updateData.date === 'string') {
        updateData.date = new Date(updateData.date);
      }

      // Ensure ticketTypes has proper structure if provided
      if (updateData.ticketTypes) {
        updateData.ticketTypes = {
          Free: updateData.ticketTypes.Free || {
            enabled: true,
            price: 0,
          },
          Standard: updateData.ticketTypes.Standard || {
            enabled: false,
            price: 0,
          },
          EarlyBird: updateData.ticketTypes.EarlyBird || {
            enabled: false,
            price: 0,
            limit: 0,
          },
          VIP: updateData.ticketTypes.VIP || {
            enabled: false,
            price: 0,
          },
        };
      }

      // Calculate totalSeats from seatingLayout if provided
      if (!updateData.totalSeats && updateData.seatingLayout?.sections) {
        updateData.totalSeats = updateData.seatingLayout.sections.reduce(
          (total: number, section: any) =>
            total + section.columns * section.rows,
          0,
        );
      }

      // Initialize seats for sections that don't have them
      if (updateData.seatingLayout?.sections) {
        updateData.seatingLayout.sections =
          updateData.seatingLayout.sections.map(
            (section: any, sectionIndex: number) => {
              // If section already has seats, keep them
              if (
                section.seats &&
                Array.isArray(section.seats) &&
                section.seats.length > 0
              ) {
                return section;
              }
              // Otherwise, generate new seat matrix
              return {
                ...section,
                seats: this.generateSeatMatrix(section, sectionIndex + 1),
              };
            },
          );
      }

      this.logger.log('Updating event', EventsService.name, { id });
      const updated = await this.eventModel
        .findByIdAndUpdate(id, updateData, { new: true })
        .lean()
        .exec();

      this.logger.log('Event updated successfully', EventsService.name, {
        id,
        name: updated?.name,
      });

      return updated;
    } catch (error) {
      if (error instanceof EventNotFoundException) {
        throw error;
      }
      this.logger.error('Error updating event', EventsService.name, {
        id,
        error,
      });
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      // Fetch the event to get its cover image public_id
      const event = await this.eventModel.findById(id).exec();

      if (!event) {
        throw new EventNotFoundException(id);
      }

      if (event && event.coverImage) {
        let publicId = event.coverImagePublicId;

        // If public_id is not stored, try to extract it from the URL
        // Cloudinary URLs: https://res.cloudinary.com/{cloud}/{type}/upload/{public_id}
        if (!publicId && event.coverImage.includes('cloudinary.com')) {
          try {
            const urlParts = event.coverImage.split('/upload/');
            if (urlParts.length > 1) {
              // Get everything after /upload/ and remove file extension
              publicId = urlParts[1].split('.')[0];
              this.logger.log(
                'Extracted public_id from URL',
                EventsService.name,
                { publicId },
              );
            }
          } catch (error) {
            this.logger.warn(
              'Could not extract public_id from URL',
              EventsService.name,
              { url: event.coverImage, error },
            );
          }
        }

        if (publicId) {
          // Delete the cover image from Cloudinary
          this.logger.log(
            'Deleting image from Cloudinary',
            EventsService.name,
            { publicId },
          );
          await this.uploadService.deleteImage(publicId);
        }
      }

      // Delete the event from database
      await this.eventModel.findByIdAndDelete(id).exec();
      this.logger.log('Event deleted successfully', EventsService.name, { id });
    } catch (error) {
      if (error instanceof EventNotFoundException) {
        throw error;
      }
      this.logger.error('Error deleting event', EventsService.name, {
        id,
        error,
      });
      throw error;
    }
  }

  private generateSeatMatrix(section: any, sectionNumber: number) {
    const seats: any[] = [];
    const rows = section.rows || 10;
    const columns = section.columns || 10;
    const startRow = section.startRow || 1;
    const startCol = section.startCol || 'A';

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        seats.push({
          seatId: `S${sectionNumber}-${String.fromCharCode(startCol.charCodeAt(0) + col)}${startRow + row}`,
          row: startRow + row,
          column: String.fromCharCode(startCol.charCodeAt(0) + col),
          status: 'available',
          reservingUntil: undefined,
        });
      }
    }

    return seats;
  }
}
