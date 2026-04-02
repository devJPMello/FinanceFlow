import { IsInt, IsOptional, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class TaxYearQueryDto {
  @ApiPropertyOptional({ example: 2026, description: 'Ano-calendário (padrão: ano atual)' })
  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;
}
