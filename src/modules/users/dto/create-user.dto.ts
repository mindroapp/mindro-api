import { IsEmail, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsString()
  fullName: string;

  @IsEmail()
  email: string;

  @Matches(/^\d{10,11}$/)
  phone: string;

  @MinLength(8)
  password: string;

  @MinLength(8)
  confirmPassword: string;

  @IsString()
  profession: string;

  @IsString()
  professionalRegister: string;

  @IsOptional()
  @IsString()
  professionalCouncil?: string;
}
