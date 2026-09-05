import { Injectable } from '@nestjs/common';
import { AuthUser } from 'src/auth/types/auth-user.type';
import { PrismaService } from 'src/database/prisma.service';
import { UpdateBusinessProfileDto } from './dto/update-business-profile.dto';

@Injectable()
export class BusinessProfileService {
  constructor(private prisma: PrismaService) {}

  async get(user: AuthUser) {
    const existing = await this.prisma.businessProfile.findUnique({
      where: { organizationId: user.organizationId },
    });
    if (existing) return existing;

    const name = await this.defaultName(user.organizationId);
    return this.prisma.businessProfile.create({
      data: { organizationId: user.organizationId, name },
    });
  }

  async update(user: AuthUser, dto: UpdateBusinessProfileDto) {
    const name = dto.name ?? (await this.defaultName(user.organizationId));
    return this.prisma.businessProfile.upsert({
      where: { organizationId: user.organizationId },
      update: dto,
      create: { ...dto, name, organizationId: user.organizationId },
    });
  }

  async setLogo(user: AuthUser, logoUrl: string) {
    const name = await this.defaultName(user.organizationId);
    return this.prisma.businessProfile.upsert({
      where: { organizationId: user.organizationId },
      update: { logoUrl },
      create: { organizationId: user.organizationId, name, logoUrl },
    });
  }

  private async defaultName(organizationId: string): Promise<string> {
    const org = await this.prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { name: true },
    });
    return org.name;
  }
}
