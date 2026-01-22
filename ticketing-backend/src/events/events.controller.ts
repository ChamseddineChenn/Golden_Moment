import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Delete,
  Put,
  BadRequestException,
} from '@nestjs/common';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { Public } from '../auth/decorators/public.decorator';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}
  @Public()
  @Post()
  async create(@Body() createEventDto: CreateEventDto) {
    try {
      console.log(
        '[EventsController] POST /events received data:',
        JSON.stringify(createEventDto, null, 2),
      );
      const result = await this.eventsService.create(createEventDto);
      console.log('[EventsController] Event created successfully:', result._id);
      return result;
    } catch (error) {
      console.error('[EventsController] Error creating event:');
      if (error instanceof Error) {
        console.error('  Message:', error.message);
        console.error('  Stack:', error.stack);
        console.error('  Name:', error.name);
      } else {
        console.error('  Error object:', error);
      }
      throw new BadRequestException(
        `Failed to create event: ${error instanceof Error ? error.message : JSON.stringify(error)}`,
      );
    }
  }

  @Public()
  @Get()
  async findAll() {
    // Public endpoint - only show published events
    return this.eventsService.findAllPublished();
  }
  @Public()
  @Get('admin/all')
  async findAllAdmin() {
    // Admin endpoint - show all events including drafts
    return this.eventsService.findAllAdmin();
  }

  @Public()
  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.eventsService.findById(id);
  }
  @Public()
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateEventDto: UpdateEventDto,
  ) {
    return this.eventsService.update(id, updateEventDto as any);
  }
  @Public()
  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.eventsService.delete(id);
  }
}
