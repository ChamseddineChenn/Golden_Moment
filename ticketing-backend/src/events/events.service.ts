import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Event } from './event.schema';
import { CreateEventDto } from './dto/create-event.dto';
import { SeatsService } from './seats.service';

@Injectable()
export class EventsService {
  constructor(
    @InjectModel(Event.name) private eventModel: Model<Event>,
    private seatsService: SeatsService,
  ) {}

  async create(createEventDto: CreateEventDto): Promise<Event> {
    const createdEvent = new this.eventModel(createEventDto);
    const savedEvent = await createdEvent.save();

    // If seating is enabled, initialize the seat matrix
    if (
      createEventDto.seatingLayout?.enabled &&
      createEventDto.seatingLayout?.sections?.length > 0
    ) {
      await this.seatsService.initializeSeats(
        savedEvent._id.toString(),
        createEventDto.seatingLayout.sections,
      );
      // Reload the event to get the initialized seating
      const reloadedEvent = await this.eventModel
        .findById(savedEvent._id)
        .exec();
      return reloadedEvent || savedEvent;
    }

    return savedEvent;
  }

  async findAll(): Promise<Event[]> {
    return this.eventModel.find({ isActive: true }).exec();
  }

  async findById(id: string): Promise<Event | null> {
    return this.eventModel.findById(id).exec();
  }

  async update(id: string, updateData: Partial<Event>): Promise<Event | null> {
    return this.eventModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .exec();
  }

  async delete(id: string): Promise<void> {
    await this.eventModel.findByIdAndDelete(id).exec();
  }
}
