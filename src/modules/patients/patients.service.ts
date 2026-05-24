import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';

@Injectable()
export class PatientsService {
  constructor(private readonly prisma: PrismaService) {}

  private format(patient: any) {
    return {
      id: patient.id,
      name: patient.name,
      email: patient.email,
      phone: patient.phone,
      birthdate: patient.birthdate.toISOString(),
      notes: patient.notes ?? null,
      professionalId: patient.professionalId,
      createdAt: patient.createdAt.toISOString(),
      updatedAt: patient.updatedAt.toISOString(),
      sessions: [],
      documents: [],
    };
  }

  async findAll(professionalId: string) {
    const patients = await this.prisma.patient.findMany({
      where: { professionalId },
      orderBy: { createdAt: 'desc' },
    });
    return patients.map((p) => this.format(p));
  }

  async findOne(id: string, professionalId: string) {
    const patient = await this.prisma.patient.findFirst({
      where: { id, professionalId },
    });
    if (!patient) throw new NotFoundException('Patient not found');
    return this.format(patient);
  }

  async findByPhone(phone: string) {
    const cleanPhone = phone.replace(/\D/g, '');
    const patient = await this.prisma.patient.findFirst({
      where: { phone: cleanPhone },
      select: { name: true },
    });
    if (!patient) throw new NotFoundException('Paciente não encontrado');
    return { name: patient.name };
  }

  async create(dto: CreatePatientDto, professionalId: string) {
    const phone = dto.phone.replace(/\D/g, '');

    if (dto.email) {
      const existing = await this.prisma.patient.findFirst({
        where: { email: dto.email, professionalId },
      });
      if (existing) throw new BadRequestException('Paciente com este e-mail já existe');
    }

    const data: any = {
      name: dto.name,
      phone,
      birthdate: new Date(dto.birthdate),
      professionalId,
    };
    if (dto.email != null) data.email = dto.email;

    const patient = await this.prisma.patient.create({ data });
    return this.format(patient);
  }

  async update(id: string, dto: UpdatePatientDto, professionalId: string) {
    const patient = await this.prisma.patient.findFirst({
      where: { id, professionalId },
    });
    if (!patient) throw new NotFoundException('Patient not found');

    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.phone !== undefined) data.phone = dto.phone.replace(/\D/g, '');
    if (dto.birthdate !== undefined) data.birthdate = new Date(dto.birthdate);

    const updated = await this.prisma.patient.update({ where: { id }, data });
    return this.format(updated);
  }

  async delete(id: string, professionalId: string) {
    const patient = await this.prisma.patient.findFirst({
      where: { id, professionalId },
    });
    if (!patient) throw new NotFoundException('Patient not found');
    await this.prisma.patient.delete({ where: { id } });
  }
}
