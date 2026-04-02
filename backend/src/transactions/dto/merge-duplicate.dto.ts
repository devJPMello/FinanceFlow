import { IsUUID } from 'class-validator';

export class MergeDuplicateDto {
  @IsUUID()
  keepTransactionId: string;

  @IsUUID()
  removeTransactionId: string;
}
