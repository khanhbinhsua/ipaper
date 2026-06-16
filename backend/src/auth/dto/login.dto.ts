import { IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  username: string;

  @IsString()
  @MinLength(1)
  password: string;

  @IsString()
  tenantSlug: string; // xác định tenant khi đăng nhập
}
