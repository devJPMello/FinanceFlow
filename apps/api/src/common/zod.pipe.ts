import { BadRequestException, PipeTransform } from '@nestjs/common';
import { ZodSchema } from 'zod';

export class ZodPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: unknown) {
    const r = this.schema.safeParse(value);
    if (!r.success) {
      throw new BadRequestException(r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`));
    }
    return r.data;
  }
}
