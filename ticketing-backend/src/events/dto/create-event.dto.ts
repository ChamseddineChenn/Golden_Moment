export class CreateEventDto {
  name: string;
  description?: string;
  date: Date;
  venue: string;
  totalSeats: number;
  seatingLayout?: Record<string, any>;
  category?: string;
}
