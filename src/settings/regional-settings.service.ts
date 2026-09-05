import { Injectable } from '@nestjs/common';
import { AuthUser } from 'src/auth/types/auth-user.type';
import { PrismaService } from 'src/database/prisma.service';
import { UpdateRegionalSettingsDto } from './dto/update-regional-settings.dto';

@Injectable()
export class RegionalSettingsService {
  constructor(private prisma: PrismaService) {}

  get(user: AuthUser) {
    return this.prisma.regionalSettings.upsert({
      where: { organizationId: user.organizationId },
      update: {},
      create: { organizationId: user.organizationId },
    });
  }

  update(user: AuthUser, dto: UpdateRegionalSettingsDto) {
    return this.prisma.regionalSettings.upsert({
      where: { organizationId: user.organizationId },
      update: dto,
      create: { ...dto, organizationId: user.organizationId },
    });
  }
}
