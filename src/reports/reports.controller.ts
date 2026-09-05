import { Controller, Get, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import type { AuthUser } from 'src/auth/types/auth-user.type';
import { DateRangeQueryDto } from 'src/common/date/date-range-query.dto';
import { TrendRangeQueryDto } from 'src/common/date/trend-range-query.dto';
import { ExportReportQueryDto } from './dto/export-report-query.dto';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'MANAGER')
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get('summary-stats')
  summaryStats(
    @CurrentUser() user: AuthUser,
    @Query() query: TrendRangeQueryDto,
  ) {
    return this.reportsService.summaryStats(user, query.range ?? 'daily');
  }

  @Get('revenue-expenses')
  revenueExpenses(
    @CurrentUser() user: AuthUser,
    @Query() query: TrendRangeQueryDto,
  ) {
    return this.reportsService.revenueExpenses(user, query.range ?? 'daily');
  }

  @Get('sales-by-category')
  salesByCategory(
    @CurrentUser() user: AuthUser,
    @Query() query: DateRangeQueryDto,
  ) {
    return this.reportsService.salesByCategory(user, query.from, query.to);
  }

  @Get('gst-summary')
  gstSummary(@CurrentUser() user: AuthUser, @Query() query: DateRangeQueryDto) {
    return this.reportsService.gstSummary(user, query.from, query.to);
  }

  @Get('export')
  async export(
    @CurrentUser() user: AuthUser,
    @Query() query: ExportReportQueryDto,
    @Res() res: Response,
  ) {
    if (query.format === 'xlsx') {
      const buffer = await this.reportsService.exportReportXlsx(
        user,
        query.from,
        query.to,
      );
      res.header(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.attachment('report.xlsx');
      res.send(buffer);
      return;
    }

    const csv = await this.reportsService.exportReportCsv(
      user,
      query.from,
      query.to,
    );
    res.header('Content-Type', 'text/csv');
    res.attachment('report.csv');
    res.send(csv);
  }

  @Post('gst/generate')
  generateGstReport(
    @CurrentUser() user: AuthUser,
    @Query() query: DateRangeQueryDto,
    @Res() res: Response,
  ) {
    return this.reportsService.generateGstPdf(user, query.from, query.to, res);
  }
}
