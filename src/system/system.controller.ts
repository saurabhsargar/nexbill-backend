import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { SystemService } from './system.service';

@Controller('system')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class SystemController {
  constructor(private systemService: SystemService) {}

  @Get('health')
  getHealth() {
    return this.systemService.getHealth();
  }

  @Post('optimize-db')
  optimizeDb() {
    return this.systemService.optimizeDb();
  }

  @Post('clear-cache')
  clearCache() {
    return this.systemService.clearCache();
  }
}
