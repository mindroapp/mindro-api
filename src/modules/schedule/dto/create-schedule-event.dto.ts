import { IsDateString, IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { ScheduleEventStatus } from '@prisma/client';

export class CreateScheduleEventDto {
  @IsString()
  patientId: string;

  @IsString()
  patientName: string;

  @IsOptional()
  @IsString()
  patientPhone?: string;

  @IsDateString()
  date: string;

  @IsNumber()
  duration: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsEnum(ScheduleEventStatus)
  status?: ScheduleEventStatus;

  @IsOptional()
  @IsString()
  videoLink?: string;

  @IsString()
  professionalId: string;
}
