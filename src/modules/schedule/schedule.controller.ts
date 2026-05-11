import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';

import { Public } from '../auth/decorators/public.decorator';
import { ScheduleService } from './schedule.service';
import { CreateAvailabilityDto } from './dto/create-availability.dto';
import { CreatePublicAppointmentDto } from './dto/create-public-appointment.dto';
import { UpdateAppointmentStatusDto } from './dto/update-appointment-status.dto';
import { CreateScheduleEventDto } from './dto/create-schedule-event.dto';
import { UpdateScheduleEventDto } from './dto/update-schedule-event.dto';

@Controller('schedule')
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  // ─── Availabilities ────────────────────────────────────────────────────────

  @Public()
  @Get('availabilities')
  getAvailabilities(
    @Query('professionalId') professionalId: string,
    @Query('month') month?: string,
  ) {
    return this.scheduleService.getAvailabilities(professionalId, month);
  }

  @Post('availabilities')
  createAvailability(@Body() dto: CreateAvailabilityDto) {
    return this.scheduleService.createAvailability(dto);
  }

  @Delete('availabilities/:id')
  deleteAvailability(@Param('id') id: string) {
    return this.scheduleService.deleteAvailability(id);
  }

  @Delete('availabilities/:id/slots')
  removeTimeSlot(@Param('id') id: string, @Query('time') time: string) {
    return this.scheduleService.removeTimeSlot(id, time);
  }

  // ─── Public Appointments ───────────────────────────────────────────────────

  @Public()
  @Get('appointments')
  getPublicAppointments(@Query('professionalId') professionalId: string) {
    return this.scheduleService.getPublicAppointments(professionalId);
  }

  @Public()
  @Post('appointments')
  createPublicAppointment(@Body() dto: CreatePublicAppointmentDto) {
    return this.scheduleService.createPublicAppointment(dto);
  }

  @Delete('appointments/:id')
  deletePublicAppointment(@Param('id') id: string) {
    return this.scheduleService.deletePublicAppointment(id);
  }

  @Patch('appointments/:id/status')
  updateAppointmentStatus(@Param('id') id: string, @Body() dto: UpdateAppointmentStatusDto) {
    return this.scheduleService.updateAppointmentStatus(id, dto);
  }

  // ─── Schedule Events ───────────────────────────────────────────────────────

  @Get('events')
  getScheduleEvents(@Query('professionalId') professionalId: string) {
    return this.scheduleService.getScheduleEvents(professionalId);
  }

  @Post('events')
  createScheduleEvent(@Body() dto: CreateScheduleEventDto) {
    return this.scheduleService.createScheduleEvent(dto);
  }

  @Patch('events/:id')
  updateScheduleEvent(@Param('id') id: string, @Body() dto: UpdateScheduleEventDto) {
    return this.scheduleService.updateScheduleEvent(id, dto);
  }

  @Delete('events/:id')
  deleteScheduleEvent(@Param('id') id: string) {
    return this.scheduleService.deleteScheduleEvent(id);
  }
}
