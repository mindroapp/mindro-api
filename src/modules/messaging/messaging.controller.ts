import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ReminderStatus } from '@prisma/client';

import { Roles } from '../auth/decorators/roles.decorator';
import { MessagingService } from './messaging.service';
import {
  type DispatchResult,
  type ListRemindersResult,
  type ResendReminderResult,
  ReminderService,
} from './reminder.service';

@Controller('messaging')
export class MessagingController {
  constructor(
    private readonly messagingService: MessagingService,
    private readonly reminderService: ReminderService,
  ) {}

  @Get('status')
  @Roles('ADMIN', 'PROFESSIONAL')
  getStatus() {
    return {
      configured: this.messagingService.isConfigured,
      provider: 'AngelZap',
    };
  }

  @Post('test')
  @Roles('ADMIN', 'PROFESSIONAL')
  async sendTest(@Body() body: { phone: string; message?: string }) {
    const phone = body.phone?.replace(/\D/g, '');

    if (!phone || phone.length < 10) {
      return { success: false, error: 'Telefone inválido. Informe DDD + número (ex: 85999998888)' };
    }

    if (!this.messagingService.isConfigured) {
      return {
        success: false,
        error:
          'AngelZap não configurado. Verifique ANGELZAP_API_URL, ANGELZAP_API_KEY e ANGELZAP_USER_ID no .env',
      };
    }

    const message = body.message ?? '✅ Teste de conexão AngelZap — Mindro';

    try {
      await this.messagingService.send(phone, message);
      return { success: true, sentTo: phone, message };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Processa reminders manualmente filtrando por status.
   *
   * Body:
   *   statuses      — array de status a processar: "pending" | "failed" | "sent" | "skipped"
   *                   default: ["pending"]
   *   ignoreSchedule — se true, envia pending mesmo antes do horário programado
   *                   default: false
   *   limit         — máximo de registros por chamada (default: 50, max: 200)
   *
   * Exemplos:
   *   { "statuses": ["pending"] }                          → mesmo comportamento do cron
   *   { "statuses": ["failed"] }                           → reprocessa todos os falhos
   *   { "statuses": ["pending", "failed"] }                → pending no horário + retry dos falhos
   *   { "statuses": ["pending"], "ignoreSchedule": true }  → força envio imediato de todos os pending
   */
  @Post('reminders/process')
  @Roles('ADMIN', 'PROFESSIONAL')
  async processReminders(
    @Body()
    body: {
      statuses?: ReminderStatus[];
      ignoreSchedule?: boolean;
      limit?: number;
    },
  ) {
    const validStatuses: ReminderStatus[] = [
      ReminderStatus.pending,
      ReminderStatus.failed,
      ReminderStatus.sent,
      ReminderStatus.skipped,
    ];

    const statuses = (body.statuses ?? [ReminderStatus.pending]).filter((s) =>
      validStatuses.includes(s),
    );

    if (statuses.length === 0) {
      return {
        success: false,
        error: `Status inválido. Valores aceitos: ${validStatuses.join(', ')}`,
      };
    }

    const limit = Math.min(body.limit ?? 50, 200);

    const result: DispatchResult = await this.reminderService.dispatchReminders({
      statuses,
      ignoreSchedule: body.ignoreSchedule ?? false,
      limit,
    });

    return { success: true, ...result };
  }

  // ─── Gestão de reminders (admin only) ──────────────────────────────────────

  @Get('reminders')
  @Roles('ADMIN')
  async listReminders(
    @Query('status') status?: ReminderStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<ListRemindersResult> {
    const result: ListRemindersResult = await this.reminderService.listReminders({
      status,
      page: page ? Number(page) : 1,
      limit: limit ? Math.min(Number(limit), 200) : 50,
    });
    return result;
  }

  @Delete('reminders/:id')
  @Roles('ADMIN')
  @HttpCode(204)
  async deleteReminder(@Param('id') id: string): Promise<void> {
    await this.reminderService.deleteReminder(id);
  }

  @Post('reminders/:id/resend')
  @Roles('ADMIN')
  async resendReminder(@Param('id') id: string): Promise<ResendReminderResult> {
    const result: ResendReminderResult = await this.reminderService.resendReminder(id);
    return result;
  }
}
