import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserPayload } from '../common/interfaces/user.interface';
import { AccountantPackageService } from './accountant-package.service';

@ApiTags('accountant')
@Controller('accountant')
@UseGuards(ClerkAuthGuard)
@ApiBearerAuth('JWT-auth')
export class AccountantController {
  constructor(private readonly accountant: AccountantPackageService) {}

  @Get('package.zip')
  @ApiOperation({
    summary: 'Pacote ZIP para contador: CSV, PDF resumo, anexos por categoria, checklist',
  })
  async packageZip(
    @CurrentUser() user: UserPayload,
    @Res() res: Response,
    @Query('year') yearStr?: string,
    @Query('month') month?: string,
  ) {
    const year = yearStr ? Math.min(2100, Math.max(2000, Number(yearStr))) : new Date().getFullYear();
    await this.accountant.streamZipToResponse(user.id, res, year, month);
  }
}
