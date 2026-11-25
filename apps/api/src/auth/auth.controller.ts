import { Body, Controller, Delete, Get, HttpCode, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { changePasswordSchema, forgotPasswordSchema, resetPasswordSchema, ForgotPasswordInput, ResetPasswordInput, loginSchema, profileSchema, registerSchema, ChangePasswordInput, LoginInput, ProfileInput, RegisterInput } from '@financeflow/shared';
import { CurrentUser, Public } from '../common/decorators';
import { ZodPipe } from '../common/zod.pipe';
import { AuthService } from './auth.service';

@ApiTags('auth')
@ApiBearerAuth()
@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public()
  @Post('register')
  register(@Body(new ZodPipe(registerSchema)) dto: RegisterInput) {
    return this.auth.register(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  login(@Body(new ZodPipe(loginSchema)) dto: LoginInput) {
    return this.auth.login(dto);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('forgot-password')
  @HttpCode(204)
  forgot(@Body(new ZodPipe(forgotPasswordSchema)) dto: ForgotPasswordInput) {
    return this.auth.forgotPassword(dto);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('reset-password')
  @HttpCode(204)
  reset(@Body(new ZodPipe(resetPasswordSchema)) dto: ResetPasswordInput) {
    return this.auth.resetPassword(dto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  refresh(@Body('refreshToken') token: string) {
    return this.auth.refresh(token);
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  logout(@Body('refreshToken') token: string) {
    return this.auth.logout(token);
  }

  @Get('me')
  me(@CurrentUser() userId: string) {
    return this.auth.me(userId);
  }

  @Patch('me')
  updateMe(@CurrentUser() userId: string, @Body(new ZodPipe(profileSchema)) dto: ProfileInput) {
    return this.auth.updateProfile(userId, dto);
  }

  @Post('change-password')
  @HttpCode(200)
  changePassword(@CurrentUser() userId: string, @Body(new ZodPipe(changePasswordSchema)) dto: ChangePasswordInput) {
    return this.auth.changePassword(userId, dto);
  }

  @Delete('me')
  @HttpCode(204)
  deleteMe(@CurrentUser() userId: string, @Body('password') password: string) {
    return this.auth.deleteAccount(userId, password);
  }
}
