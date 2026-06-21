import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma, Reminder, ReminderStatus, ReminderType } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service.js';
import { MessagingService } from './messaging.service';

const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export interface DispatchResult {
  processed: number;
  sent: number;
  failed: number;
  details: Array<{
    id: string;
    patientName: string;
    phone: string;
    result: 'sent' | 'failed';
    error?: string;
  }>;
}

export interface ListRemindersResult {
  items: Reminder[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface ResendReminderResult {
  success: boolean;
  error?: string;
}

@Injectable()
export class ReminderService {
  private readonly logger = new Logger(ReminderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly messagingService: MessagingService,
  ) {}

  // ─── Cálculo do momento de disparo ─────────────────────────────────────────

  private calculateScheduledFor(appointmentAt: Date): Date | null {
    const now = new Date();
    const latestAllowed = new Date(appointmentAt.getTime() - FOUR_HOURS_MS);

    // Agendamento a menos de 4h — não envia
    if (latestAllowed <= now) return null;

    // Ideal: 24h antes. Se já passou, dispara agora (cron pega em até 5 min)
    const ideal = new Date(appointmentAt.getTime() - TWENTY_FOUR_HOURS_MS);
    return ideal > now ? ideal : now;
  }

  private buildMessage(patientName: string, professionalName: string, dateLabel: string): string {
    return `Olá, ${patientName}! 👋 Lembramos que você tem uma consulta agendada com ${professionalName} em ${dateLabel}. Qualquer dúvida, entre em contato. 😊`;
  }

  // ─── Agendamento de reminders ───────────────────────────────────────────────

  async scheduleForPublicAppointment(params: {
    appointmentId: string;
    patientName: string;
    patientPhone: string;
    professionalId: string;
    professionalName: string;
    date: string; // YYYY-MM-DD
    time: string; // HH:MM
  }): Promise<void> {
    const appointmentAt = new Date(`${params.date}T${params.time}:00`);
    const scheduledFor = this.calculateScheduledFor(appointmentAt);

    if (!scheduledFor) {
      this.logger.log(
        `Reminder ignorado para agendamento ${params.appointmentId}: menos de 4h até a consulta`,
      );
      return;
    }

    const [day, month, year] = params.date.split('-').reverse();
    const dateLabel = `${day}/${month}/${year} às ${params.time}`;
    const message = this.buildMessage(params.patientName, params.professionalName, dateLabel);

    try {
      await this.prisma.reminder.create({
        data: {
          appointmentId: params.appointmentId,
          type: ReminderType.PUBLIC_APPOINTMENT,
          professionalId: params.professionalId,
          patientName: params.patientName,
          patientPhone: params.patientPhone.replace(/\D/g, ''),
          message,
          scheduledFor,
        },
      });
      this.logger.log(
        `Reminder agendado para ${params.patientName} em ${scheduledFor.toISOString()}`,
      );
    } catch (error: any) {
      // P2002 = unique constraint — reminder já existe, tudo bem
      if (error?.code === 'P2002') return;
      throw error;
    }
  }

  async scheduleForScheduleEvent(params: {
    eventId: string;
    patientName: string;
    patientPhone: string;
    professionalId: string;
    professionalName: string;
    eventAt: Date;
  }): Promise<void> {
    if (!params.patientPhone) return; // Telefone obrigatório para envio

    const scheduledFor = this.calculateScheduledFor(params.eventAt);

    if (!scheduledFor) {
      this.logger.log(
        `Reminder ignorado para evento ${params.eventId}: menos de 4h até a consulta`,
      );
      return;
    }

    const dateLabel = params.eventAt.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Fortaleza',
    });
    const message = this.buildMessage(params.patientName, params.professionalName, dateLabel);

    try {
      await this.prisma.reminder.create({
        data: {
          appointmentId: params.eventId,
          type: ReminderType.SCHEDULE_EVENT,
          professionalId: params.professionalId,
          patientName: params.patientName,
          patientPhone: params.patientPhone.replace(/\D/g, ''),
          message,
          scheduledFor,
        },
      });
      this.logger.log(
        `Reminder agendado para ${params.patientName} em ${scheduledFor.toISOString()}`,
      );
    } catch (error: any) {
      if (error?.code === 'P2002') return;
      throw error;
    }
  }

  async cancelForAppointment(appointmentId: string, type: ReminderType): Promise<void> {
    await this.prisma.reminder.updateMany({
      where: { appointmentId, type, status: ReminderStatus.pending },
      data: { status: ReminderStatus.skipped },
    });
  }

  // ─── Gestão de reminders (admin) ───────────────────────────────────────────

  async listReminders(filters: {
    status?: ReminderStatus;
    page?: number;
    limit?: number;
  }): Promise<ListRemindersResult> {
    const { status, page = 1, limit = 50 } = filters;
    const skip = (page - 1) * limit;
    const where: Prisma.ReminderWhereInput = status ? { status } : {};

    const [items, total] = await Promise.all([
      this.prisma.reminder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.reminder.count({ where }),
    ]);

    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async deleteReminder(id: string): Promise<void> {
    await this.prisma.reminder.delete({ where: { id } });
  }

  async resendReminder(id: string): Promise<ResendReminderResult> {
    const reminder = await this.prisma.reminder.findUniqueOrThrow({ where: { id } });

    try {
      await this.messagingService.send(reminder.patientPhone, reminder.message);
      await this.prisma.reminder.update({
        where: { id },
        data: { status: ReminderStatus.sent, sentAt: new Date(), errorMessage: null },
      });
      this.logger.log(
        `✓ Reminder reenviado (admin) para ${reminder.patientName} (${reminder.patientPhone})`,
      );
      return { success: true };
    } catch (error: any) {
      const errMsg = String(error.message ?? error).slice(0, 500);
      await this.prisma.reminder.update({
        where: { id },
        data: { status: ReminderStatus.failed, errorMessage: errMsg },
      });
      return { success: false, error: errMsg };
    }
  }

  // ─── Disparo de reminders ───────────────────────────────────────────────────

  /**
   * Processa e envia reminders filtrando por status.
   *
   * - statuses: quais status incluir (ex: ["pending"], ["failed"], ["pending","failed"])
   * - ignoreSchedule: se true, ignora o filtro scheduledFor <= now (útil para forçar reenvio)
   * - limit: máximo de registros por execução (default 50)
   *
   * Reminders com status "pending" respeitam scheduledFor por padrão.
   * Reminders com status "failed" nunca filtram por scheduledFor.
   */
  async dispatchReminders(options: {
    statuses: ReminderStatus[];
    ignoreSchedule?: boolean;
    limit?: number;
  }): Promise<DispatchResult> {
    const { statuses, ignoreSchedule = false, limit = 50 } = options;

    // Monta o where com OR para lidar com regras diferentes por status
    const conditions: Prisma.ReminderWhereInput[] = statuses.map((s) => {
      const cond: Prisma.ReminderWhereInput = { status: s };
      // pending respeita o horário programado; failed e outros não
      if (s === ReminderStatus.pending && !ignoreSchedule) {
        cond.scheduledFor = { lte: new Date() };
      }
      return cond;
    });

    const where: Prisma.ReminderWhereInput =
      conditions.length === 1 ? conditions[0] : { OR: conditions };

    const reminders = await this.prisma.reminder.findMany({
      where,
      take: limit,
      orderBy: { scheduledFor: 'asc' },
    });

    const result: DispatchResult = { processed: reminders.length, sent: 0, failed: 0, details: [] };

    if (reminders.length === 0) return result;

    this.logger.log(`Processando ${reminders.length} reminder(s) [${statuses.join(', ')}]`);

    for (const reminder of reminders) {
      try {
        await this.messagingService.send(reminder.patientPhone, reminder.message);
        await this.prisma.reminder.update({
          where: { id: reminder.id },
          data: { status: ReminderStatus.sent, sentAt: new Date(), errorMessage: null },
        });
        result.sent++;
        result.details.push({
          id: reminder.id,
          patientName: reminder.patientName,
          phone: reminder.patientPhone,
          result: 'sent',
        });
        this.logger.log(
          `✓ Reminder enviado para ${reminder.patientName} (${reminder.patientPhone})`,
        );
      } catch (error: any) {
        const errMsg = String(error.message ?? error).slice(0, 500);
        this.logger.error(`✗ Falha ao enviar reminder ${reminder.id}: ${errMsg}`);
        await this.prisma.reminder.update({
          where: { id: reminder.id },
          data: { status: ReminderStatus.failed, errorMessage: errMsg },
        });
        result.failed++;
        result.details.push({
          id: reminder.id,
          patientName: reminder.patientName,
          phone: reminder.patientPhone,
          result: 'failed',
          error: errMsg,
        });
      }
    }

    return result;
  }

  // ─── Cron: processa reminders pendentes a cada 5 minutos ───────────────────

  @Cron('*/5 * * * *')
  async processPendingReminders(): Promise<void> {
    await this.dispatchReminders({ statuses: [ReminderStatus.pending] });
  }
}
