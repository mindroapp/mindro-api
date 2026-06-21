import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles('ADMIN')
  async create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Get()
  @Roles('ADMIN')
  async findAll() {
    return this.usersService.findAll();
  }

  @Get('profile/me')
  async getCurrentProfile(@CurrentUser() user: any) {
    return this.usersService.getCurrentProfile(user.id);
  }

  @Patch('profile')
  async updateProfile(@CurrentUser() user: any, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.id, dto);
  }

  @Patch('profile/change-password')
  async changePassword(@CurrentUser() user: any, @Body() dto: ChangePasswordDto) {
    return this.usersService.changePassword(user.id, dto);
  }

  @Public()
  @Get('public/:identifier')
  async findPublic(@Param('identifier') identifier: string) {
    return this.usersService.findPublic(identifier);
  }

  @Public()
  @Post('public/patient/by-phone')
  async findPatientByPhone(@Body() body: { phone: string }) {
    const patient = await this.usersService.findPatientByPhone(body.phone);
    return patient || {};
  }

  @Public()
  @Post('public/patient/create')
  async createPatient(
    @Body()
    body: {
      fullName: string;
      email: string;
      phone: string;
      birthDate: string;
      professionalId: string;
    },
  ) {
    return this.usersService.createPatient({
      fullName: body.fullName,
      email: body.email,
      phone: body.phone,
      birthDate: new Date(body.birthDate),
      professionalId: body.professionalId,
    });
  }

  @Get('public/patient/:patientId/sessions/:professionalId')
  async getPatientSessions(
    @CurrentUser() user: any,
    @Param('patientId') patientId: string,
    @Param('professionalId') professionalId: string,
  ) {
    if (user.id !== professionalId && user.role?.toUpperCase() !== 'ADMIN') {
      throw new ForbiddenException('Acesso negado');
    }
    const count = await this.usersService.getPatientSessions(patientId, professionalId);
    return { sessionCount: count };
  }

  @Get(':id')
  @Roles('ADMIN')
  async findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN')
  async update(@Param('id') id: string, @Body() dto: Partial<CreateUserDto>) {
    return this.usersService.update(id, dto);
  }

  @Patch(':id/approve')
  @Roles('ADMIN')
  async approve(@Param('id') id: string) {
    return this.usersService.approve(id);
  }

  @Patch(':id/reject')
  @Roles('ADMIN')
  async reject(@Param('id') id: string) {
    return this.usersService.reject(id);
  }

  @Patch(':id/activate')
  @Roles('ADMIN')
  async activate(@Param('id') id: string) {
    return this.usersService.activate(id);
  }

  @Patch(':id/deactivate')
  @Roles('ADMIN')
  async deactivate(@Param('id') id: string) {
    return this.usersService.deactivate(id);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles('ADMIN')
  async delete(@Param('id') id: string) {
    return this.usersService.delete(id);
  }
}
