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
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.accountStatus !== AccountStatus.ACTIVE) {
      throw new UnauthorizedException('Account is inactive');
    }

    return this.buildAuthResponse(user);
  }

  async register(dto: RegisterDto) {
    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
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
    return this.buildAuthResponse(user!);
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
        role: user.role.toLowerCase(),
        isVerified: user.approvalStatus === ApprovalStatus.APPROVED,
      },
    };
  }
}
