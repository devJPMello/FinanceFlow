import { IsOptional, IsEnum, IsString } from 'class-validator';
import { TransactionType } from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class CategoryQueryDto extends PaginationDto {
  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;
}
