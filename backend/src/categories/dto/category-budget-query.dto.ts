import { IsOptional, IsString, Matches } from 'class-validator';

export class CategoryBudgetQueryDto {
  @IsOptional()
  @IsString({ message: 'month deve ser string' })
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'month deve estar no formato YYYY-MM',
  })
  month?: string;
}
