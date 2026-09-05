import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import type { AuthUser } from 'src/auth/types/auth-user.type';
import { DateRangeQueryDto } from 'src/common/date/date-range-query.dto';
import { ProductsService } from 'src/products/products.service';
import { ReportsService } from 'src/reports/reports.service';

@Controller('exports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class ExportsController {
  constructor(
    private reportsService: ReportsService,
    private productsService: ProductsService,
  ) {}

  @Get('sales')
  async exportSales(
    @CurrentUser() user: AuthUser,
    @Query() query: DateRangeQueryDto,
    @Res() res: Response,
  ) {
    const buffer = await this.reportsService.exportReportXlsx(
      user,
      query.from,
      query.to,
    );
    res.header(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.attachment('sales.xlsx');
    res.send(buffer);
  }

  @Get('inventory')
  async exportInventory(@CurrentUser() user: AuthUser, @Res() res: Response) {
    const csv = await this.productsService.exportCsv(user);
    res.header('Content-Type', 'text/csv');
    res.attachment('inventory.csv');
    res.send(csv);
  }

  @Get('tax-reports')
  exportTaxReports(
    @CurrentUser() user: AuthUser,
    @Query() query: DateRangeQueryDto,
    @Res() res: Response,
  ) {
    return this.reportsService.generateGstPdf(user, query.from, query.to, res);
  }
}
