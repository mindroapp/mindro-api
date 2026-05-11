import { IsString } from 'class-validator';

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

  @IsString()
  professionalId: string;
}
