import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsString, ValidateNested, ArrayMinSize } from 'class-validator';

export class TimeSlotDto {
  @IsString()
  time: string;

  @IsBoolean()
  available: boolean;
}

export class CreateAvailabilityDto {
  @IsString()
  date: string;

  @IsString()
  professionalId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TimeSlotDto)
  timeSlots: TimeSlotDto[];
}
