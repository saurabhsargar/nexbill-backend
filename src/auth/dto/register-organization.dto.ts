import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';

export class RegisterOrganizationDto {
  @IsNotEmpty()
  organizationName: string;

  @IsNotEmpty()
  organizationSlug: string;

  @IsNotEmpty()
  adminName: string;

  @IsEmail()
  adminEmail: string;

  @MinLength(6)
  password: string;
}