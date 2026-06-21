import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';

import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ScheduleService } from './schedule.service';
import { PublicProfileService } from './public-profile.service';
import { CreateAvailabilityDto } from './dto/create-availability.dto';
import { CreatePublicAppointmentDto } from './dto/create-public-appointment.dto';
import { UpdateAppointmentStatusDto } from './dto/update-appointment-status.dto';
import { CreateScheduleEventDto } from './dto/create-schedule-event.dto';
import { UpdateScheduleEventDto } from './dto/update-schedule-event.dto';
import { UpdatePublicProfileDto } from './dto/update-public-profile.dto';

@Controller('schedule')
export class ScheduleController {
  constructor(
    private readonly scheduleService: ScheduleService,
    private readonly publicProfileService: PublicProfileService,
  ) {}

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
  createAvailability(@Body() dto: CreateAvailabilityDto, @CurrentUser() user: any) {
    dto.professionalId = user.id;
    return this.scheduleService.createAvailability(dto);
  }

  @Delete('availabilities/:id')
  deleteAvailability(@Param('id') id: string, @CurrentUser() user: any) {
    return this.scheduleService.deleteAvailability(id, user.id);
  }

  @Delete('availabilities/:id/slots')
  removeTimeSlot(@Param('id') id: string, @Query('time') time: string, @CurrentUser() user: any) {
    return this.scheduleService.removeTimeSlot(id, time, user.id);
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
  deletePublicAppointment(@Param('id') id: string, @CurrentUser() user: any) {
    return this.scheduleService.deletePublicAppointment(id, user.id);
  }

  @Patch('appointments/:id/status')
  updateAppointmentStatus(
    @Param('id') id: string,
    @Body() dto: UpdateAppointmentStatusDto,
    @CurrentUser() user: any,
  ) {
    return this.scheduleService.updateAppointmentStatus(id, dto, user.id);
  }

  // ─── Schedule Events ───────────────────────────────────────────────────────

  @Get('events')
  getScheduleEvents(@CurrentUser() user: any) {
    // Schedule events usam email como professionalId
    return this.scheduleService.getScheduleEvents(user.email);
  }

  @Post('events')
  createScheduleEvent(@Body() dto: CreateScheduleEventDto, @CurrentUser() user: any) {
    // Schedule events usam email como professionalId
    dto.professionalId = user.email;
    return this.scheduleService.createScheduleEvent(dto);
  }

  @Patch('events/:id')
  updateScheduleEvent(
    @Param('id') id: string,
    @Body() dto: UpdateScheduleEventDto,
    @CurrentUser() user: any,
  ) {
    return this.scheduleService.updateScheduleEvent(id, dto, user.email);
  }

  @Delete('events/:id')
  deleteScheduleEvent(@Param('id') id: string, @CurrentUser() user: any) {
    return this.scheduleService.deleteScheduleEvent(id, user.email);
  }

  // ─── Public Profile ────────────────────────────────────────────────────────

  @Get('profile/public')
  getPublicProfile(@CurrentUser('id') userId: string) {
    return this.publicProfileService.getPublicProfile(userId);
  }

  @Public()
  @Get('profile/public/:professionalId')
  getPublicProfileByProfessional(@Param('professionalId') professionalId: string) {
    if (professionalId.includes('@')) {
      return this.publicProfileService.getPublicProfileByEmail(professionalId);
    }
    return this.publicProfileService.getPublicProfile(professionalId);
  }

  @Patch('profile/public')
  updatePublicProfile(@CurrentUser('id') userId: string, @Body() dto: UpdatePublicProfileDto) {
    return this.publicProfileService.updatePublicProfile(userId, dto);
  }
}
