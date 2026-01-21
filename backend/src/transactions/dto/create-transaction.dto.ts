import {
  IsEnum,
  IsNotEmpty,
  IsString,
  IsNumber,
  IsDateString,
  IsOptional,
  MaxLength,
  Min,
} from 'class-validator';
import { TransactionType } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreateTransactionDto {
  @IsEnum(TransactionType, {
    message: 'Tipo deve ser INCOME ou EXPENSE',
  })
  @IsNotEmpty({ message: 'Tipo é obrigatório' })
  type: TransactionType;

  @IsNumber({}, { message: 'Valor deve ser um número' })
  @IsNotEmpty({ message: 'Valor é obrigatório' })
  @Min(0.01, { message: 'Valor deve ser maior que zero' })
  @Type(() => Number)
  amount: number;

  @IsString({ message: 'Descrição deve ser uma string' })
  @IsOptional()
  @MaxLength(255, { message: 'Descrição deve ter no máximo 255 caracteres' })
  description?: string;

  @IsDateString({}, { message: 'Data inválida' })
  @IsNotEmpty({ message: 'Data é obrigatória' })
  date: string;

  @IsString({ message: 'Categoria é obrigatória' })
  @IsNotEmpty({ message: 'Categoria é obrigatória' })
  categoryId: string;
}
