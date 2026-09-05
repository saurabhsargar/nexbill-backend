import { IsEmail, IsOptional } from 'class-validator';

export class UpdateBusinessProfileDto {
  @IsOptional()
  name?: string;

  @IsOptional()
  gstin?: string;

  @IsOptional()
  pan?: string;

  @IsOptional()
  state?: string;

  @IsOptional()
  stateCode?: string;

  @IsOptional()
  address?: string;

  @IsOptional()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}
