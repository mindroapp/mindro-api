import { Injectable, NotFoundException } from '@nestjs/common';
import { PaymentStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';

const MONTH_LABELS = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
];

@Injectable()
export class FinancialService {
  constructor(private readonly prisma: PrismaService) {}

  private formatPayment(p: any) {
    return {
      id: p.id,
      patientId: p.patientId,
      patientName: p.patient?.name ?? null,
      professionalId: p.professionalId,
      amount: p.amount,
      date: p.date.toISOString(),
      description: p.description ?? null,
      method: p.method,
      status: p.status,
      receiptNumber: p.receiptNumber ?? null,
      notes: p.notes ?? null,
      createdAt: p.createdAt.toISOString(),
    };
  }

  // ─── Payments CRUD ──────────────────────────────────────────────────────────

  async getPayments(professionalId: string) {
    const payments = await this.prisma.payment.findMany({
      where: { professionalId },
      include: { patient: { select: { name: true } } },
      orderBy: { date: 'desc' },
    });
    return payments.map((p) => this.formatPayment(p));
  }

  async getPaymentsByPatient(patientId: string, professionalId: string) {
    const payments = await this.prisma.payment.findMany({
      where: { patientId, professionalId },
      include: { patient: { select: { name: true } } },
      orderBy: { date: 'desc' },
    });
    return payments.map((p) => this.formatPayment(p));
  }

  async createPayment(dto: CreatePaymentDto, professionalId: string) {
    const patient = await this.prisma.patient.findFirst({
      where: { id: dto.patientId, professionalId },
    });
    if (!patient) throw new NotFoundException('Paciente não encontrado');

    const payment = await this.prisma.payment.create({
      data: {
        patientId: dto.patientId,
        professionalId,
        amount: dto.amount,
        date: new Date(dto.date),
        description: dto.description,
        method: dto.method,
        status: dto.status,
        receiptNumber: dto.receiptNumber,
        notes: dto.notes,
      },
      include: { patient: { select: { name: true } } },
    });
    return this.formatPayment(payment);
  }

  async updatePayment(id: string, dto: UpdatePaymentDto, professionalId: string) {
    const payment = await this.prisma.payment.findFirst({ where: { id, professionalId } });
    if (!payment) throw new NotFoundException('Pagamento não encontrado');

    const data: any = {};
    if (dto.amount !== undefined) data.amount = dto.amount;
    if (dto.date !== undefined) data.date = new Date(dto.date);
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.method !== undefined) data.method = dto.method;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.receiptNumber !== undefined) data.receiptNumber = dto.receiptNumber;
    if (dto.notes !== undefined) data.notes = dto.notes;

    const updated = await this.prisma.payment.update({
      where: { id },
      data,
      include: { patient: { select: { name: true } } },
    });
    return this.formatPayment(updated);
  }

  async deletePayment(id: string, professionalId: string) {
    const payment = await this.prisma.payment.findFirst({ where: { id, professionalId } });
    if (!payment) throw new NotFoundException('Pagamento não encontrado');
    await this.prisma.payment.delete({ where: { id } });
  }

  // ─── Financial Stats ────────────────────────────────────────────────────────

  async getSummary(professionalId: string, professionalEmail: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    // ScheduleEvent uses email as professionalId; Patient/Payment use UUID
    const [totalPatients, thisMonthPayments, lastMonthAgg, activePatients] = await Promise.all([
      this.prisma.patient.count({ where: { professionalId } }),
      this.prisma.payment.findMany({
        where: { professionalId, date: { gte: startOfMonth } },
      }),
      this.prisma.payment.aggregate({
        where: {
          professionalId,
          status: PaymentStatus.paid,
          date: { gte: startOfLastMonth, lte: endOfLastMonth },
        },
        _sum: { amount: true },
      }),
      this.prisma.scheduleEvent.findMany({
        where: { professionalId: professionalEmail, date: { gte: startOfMonth } },
        select: { patientId: true },
        distinct: ['patientId'],
      }),
    ]);

    const paid = thisMonthPayments.filter((p) => p.status === PaymentStatus.paid);
    const pending = thisMonthPayments.filter((p) => p.status === PaymentStatus.pending);
    const currentMonthRevenue = paid.reduce((s, p) => s + p.amount, 0);
    const lastMonthRevenue = lastMonthAgg._sum.amount ?? 0;

    const revenueChangePercent =
      lastMonthRevenue > 0
        ? Math.round(((currentMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)
        : 0;

    const conversionRate =
      thisMonthPayments.length > 0 ? Math.round((paid.length / thisMonthPayments.length) * 100) : 0;

    return {
      totalPatients,
      activePatientsThisMonth: activePatients.length,
      paidCount: paid.length,
      pendingCount: pending.length,
      currentMonthRevenue,
      lastMonthRevenue,
      revenueChangePercent,
      conversionRate,
    };
  }

  async getMonthlyRevenue(professionalId: string, year: number) {
    const payments = await this.prisma.payment.findMany({
      where: {
        professionalId,
        status: PaymentStatus.paid,
        date: { gte: new Date(year, 0, 1), lte: new Date(year, 11, 31, 23, 59, 59) },
      },
    });

    const monthly = MONTH_LABELS.map((month) => ({ month, value: 0 }));
    payments.forEach((p) => {
      monthly[p.date.getMonth()].value += p.amount;
    });
    return monthly;
  }

  async getDebtors(professionalId: string) {
    const pendingPayments = await this.prisma.payment.findMany({
      where: { professionalId, status: PaymentStatus.pending },
      include: { patient: { select: { id: true, name: true, phone: true } } },
      orderBy: { date: 'desc' },
    });

    const debtorMap = new Map<
      string,
      {
        patientId: string;
        name: string;
        phone: string;
        totalDebt: number;
        pendingCount: number;
        lastPaymentDate: string | null;
      }
    >();

    for (const payment of pendingPayments) {
      if (!debtorMap.has(payment.patientId)) {
        const lastPaid = await this.prisma.payment.findFirst({
          where: { patientId: payment.patientId, status: PaymentStatus.paid },
          orderBy: { date: 'desc' },
        });
        debtorMap.set(payment.patientId, {
          patientId: payment.patientId,
          name: payment.patient.name,
          phone: payment.patient.phone,
          totalDebt: 0,
          pendingCount: 0,
          lastPaymentDate: lastPaid ? lastPaid.date.toISOString() : null,
        });
      }
      const d = debtorMap.get(payment.patientId)!;
      d.totalDebt += payment.amount;
      d.pendingCount++;
    }

    return Array.from(debtorMap.values());
  }
}
