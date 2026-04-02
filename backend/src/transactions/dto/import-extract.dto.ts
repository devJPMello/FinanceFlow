import { Allow, IsOptional, IsString } from 'class-validator';

export class ImportExtractDto {
  /**
   * Em multipart/form-data o nome do campo do ficheiro (`file`) pode aparecer no body.
   */
  @Allow()
  @IsOptional()
  file?: unknown;

  @IsOptional()
  @IsString()
  defaultExpenseCategoryId?: string;

  @IsOptional()
  @IsString()
  defaultIncomeCategoryId?: string;
}
