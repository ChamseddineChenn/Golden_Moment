import {
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';

export class EventNotFoundException extends NotFoundException {
  constructor(id: string) {
    super(`Event with ID ${id} not found`);
  }
}

export class TicketNotFoundException extends NotFoundException {
  constructor(id: string) {
    super(`Ticket with ID ${id} not found`);
  }
}

export class EventAlreadyExistsException extends BadRequestException {
  constructor(name: string) {
    super(`Event with name "${name}" already exists`);
  }
}

export class InvalidTicketTypeException extends BadRequestException {
  constructor(type: string) {
    super(`Invalid ticket type: ${type}`);
  }
}

export class CloudinaryUploadException extends InternalServerErrorException {
  constructor(message: string) {
    super(`Failed to upload image to Cloudinary: ${message}`);
  }
}

export class SeatUnavailableException extends BadRequestException {
  constructor(message?: string) {
    super(message || 'Seat is not available');
  }
}

export class EarlyBirdSoldOutException extends BadRequestException {
  constructor() {
    super('Early Bird tickets are sold out');
  }
}

export class PastEventException extends BadRequestException {
  constructor() {
    super('Cannot purchase tickets for past events');
  }
}
