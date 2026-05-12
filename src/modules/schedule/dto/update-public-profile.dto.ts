import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdatePublicProfileDto {
  @IsOptional()
  @IsString()
  avatar?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  pageName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  bio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  instagram?: string;
}
