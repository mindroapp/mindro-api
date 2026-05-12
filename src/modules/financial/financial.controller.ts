import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { FinancialService } from './financial.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';

@Controller('financial')
export class FinancialController {
  constructor(private readonly financialService: FinancialService) {}

  // ─── Payments ───────────────────────────────────────────────────────────────

  @Get('payments')
  getPayments(@CurrentUser() user: any, @Query('patientId') patientId?: string) {
    if (patientId) return this.financialService.getPaymentsByPatient(patientId, user.id);
    return this.financialService.getPayments(user.id);
  }

  @Post('payments')
  createPayment(@Body() dto: CreatePaymentDto, @CurrentUser() user: any) {
    return this.financialService.createPayment(dto, user.id);
  }

  @Patch('payments/:id')
  updatePayment(@Param('id') id: string, @Body() dto: UpdatePaymentDto, @CurrentUser() user: any) {
    return this.financialService.updatePayment(id, dto, user.id);
  }

  @Delete('payments/:id')
  @HttpCode(204)
  deletePayment(@Param('id') id: string, @CurrentUser() user: any) {
    return this.financialService.deletePayment(id, user.id);
  }

  // ─── Stats ──────────────────────────────────────────────────────────────────

  @Get('summary')
  getSummary(@CurrentUser() user: any) {
    return this.financialService.getSummary(user.id, user.email);
  }

  @Get('monthly')
  getMonthlyRevenue(@CurrentUser() user: any, @Query('year') year?: string) {
    const y = year ? parseInt(year) : new Date().getFullYear();
    return this.financialService.getMonthlyRevenue(user.id, y);
  }

  @Get('debtors')
  getDebtors(@CurrentUser() user: any) {
    return this.financialService.getDebtors(user.id);
  }
}
