import { IsNotEmpty, IsNumber, IsString, Matches, Min } from 'class-validator';

export class UpsertCategoryBudgetDto {
  @IsString({ message: 'categoryId deve ser string' })
  @IsNotEmpty({ message: 'categoryId é obrigatório' })
  categoryId: string;

  @IsString({ message: 'month deve ser string' })
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'month deve estar no formato YYYY-MM',
  })
  month: string;

  @IsNumber({}, { message: 'limit deve ser número' })
  @Min(0, { message: 'limit deve ser maior ou igual a zero' })
  limit: number;
}
