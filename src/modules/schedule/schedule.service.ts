import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ReminderType } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service.js';
import { ReminderService } from '../messaging/reminder.service';
import { CreateAvailabilityDto } from './dto/create-availability.dto';
import { CreatePublicAppointmentDto } from './dto/create-public-appointment.dto';
import { UpdateAppointmentStatusDto } from './dto/update-appointment-status.dto';
import { CreateScheduleEventDto } from './dto/create-schedule-event.dto';
import { UpdateScheduleEventDto } from './dto/update-schedule-event.dto';

@Injectable()
export class ScheduleService {
  private readonly logger = new Logger(ScheduleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reminderService: ReminderService,
  ) {}

  // ─── Availabilities ────────────────────────────────────────────────────────

  async getAvailabilities(professionalId: string, month?: string) {
    return this.prisma.availability.findMany({
      where: {
        professionalId,
        ...(month ? { date: { startsWith: month } } : {}),
      },
      include: { timeSlots: { orderBy: { time: 'asc' } } },
      orderBy: { date: 'asc' },
    });
  }

  async createAvailability(dto: CreateAvailabilityDto) {
    const existing = await this.prisma.availability.findUnique({
      where: { date_professionalId: { date: dto.date, professionalId: dto.professionalId } },
    });

    if (existing) {
      throw new BadRequestException(
        `Já existe uma agenda para a data ${dto.date}. Exclua a existente antes de criar uma nova.`,
      );
    }

    return this.prisma.availability.create({
      data: {
        date: dto.date,
        professionalId: dto.professionalId,
        timeSlots: {
          create: dto.timeSlots.map((slot) => ({
            time: slot.time,
            available: slot.available,
          })),
        },
      },
      include: { timeSlots: { orderBy: { time: 'asc' } } },
    });
  }

  async deleteAvailability(id: string, professionalId: string) {
    const availability = await this.prisma.availability.findUnique({
      where: { id },
      include: { appointments: true },
    });

    if (!availability) {
      throw new NotFoundException('Agenda não encontrada');
    }

    if (availability.professionalId !== professionalId) {
      throw new ForbiddenException('Acesso negado');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const availabilityDate = new Date(`${availability.date}T00:00:00`);
    if (availabilityDate < today) {
      throw new BadRequestException('Não é possível excluir agendas de datas passadas');
    }

    if (availability.appointments.length > 0) {
      throw new BadRequestException(
        'Esta agenda possui agendamentos vinculados e não pode ser excluída',
      );
    }

    await this.prisma.availability.delete({ where: { id } });
    return { success: true };
  }

  async removeTimeSlot(availabilityId: string, time: string, professionalId: string) {
    const availability = await this.prisma.availability.findUnique({
      where: { id: availabilityId },
    });

    if (!availability) {
      throw new NotFoundException('Agenda não encontrada');
    }

    if (availability.professionalId !== professionalId) {
      throw new ForbiddenException('Acesso negado');
    }

    const timeSlot = await this.prisma.timeSlot.findUnique({
      where: { availabilityId_time: { availabilityId, time } },
    });

    if (!timeSlot) {
      throw new NotFoundException('Horário não encontrado');
    }

    await this.prisma.publicAppointment.deleteMany({
      where: { availabilityId, time },
    });

    await this.prisma.timeSlot.delete({
      where: { availabilityId_time: { availabilityId, time } },
    });

    return this.prisma.availability.findUnique({
      where: { id: availabilityId },
      include: { timeSlots: { orderBy: { time: 'asc' } } },
    });
  }

  // ─── Public Appointments ───────────────────────────────────────────────────

  async getPublicAppointments(professionalId: string) {
    return this.prisma.publicAppointment.findMany({
      where: { professionalId },
      orderBy: [{ date: 'asc' }, { time: 'asc' }],
    });
  }

  async createPublicAppointment(dto: CreatePublicAppointmentDto) {
    const availability = await this.prisma.availability.findUnique({
      where: { id: dto.availabilityId },
      include: { timeSlots: true },
    });

    if (!availability) {
      throw new NotFoundException('Agenda não encontrada');
    }

    const slot = availability.timeSlots.find((s) => s.time === dto.time);
    if (!slot) {
      throw new BadRequestException('Horário não encontrado na agenda');
    }

    if (!slot.available) {
      throw new BadRequestException('Este horário não está disponível');
    }

    const existing = await this.prisma.publicAppointment.findFirst({
      where: { availabilityId: dto.availabilityId, time: dto.time },
    });

    if (existing) {
      throw new BadRequestException('Este horário já está reservado');
    }

    const data: any = { ...dto };

    if (dto.patientBirthDate) {
      data.patientBirthDate = new Date(dto.patientBirthDate);
    }

    const appointment = await this.prisma.$transaction(async (tx) => {
      const newAppointment = await tx.publicAppointment.create({ data });

      await tx.timeSlot.update({
        where: { availabilityId_time: { availabilityId: dto.availabilityId, time: dto.time } },
        data: { available: false },
      });

      return newAppointment;
    });

    // Agendar reminder — fire and forget, não bloqueia a resposta
    this.schedulePublicAppointmentReminder(appointment).catch((err) =>
      this.logger.warn(`Falha ao agendar reminder: ${err.message}`),
    );

    return appointment;
  }

  private async schedulePublicAppointmentReminder(appointment: {
    id: string;
    patientName: string;
    patientPhone: string;
    professionalId: string;
    date: string;
    time: string;
  }): Promise<void> {
    const professional = await this.prisma.user.findUnique({
      where: { id: appointment.professionalId },
      select: { fullName: true },
    });

    await this.reminderService.scheduleForPublicAppointment({
      appointmentId: appointment.id,
      patientName: appointment.patientName,
      patientPhone: appointment.patientPhone,
      professionalId: appointment.professionalId,
      professionalName: professional?.fullName ?? 'Profissional',
      date: appointment.date,
      time: appointment.time,
    });
  }

  async deletePublicAppointment(id: string, professionalId: string) {
    const appointment = await this.prisma.publicAppointment.findUnique({ where: { id } });

    if (!appointment) {
      throw new NotFoundException('Agendamento não encontrado');
    }

    if (appointment.professionalId !== professionalId) {
      throw new ForbiddenException('Acesso negado');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.publicAppointment.delete({ where: { id } });

      await tx.timeSlot.update({
        where: {
          availabilityId_time: {
            availabilityId: appointment.availabilityId,
            time: appointment.time,
          },
        },
        data: { available: true },
      });
    });

    // Cancelar reminder pendente
    this.reminderService.cancelForAppointment(id, ReminderType.PUBLIC_APPOINTMENT).catch(() => {});

    return { success: true };
  }

  async updateAppointmentStatus(
    id: string,
    dto: UpdateAppointmentStatusDto,
    professionalId: string,
  ) {
    const appointment = await this.prisma.publicAppointment.findUnique({ where: { id } });

    if (!appointment) {
      throw new NotFoundException('Agendamento não encontrado');
    }

    if (appointment.professionalId !== professionalId) {
      throw new ForbiddenException('Acesso negado');
    }

    return this.prisma.publicAppointment.update({
      where: { id },
      data: { status: dto.status },
    });
  }

  // ─── Schedule Events ───────────────────────────────────────────────────────

  async getScheduleEvents(professionalEmail: string) {
    const events = await this.prisma.scheduleEvent.findMany({
      where: { professionalId: professionalEmail },
      orderBy: { date: 'asc' },
    });

    return events.map((e) => ({
      ...e,
      date: e.date.toISOString(),
    }));
  }

  async createScheduleEvent(dto: CreateScheduleEventDto) {
    const event = await this.prisma.scheduleEvent.create({
      data: {
        ...dto,
        date: new Date(dto.date),
      },
    });

    // Agendar reminder — fire and forget
    if (event.patientPhone) {
      this.scheduleEventReminder(event).catch((err) =>
        this.logger.warn(`Falha ao agendar reminder: ${err.message}`),
      );
    }

    return { ...event, date: event.date.toISOString() };
  }

  private async scheduleEventReminder(event: {
    id: string;
    patientName: string;
    patientPhone: string | null;
    professionalId: string;
    date: Date;
  }): Promise<void> {
    const professional = await this.prisma.user.findUnique({
      where: { email: event.professionalId },
      select: { id: true, fullName: true },
    });

    await this.reminderService.scheduleForScheduleEvent({
      eventId: event.id,
      patientName: event.patientName,
      patientPhone: event.patientPhone ?? '',
      professionalId: professional?.id ?? event.professionalId,
      professionalName: professional?.fullName ?? 'Profissional',
      eventAt: event.date,
    });
  }

  async updateScheduleEvent(id: string, dto: UpdateScheduleEventDto, professionalEmail: string) {
    const event = await this.prisma.scheduleEvent.findUnique({ where: { id } });

    if (!event) {
      throw new NotFoundException('Evento não encontrado');
    }

    if (event.professionalId !== professionalEmail) {
      throw new ForbiddenException('Acesso negado');
    }

    const updated = await this.prisma.scheduleEvent.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.date ? { date: new Date(dto.date) } : {}),
      },
    });

    return { ...updated, date: updated.date.toISOString() };
  }

  async deleteScheduleEvent(id: string, professionalEmail: string) {
    const event = await this.prisma.scheduleEvent.findUnique({ where: { id } });

    if (!event) {
      throw new NotFoundException('Evento não encontrado');
    }

    if (event.professionalId !== professionalEmail) {
      throw new ForbiddenException('Acesso negado');
    }

    await this.prisma.scheduleEvent.delete({ where: { id } });

    // Cancelar reminder pendente
    this.reminderService.cancelForAppointment(id, ReminderType.SCHEDULE_EVENT).catch(() => {});

    return { success: true };
  }
}
