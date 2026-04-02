import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ArrayMinSize,
} from 'class-validator';

export class BatchTransactionsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  transactionIds: string[];

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsBoolean()
  deductiblePotential?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  userNote?: string;
}
