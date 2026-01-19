import { Role } from '../../users/enums/role.enum';

export class AuthResponseDto {
  success: boolean;
  message: string;
  user: {
    id: string;
    email: string;
    role: Role;
  };
}
