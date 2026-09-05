import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import type { AuthUser } from 'src/auth/types/auth-user.type';
import { UpdateInvoiceConfigDto } from './dto/update-invoice-config.dto';
import { UpdateRegionalSettingsDto } from './dto/update-regional-settings.dto';
import { UpdateTaxConfigDto } from './dto/update-tax-config.dto';
import { InvoiceConfigService } from './invoice-config.service';
import { RegionalSettingsService } from './regional-settings.service';
import { TaxConfigService } from './tax-config.service';

@Controller('settings')
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(
    private taxConfigService: TaxConfigService,
    private invoiceConfigService: InvoiceConfigService,
    private regionalSettingsService: RegionalSettingsService,
  ) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('tax-config')
  getTaxConfig(@CurrentUser() user: AuthUser) {
    return this.taxConfigService.get(user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Put('tax-config')
  updateTaxConfig(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateTaxConfigDto,
  ) {
    return this.taxConfigService.update(user, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MANAGER')
  @Get('invoice-config')
  getInvoiceConfig(@CurrentUser() user: AuthUser) {
    return this.invoiceConfigService.get(user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MANAGER')
  @Put('invoice-config')
  updateInvoiceConfig(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateInvoiceConfigDto,
  ) {
    return this.invoiceConfigService.update(user, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MANAGER')
  @Get('regional')
  getRegional(@CurrentUser() user: AuthUser) {
    return this.regionalSettingsService.get(user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MANAGER')
  @Put('regional')
  updateRegional(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateRegionalSettingsDto,
  ) {
    return this.regionalSettingsService.update(user, dto);
  }
}
