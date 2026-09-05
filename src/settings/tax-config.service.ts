import { Injectable } from '@nestjs/common';
import { AuthUser } from 'src/auth/types/auth-user.type';
import { PrismaService } from 'src/database/prisma.service';
import { UpdateTaxConfigDto } from './dto/update-tax-config.dto';

@Injectable()
export class TaxConfigService {
  constructor(private prisma: PrismaService) {}

  get(user: AuthUser) {
    return this.prisma.taxConfig.upsert({
      where: { organizationId: user.organizationId },
      update: {},
      create: { organizationId: user.organizationId },
    });
  }

  update(user: AuthUser, dto: UpdateTaxConfigDto) {
    return this.prisma.taxConfig.upsert({
      where: { organizationId: user.organizationId },
      update: dto,
      create: { ...dto, organizationId: user.organizationId },
    });
  }
}
