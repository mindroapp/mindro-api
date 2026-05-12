import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  async create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Get()
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
    @Param('patientId') patientId: string,
    @Param('professionalId') professionalId: string,
  ) {
    const count = await this.usersService.getPatientSessions(patientId, professionalId);
    return { sessionCount: count };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: Partial<CreateUserDto>) {
    return this.usersService.update(id, dto);
  }

  @Patch(':id/approve')
  async approve(@Param('id') id: string) {
    return this.usersService.approve(id);
  }

  @Patch(':id/reject')
  async reject(@Param('id') id: string) {
    return this.usersService.reject(id);
  }

  @Patch(':id/activate')
  async activate(@Param('id') id: string) {
    return this.usersService.activate(id);
  }

  @Patch(':id/deactivate')
  async deactivate(@Param('id') id: string) {
    return this.usersService.deactivate(id);
  }

  @Delete(':id')
  @HttpCode(204)
  async delete(@Param('id') id: string) {
    return this.usersService.delete(id);
  }
}
