import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AccountStatus, ApprovalStatus, User, UserRole } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service.js';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private sanitize(user: User) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...safe } = user;
    return safe;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async create(dto: CreateUserDto) {
    const {
      fullName,
      email,
      phone,
      password,
      confirmPassword,
      profession,
      professionalRegister,
      professionalCouncil,
    } = dto;

    if (password !== confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    const byEmail = await this.prisma.user.findUnique({ where: { email } });
    if (byEmail) throw new BadRequestException('Email already exists');

    if (phone) {
      const byPhone = await this.prisma.user.findUnique({ where: { phone } });
      if (byPhone) throw new BadRequestException('Phone already exists');
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await this.prisma.user.create({
      data: {
        fullName,
        email,
        phone,
        passwordHash,
        profession,
        professionalRegister,
        professionalCouncil,
        role: UserRole.PROFESSIONAL,
        approvalStatus: ApprovalStatus.PENDING,
        accountStatus: AccountStatus.ACTIVE,
      },
    });

    return this.sanitize(user);
  }

  async findAll() {
    const users = await this.prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
    return users.map((u) => this.sanitize(u));
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return this.sanitize(user);
  }

  async update(id: string, dto: Partial<CreateUserDto>) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    const updateData: any = {};

    if (dto.fullName) updateData.fullName = dto.fullName;
    if (dto.email) {
      const byEmail = await this.prisma.user.findUnique({ where: { email: dto.email } });
      if (byEmail && byEmail.id !== id) throw new BadRequestException('Email already exists');
      updateData.email = dto.email;
    }
    if (dto.phone) {
      const byPhone = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
      if (byPhone && byPhone.id !== id) throw new BadRequestException('Phone already exists');
      updateData.phone = dto.phone;
    }
    if (dto.profession) updateData.profession = dto.profession;
    if (dto.professionalRegister) updateData.professionalRegister = dto.professionalRegister;
    if (dto.professionalCouncil) updateData.professionalCouncil = dto.professionalCouncil;

    const updated = await this.prisma.user.update({
      where: { id },
      data: updateData,
    });
    return this.sanitize(updated);
  }

  async approve(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    const updated = await this.prisma.user.update({
      where: { id },
      data: { approvalStatus: ApprovalStatus.APPROVED, approvedAt: new Date() },
    });
    return this.sanitize(updated);
  }

  async reject(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    const updated = await this.prisma.user.update({
      where: { id },
      data: { approvalStatus: ApprovalStatus.REJECTED },
    });
    return this.sanitize(updated);
  }

  async activate(id: string) {
    const updated = await this.prisma.user.update({
      where: { id },
      data: { accountStatus: AccountStatus.ACTIVE },
    });
    return this.sanitize(updated);
  }

  async deactivate(id: string) {
    const updated = await this.prisma.user.update({
      where: { id },
      data: { accountStatus: AccountStatus.INACTIVE },
    });
    return this.sanitize(updated);
  }

  async delete(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    await this.prisma.user.delete({ where: { id } });
  }

  async findPublic(identifier: string) {
    const professionals = await this.prisma.user.findMany({
      where: {
        role: UserRole.PROFESSIONAL,
        approvalStatus: ApprovalStatus.APPROVED,
        accountStatus: AccountStatus.ACTIVE,
      },
    });

    let match: (typeof professionals)[number] | undefined;

    if (identifier.includes('@')) {
      match = professionals.find((u) => u.email === identifier);
    } else {
      const toSlug = (name: string) =>
        name
          .toLowerCase()
          .normalize('NFD')
          .replace(/[̀-ͯ]/g, '')
          .replace(/[^a-z0-9\s]/g, '')
          .trim()
          .replace(/\s+/g, '-');
      match = professionals.find((u) => toSlug(u.fullName) === identifier);
    }

    if (!match) throw new NotFoundException('Professional not found');

    return {
      id: match.id,
      email: match.email,
      fullName: match.fullName,
      profession: match.profession,
      professionalCouncil: match.professionalCouncil,
      professionalRegister: match.professionalRegister,
    };
  }
}
