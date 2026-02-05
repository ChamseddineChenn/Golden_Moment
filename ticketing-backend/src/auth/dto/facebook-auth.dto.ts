import { IsNotEmpty, IsString } from 'class-validator';

export class FacebookAuthDto {
  @IsNotEmpty()
  @IsString()
  accessToken: string;
}
