import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import type { AuthUser } from 'src/auth/types/auth-user.type';
import { TrendRangeQueryDto } from 'src/common/date/trend-range-query.dto';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'MANAGER')
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get('stats')
  getStats(@CurrentUser() user: AuthUser) {
    return this.dashboardService.getStats(user);
  }

  @Get('sales-trend')
  getSalesTrend(
    @CurrentUser() user: AuthUser,
    @Query() query: TrendRangeQueryDto,
  ) {
    return this.dashboardService.getSalesTrend(user, query.range ?? 'daily');
  }

  @Get('sales-by-category')
  getSalesByCategory(
    @CurrentUser() user: AuthUser,
    @Query() query: TrendRangeQueryDto,
  ) {
    return this.dashboardService.getSalesByCategory(
      user,
      query.range ?? 'daily',
    );
  }

  @Get('recent-transactions')
  getRecentTransactions(
    @CurrentUser() user: AuthUser,
    @Query('limit') limit?: string,
  ) {
    return this.dashboardService.getRecentTransactions(
      user,
      Number(limit) || 5,
    );
  }

  @Get('top-products')
  getTopProducts(
    @CurrentUser() user: AuthUser,
    @Query() query: TrendRangeQueryDto,
    @Query('limit') limit?: string,
  ) {
    return this.dashboardService.getTopProducts(
      user,
      query.range ?? 'daily',
      Number(limit) || 5,
    );
  }
}
