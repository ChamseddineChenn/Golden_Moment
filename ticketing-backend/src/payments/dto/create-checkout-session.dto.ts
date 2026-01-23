import {
  IsString,
  IsNumber,
  IsArray,
  IsOptional,
  IsNotEmpty,
} from 'class-validator';

export class CreateCheckoutSessionDto {
  @IsString()
  @IsNotEmpty()
  eventId: string;

  @IsArray()
  @IsNotEmpty()
  ticketIds: any[];

  @IsNumber()
  @IsNotEmpty()
  totalAmount: number;

  @IsOptional()
  @IsString()
  buyerEmail?: string;

  @IsOptional()
  @IsString()
  buyerName?: string;

  @IsOptional()
  @IsString()
  buyerPhoneNumber?: string;

  @IsOptional()
  @IsString()
  ticketType?: string;

  @IsOptional()
  @IsString()
  successUrl?: string;

  @IsOptional()
  @IsString()
  cancelUrl?: string;
}
