import { Body, Controller, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';

import { Public } from './decorators/public.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

const isDev = process.env.NODE_ENV !== 'production';

const ACCESS_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: !isDev,
  sameSite: isDev ? ('lax' as const) : ('strict' as const),
  maxAge: 24 * 60 * 60 * 1000, // 24h
};

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: !isDev,
  sameSite: isDev ? ('lax' as const) : ('strict' as const),
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7d
};

@Public()
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @Throttle({ default: { ttl: 900000, limit: 5 } }) // 5 tentativas por 15 min
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto);
    const { accessToken, refreshToken, ...safeResult } = result as any;
    if (accessToken) res.cookie('access_token', accessToken, ACCESS_COOKIE_OPTIONS);
    if (refreshToken) res.cookie('refresh_token', refreshToken, REFRESH_COOKIE_OPTIONS);
    return safeResult;
  }

  @Post('register')
  @Throttle({ default: { ttl: 3600000, limit: 3 } }) // 3 registros por hora
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.register(dto);
    const { accessToken, refreshToken, ...safeResult } = result as any;
    if (accessToken) res.cookie('access_token', accessToken, ACCESS_COOKIE_OPTIONS);
    if (refreshToken) res.cookie('refresh_token', refreshToken, REFRESH_COOKIE_OPTIONS);
    return safeResult;
  }

  @Post('refresh')
  @Throttle({ default: { ttl: 60000, limit: 10 } }) // 10 renovações por minuto
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.['refresh_token'];
    if (!refreshToken) throw new UnauthorizedException('Token de renovação não encontrado');

    const result = await this.authService.refresh(refreshToken);
    const { accessToken, refreshToken: newRefresh, ...safeResult } = result as any;
    if (accessToken) res.cookie('access_token', accessToken, ACCESS_COOKIE_OPTIONS);
    if (newRefresh) res.cookie('refresh_token', newRefresh, REFRESH_COOKIE_OPTIONS);
    return safeResult;
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    const clearOpts = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
    };
    res.clearCookie('access_token', clearOpts);
    res.clearCookie('refresh_token', clearOpts);
    return { message: 'Logout realizado com sucesso' };
  }
}
