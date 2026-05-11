import { IsDateString, IsEmail, IsString } from 'class-validator';

export class CreatePatientDto {
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  phone: string;

  @IsDateString()
  birthdate: string;
}
