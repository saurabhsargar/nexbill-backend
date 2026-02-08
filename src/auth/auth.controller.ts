import { Controller, Post, Body, UseGuards, Get, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { RegisterOrganizationDto } from './dto/register-organization.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) { }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(
      dto.email,
      dto.password,
      dto.organizationSlug,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@CurrentUser() user: any) {
    const dbUser = await this.authService.getMe(user.id);

    if (!dbUser) {
      throw new UnauthorizedException('User not found');
    }

    return {
      id: dbUser.id,
      name: dbUser.name,
      email: dbUser.email,
      role: dbUser.role,
      organization: dbUser.organization,
    };
  }

  @Post('register-org')
  registerOrg(@Body() dto: RegisterOrganizationDto) {
    return this.authService.registerOrganization(dto);
  }

}
