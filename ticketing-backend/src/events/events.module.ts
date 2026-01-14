import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { Event, EventSchema } from './event.schema';
import { SeatsService } from './seats.service';
import { SeatsController } from './seats.controller';
import { TicketsModule } from '../tickets/tickets.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Event.name, schema: EventSchema }]),
    TicketsModule,
  ],
  controllers: [EventsController, SeatsController],
  providers: [EventsService, SeatsService],
  exports: [EventsService, SeatsService],
})
export class EventsModule {}
