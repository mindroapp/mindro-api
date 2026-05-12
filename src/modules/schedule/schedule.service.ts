import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service.js';
import { CreateAvailabilityDto } from './dto/create-availability.dto';
import { CreatePublicAppointmentDto } from './dto/create-public-appointment.dto';
import { UpdateAppointmentStatusDto } from './dto/update-appointment-status.dto';
import { CreateScheduleEventDto } from './dto/create-schedule-event.dto';
import { UpdateScheduleEventDto } from './dto/update-schedule-event.dto';

@Injectable()
export class ScheduleService {
  constructor(private readonly prisma: PrismaService) {}

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

  async deleteAvailability(id: string) {
    const availability = await this.prisma.availability.findUnique({
      where: { id },
      include: { appointments: true },
    });

    if (!availability) {
      throw new NotFoundException('Agenda não encontrada');
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

  async removeTimeSlot(availabilityId: string, time: string) {
    const timeSlot = await this.prisma.timeSlot.findUnique({
      where: { availabilityId_time: { availabilityId, time } },
    });

    if (!timeSlot) {
      throw new NotFoundException('Horário não encontrado');
    }

    // Delete linked appointment for this slot if any
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

    const existing = await this.prisma.publicAppointment.findFirst({
      where: { availabilityId: dto.availabilityId, time: dto.time },
    });

    if (existing) {
      throw new BadRequestException('Este horário já está reservado');
    }

    const data: any = { ...dto };

    // Converter patientBirthDate para DateTime se fornecido
    if (dto.patientBirthDate) {
      data.patientBirthDate = new Date(dto.patientBirthDate);
    }

    return this.prisma.publicAppointment.create({ data });
  }

  async deletePublicAppointment(id: string) {
    const appointment = await this.prisma.publicAppointment.findUnique({ where: { id } });

    if (!appointment) {
      throw new NotFoundException('Agendamento não encontrado');
    }

    await this.prisma.publicAppointment.delete({ where: { id } });
    return { success: true };
  }

  async updateAppointmentStatus(id: string, dto: UpdateAppointmentStatusDto) {
    const appointment = await this.prisma.publicAppointment.findUnique({ where: { id } });

    if (!appointment) {
      throw new NotFoundException('Agendamento não encontrado');
    }

    return this.prisma.publicAppointment.update({
      where: { id },
      data: { status: dto.status },
    });
  }

  // ─── Schedule Events ───────────────────────────────────────────────────────

  async getScheduleEvents(professionalId: string) {
    const events = await this.prisma.scheduleEvent.findMany({
      where: { professionalId },
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

    return { ...event, date: event.date.toISOString() };
  }

  async updateScheduleEvent(id: string, dto: UpdateScheduleEventDto) {
    const event = await this.prisma.scheduleEvent.findUnique({ where: { id } });

    if (!event) {
      throw new NotFoundException('Evento não encontrado');
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

  async deleteScheduleEvent(id: string) {
    const event = await this.prisma.scheduleEvent.findUnique({ where: { id } });

    if (!event) {
      throw new NotFoundException('Evento não encontrado');
    }

    await this.prisma.scheduleEvent.delete({ where: { id } });
    return { success: true };
  }
}
