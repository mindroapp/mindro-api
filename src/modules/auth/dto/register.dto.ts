import { IsEmail, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  fullName: string;

  @IsEmail()
  email: string;

  @Matches(/^\d{10,11}$/, { message: 'phone must contain 10 or 11 digits' })
  phone: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  @MinLength(6)
  confirmPassword: string;

  @IsString()
  profession: string;

  @IsString()
  professionalRegister: string;

  @IsOptional()
  @IsString()
  professionalCouncil?: string;
}
