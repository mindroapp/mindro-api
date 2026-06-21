import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AccountStatus, ApprovalStatus, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);

    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    if (user.accountStatus !== AccountStatus.ACTIVE) {
      throw new UnauthorizedException(
        'Conta inativa. Por favor, entre em contato com o suporte para mais informações.',
      );
    }

    // Profissionais devem estar aprovados para fazer login
    if (user.role === 'PROFESSIONAL' && user.approvalStatus !== ApprovalStatus.APPROVED) {
      throw new UnauthorizedException(
        'Sua conta está pendente de aprovação. Por favor, aguarde a confirmação do administrador para acessar a plataforma.',
      );
    }

    return this.buildAuthResponse(user);
  }

  async register(dto: RegisterDto) {
    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException('Senha não confere');
    }

    const created = await this.usersService.create({
      fullName: dto.fullName,
      email: dto.email,
      phone: dto.phone,
      password: dto.password,
      confirmPassword: dto.confirmPassword,
      profession: dto.profession,
      professionalRegister: dto.professionalRegister,
      professionalCouncil: dto.professionalCouncil,
    });

    const user = await this.usersService.findByEmail(created.email as string);

    // Retornar resposta sem tokens para profissionais não aprovados
    // Apenas tokens para usuários já aprovados (admin/patient)
    if (user?.role === 'PROFESSIONAL' && user?.approvalStatus !== ApprovalStatus.APPROVED) {
      return {
        user: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          phone: user.phone ?? null,
          role: user.role.toLowerCase(),
          isVerified: false,
          professionalCouncil: user.professionalCouncil ?? null,
          professionalRegister: user.professionalRegister ?? null,
        },
      };
    }

    return this.buildAuthResponse(user!);
  }

  async refresh(refreshToken: string) {
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken);
      const user = await this.usersService.findByEmail(payload.email);

      if (!user || user.accountStatus !== AccountStatus.ACTIVE) {
        throw new UnauthorizedException('Sessão inválida');
      }

      if (user.role === 'PROFESSIONAL' && user.approvalStatus !== ApprovalStatus.APPROVED) {
        throw new UnauthorizedException('Conta não aprovada');
      }

      return this.buildAuthResponse(user);
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Token de renovação inválido ou expirado');
    }
  }

  buildAuthResponse(user: User) {
    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };

    return {
      accessToken: this.jwtService.sign(payload, { expiresIn: '24h' }),
      refreshToken: this.jwtService.sign(payload, { expiresIn: '7d' }),
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone ?? null,
        role: user.role.toLowerCase(),
        isVerified: user.approvalStatus === ApprovalStatus.APPROVED,
        professionalCouncil: user.professionalCouncil ?? null,
        professionalRegister: user.professionalRegister ?? null,
      },
    };
  }
}
