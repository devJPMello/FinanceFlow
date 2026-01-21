import { IsUUID } from 'class-validator';

export class ParamIdDto {
  @IsUUID('4', { message: 'ID deve ser um UUID válido' })
  id: string;
}
