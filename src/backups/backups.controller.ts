import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import type { AuthUser } from 'src/auth/types/auth-user.type';
import { PaginationQueryDto } from 'src/common/pagination/pagination-query.dto';
import { BackupScheduleService } from './backup-schedule.service';
import { BackupsService } from './backups.service';
import { CreateBackupDto } from './dto/create-backup.dto';
import { UpdateBackupScheduleDto } from './dto/update-backup-schedule.dto';

@Controller('backups')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class BackupsController {
  constructor(
    private backupsService: BackupsService,
    private backupScheduleService: BackupScheduleService,
  ) {}

  // Declared before ':id' so 'schedule' isn't captured as an :id param.
  @Get('schedule')
  getSchedule(@CurrentUser() user: AuthUser) {
    return this.backupScheduleService.get(user);
  }

  @Put('schedule')
  updateSchedule(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateBackupScheduleDto,
  ) {
    return this.backupScheduleService.update(user, dto);
  }

  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query() query: PaginationQueryDto) {
    return this.backupsService.findAll(user, query);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateBackupDto) {
    return this.backupsService.create(user, dto);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.backupsService.findOne(user, id);
  }

  @Get(':id/download')
  download(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    return this.backupsService.download(user, id, res);
  }

  @Post(':id/restore')
  restore(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.backupsService.restore(user, id);
  }
}
