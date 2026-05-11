import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';

import { Public } from '../auth/decorators/public.decorator';
import { CreateUserDto } from './dto/create-user.dto';
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

  @Public()
  @Get('public/:identifier')
  async findPublic(@Param('identifier') identifier: string) {
    return this.usersService.findPublic(identifier);
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
