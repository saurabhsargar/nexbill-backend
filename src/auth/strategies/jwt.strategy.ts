import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from 'src/database/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  async validate(payload: any) {
    // 🔒 Fetch user from DB (DB is authority)
    const user = await this.prisma.user.findFirst({
      where: {
        id: payload.sub,
        organizationId: payload.organizationId,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid token');
    }

    // 🚫 Block deactivated users immediately
    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    return {
      id: user.id,
      role: user.role,
      organizationId: user.organizationId,
    };
  }
}