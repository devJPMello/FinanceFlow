import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ArrayMinSize,
  ValidateNested,
} from 'class-validator';
import { TransactionType } from '@prisma/client';

export class ConfirmImportRowDto {
  @IsDateString()
  date: string;

  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  amount: number;

  @IsEnum(TransactionType)
  type: TransactionType;

  @IsString()
  @MaxLength(255)
  description: string;

  @IsUUID()
  categoryId: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  bankMemo?: string;

  /** Para despesas: sobrepõe a heurística da categoria (ex.: sugestão IA no preview) */
  @IsOptional()
  @IsBoolean()
  deductiblePotential?: boolean;
}

export class ConfirmImportDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ConfirmImportRowDto)
  rows: ConfirmImportRowDto[];
}
