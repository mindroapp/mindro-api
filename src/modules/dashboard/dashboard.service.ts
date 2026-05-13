import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Agendado',
  confirmed: 'Confirmado',
  completed: 'Realizado',
  cancelled: 'Cancelado',
};

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(professionalId: string, professionalEmail: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // ScheduleEvent and Availability are stored with email as professionalId (frontend uses user.email)
    // Patient and Payment use UUID (backend-controlled)
    const [
      totalPatients,
      patients,
      eventsThisMonth,
      eventsToday,
      totalEvents,
      eventsByStatus,
      availabilitiesThisMonth,
    ] = await Promise.all([
      this.prisma.patient.count({ where: { professionalId } }),
      this.prisma.patient.findMany({
        where: { professionalId },
        select: { birthdate: true, gender: true },
      }),
      this.prisma.scheduleEvent.count({
        where: { professionalId: professionalEmail, date: { gte: startOfMonth } },
      }),
      this.prisma.scheduleEvent.count({
        where: { professionalId: professionalEmail, date: { gte: startOfToday, lte: endOfToday } },
      }),
      this.prisma.scheduleEvent.count({ where: { professionalId: professionalEmail } }),
      this.prisma.scheduleEvent.groupBy({
        by: ['status'],
        where: { professionalId: professionalEmail },
        _count: { id: true },
      }),
      this.prisma.timeSlot.count({
        where: {
          available: true,
          availability: {
            professionalId: professionalEmail,
            date: { startsWith: monthPrefix },
          },
        },
      }),
    ]);

    const avgSessionsPerPatient =
      totalPatients > 0 ? Number((totalEvents / totalPatients).toFixed(1)) : 0;

    // Age distribution
    const ageGroups: Record<string, number> = {
      '18-25': 0,
      '26-35': 0,
      '36-45': 0,
      '46-55': 0,
      '56+': 0,
      '<18': 0,
    };
    const currentYear = now.getFullYear();
    patients.forEach((p) => {
      const age = currentYear - p.birthdate.getFullYear();
      if (age < 18) ageGroups['<18']++;
      else if (age <= 25) ageGroups['18-25']++;
      else if (age <= 35) ageGroups['26-35']++;
      else if (age <= 45) ageGroups['36-45']++;
      else if (age <= 55) ageGroups['46-55']++;
      else ageGroups['56+']++;
    });

    const ageDistribution = Object.entries(ageGroups)
      .filter(([, count]) => count > 0 || ['18-25', '26-35', '36-45', '46-55', '56+'].includes(''))
      .map(([ageRange, count]) => ({ ageRange, count }));

    // Gender distribution
    const genderMap: Record<string, number> = { M: 0, F: 0, Outro: 0, 'Não informado': 0 };
    patients.forEach((p) => {
      if (p.gender === 'M') genderMap['M']++;
      else if (p.gender === 'F') genderMap['F']++;
      else if (p.gender === 'other') genderMap['Outro']++;
      else genderMap['Não informado']++;
    });
    const genderDistribution = [
      { gender: 'Masculino', count: genderMap['M'], color: '#8884d8' },
      { gender: 'Feminino', count: genderMap['F'], color: '#82ca9d' },
      { gender: 'Outro', count: genderMap['Outro'], color: '#ffc658' },
      { gender: 'Não informado', count: genderMap['Não informado'], color: '#d0d0d0' },
    ].filter((g) => g.count > 0);

    // Sessions by status
    const sessionsByStatus = ['scheduled', 'confirmed', 'completed', 'cancelled'].map((status) => ({
      status,
      label: STATUS_LABELS[status],
      count: eventsByStatus.find((e) => e.status === status)?._count.id ?? 0,
    }));

    return {
      totalPatients,
      eventsThisMonth,
      eventsToday,
      availabilitiesThisMonth,
      avgSessionsPerPatient,
      ageDistribution,
      genderDistribution,
      sessionsByStatus,
    };
  }

  async getAdminStats() {
    const [
      pendingProfessionals,
      activeProfessionals,
      inactiveProfessionals,
      totalPatients,
      totalSessions,
    ] = await Promise.all([
      this.prisma.user.count({
        where: { role: 'PROFESSIONAL', approvalStatus: 'PENDING' },
      }),
      this.prisma.user.count({
        where: { role: 'PROFESSIONAL', approvalStatus: 'APPROVED', accountStatus: 'ACTIVE' },
      }),
      this.prisma.user.count({
        where: { role: 'PROFESSIONAL', approvalStatus: 'APPROVED', accountStatus: 'INACTIVE' },
      }),
      this.prisma.patient.count(),
      this.prisma.scheduleEvent.count(),
    ]);

    return {
      pendingProfessionals,
      activeProfessionals,
      inactiveProfessionals,
      totalPatients,
      totalSessions,
    };
  }
}
