import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  MaxLength,
  Matches,
} from 'class-validator';
import { TransactionType } from '@prisma/client';

export class CreateCategoryDto {
  @IsString({ message: 'Nome deve ser uma string' })
  @IsNotEmpty({ message: 'Nome é obrigatório' })
  @MaxLength(50, { message: 'Nome deve ter no máximo 50 caracteres' })
  name: string;

  @IsEnum(TransactionType, {
    message: 'Tipo deve ser INCOME ou EXPENSE',
  })
  @IsNotEmpty({ message: 'Tipo é obrigatório' })
  type: TransactionType;

  @IsString({ message: 'Cor deve ser uma string' })
  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'Cor deve estar no formato hexadecimal (#RRGGBB)',
  })
  color?: string;

  @IsString({ message: 'Ícone deve ser uma string' })
  @IsOptional()
  @MaxLength(50, { message: 'Ícone deve ter no máximo 50 caracteres' })
  icon?: string;
}
