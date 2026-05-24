import { IsDateString, IsEmail, IsOptional, IsString } from 'class-validator';

export class CreatePatientDto {
  @IsString()
  name: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  phone: string;

  @IsDateString()
  birthdate: string;
}
