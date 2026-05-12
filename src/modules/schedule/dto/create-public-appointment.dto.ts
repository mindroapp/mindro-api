import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class CreatePublicAppointmentDto {
  @IsString()
  availabilityId: string;

  @IsString()
  date: string;

  @IsString()
  time: string;

  @IsString()
  patientName: string;

  @IsString()
  patientPhone: string;

  @IsOptional()
  @IsString()
  patientEmail?: string;

  @IsOptional()
  @IsString()
  patientBirthDate?: string;

  @IsOptional()
  @IsBoolean()
  isFirstTime?: boolean;

  @IsString()
  professionalId: string;
}
