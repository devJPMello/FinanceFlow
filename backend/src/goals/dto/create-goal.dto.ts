import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsDateString,
  Min,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateGoalDto {
  @IsString({ message: 'Título deve ser uma string' })
  @IsNotEmpty({ message: 'Título é obrigatório' })
  @MaxLength(100, { message: 'Título deve ter no máximo 100 caracteres' })
  title: string;

  @IsNumber({}, { message: 'Valor-alvo deve ser um número' })
  @IsNotEmpty({ message: 'Valor-alvo é obrigatório' })
  @Min(0.01, { message: 'Valor-alvo deve ser maior que zero' })
  @Type(() => Number)
  targetAmount: number;

  @IsDateString({}, { message: 'Data limite inválida' })
  @IsNotEmpty({ message: 'Data limite é obrigatória' })
  deadline: string;
}
