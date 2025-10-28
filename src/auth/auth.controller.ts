import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpStatus,
  HttpCode,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { UnifiedLoginDto } from './dto/unified-login.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { VerifyLoginOtpDto } from './dto/verify-login-otp.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { VerifyForgotPasswordOtpDto } from './dto/verify-forgot-password-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { Public } from '../common/decorator/public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Standard login (legacy - without OTP 2FA)
   * Keep this for backward compatibility
   */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: UnifiedLoginDto, @Req() req: Request) {
    const ipAddress = req.ip || req.connection.remoteAddress;
    if (loginDto.useOtp) {
      return this.authService.initiateLogin(loginDto, ipAddress as string);
    }
    return this.authService.login(loginDto);
  }

  /**
   * Verify email during registration
   * POST /api/v1/auth/verifyEmail
   */
  @Public()
  @Post('verifyEmail')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(
    @Body() verifyEmailDto: VerifyEmailDto,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip || req.connection.remoteAddress;
    return this.authService.verifyEmail(verifyEmailDto, ipAddress as string);
  }

  /**
   * Resend verification OTP
   * POST /api/v1/auth/resendVerificationOtp
   */
  @Public()
  @Post('resendVerificationOtp')
  @HttpCode(HttpStatus.OK)
  async resendVerificationOtp(
    @Body() resendOtpDto: ResendOtpDto,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip || req.connection.remoteAddress;
    return this.authService.resendVerificationOtp(resendOtpDto, ipAddress as string);
  }

  /**
   * Initiate login with OTP (2FA)
   * POST /api/v1/auth/loginWithOtp
   */
  @Public()
  @Post('loginWithOtp')
  @HttpCode(HttpStatus.OK)
  async initiateLogin(
    @Body() loginDto: LoginDto,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip || req.connection.remoteAddress;
    return this.authService.initiateLogin(loginDto, ipAddress as string);
  }

  /**
   * Verify login OTP and get JWT token
   * POST /api/v1/auth/verifyLoginOtp
   */
  @Public()
  @Post('verifyLoginOtp')
  @HttpCode(HttpStatus.OK)
  async verifyLoginOtp(
    @Body() verifyLoginOtpDto: VerifyLoginOtpDto,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip || req.connection.remoteAddress;
    return this.authService.verifyLoginOtp(verifyLoginOtpDto, ipAddress as string);
  }

  /**
   * Initiate forgot password process
   * POST /api/v1/auth/forgotPassword
   */
  @Public()
  @Post('forgotPassword')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() body: ForgotPasswordDto, @Req() req: Request) {
    const ipAddress = req.ip || req.connection.remoteAddress;
    return this.authService.forgotPassword(body.email, ipAddress as string);
  }

  /**
   * Verify forgot password OTP
   * POST /api/v1/auth/verifyForgotPasswordOtp
   */
  @Public()
  @Post('verifyForgotPasswordOtp')
  @HttpCode(HttpStatus.OK)
  async verifyForgotPasswordOtp(
    @Body() body: VerifyForgotPasswordOtpDto,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip || req.connection.remoteAddress;
    return this.authService.verifyForgotPasswordOtp(body.email, body.otp, ipAddress as string);
  }

  /**
   * Reset password after OTP verification
   * POST /api/v1/auth/resetPassword
   */
  @Public()
  @Post('resetPassword')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() body: ResetPasswordDto) {
    return this.authService.resetPassword(body.email, body.newPassword, body.confirmPassword);
  }
}
