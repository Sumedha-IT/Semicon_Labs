import { Injectable, UnauthorizedException, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { OtpService } from '../otp/otp.service';
import { MailService } from '../mail/mail.service';
import { RateLimiterService } from '../rate-limiter/rate-limiter.service';
import { RedisService } from '../redis/redis.service';
import { User } from '../users/entities/user.entity';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { VerifyLoginOtpDto } from './dto/verify-login-otp.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private otpService: OtpService,
    private mailService: MailService,
    private rateLimiterService: RateLimiterService,
    private redisService: RedisService,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  /**
   * Validate user credentials
   */
  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      return null;
    }

    if (!user.password_hash) {
      return null;
    }

    if (!password) {
      return null;
    }

    const isMatch = await bcrypt.compare(
      String(password),
      String(user.password_hash),
    );

    if (isMatch) {
      const { password_hash, ...result } = user;
      return result;
    }
    return null;
  }

  /**
   * Standard login (without OTP)
   */
  async login(loginDto: LoginDto) {
    try {
      const user = await this.validateUser(loginDto.email, loginDto.password);
      if (!user) {
        throw new UnauthorizedException('Invalid credentials');
      }

      const payload = {
        email: user.email,
        sub: user.id,
        role: user.role,
        orgId: user.org_id,
      };

      return {
        access_token: this.jwtService.sign(payload),
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      };
    } catch (error) {
      console.error('Error in login:', error);
      throw error;
    }
  }

  /**
   * Initiate login with OTP (2FA)
   */
  async initiateLogin(loginDto: LoginDto, ipAddress?: string) {
    // Check IP-based rate limit
    if (ipAddress) {
      const ipLimit = await this.rateLimiterService.checkIpLimit(ipAddress);
      if (!ipLimit.allowed) {
        throw new HttpException(
          `Too many requests from this IP. Try again at ${new Date(ipLimit.resetTime * 1000).toISOString()}`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    // Validate credentials
    const user = await this.validateUser(loginDto.email, loginDto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Users can login once password is valid - no is_verified check needed

    // Check rate limit for login attempts
    const loginLimit = await this.rateLimiterService.checkOperationLimit(
      'login',
      loginDto.email,
    );

    if (!loginLimit.allowed) {
      throw new HttpException(
        `Too many login attempts. Remaining: ${loginLimit.remaining}. Try again at ${new Date(loginLimit.resetTime * 1000).toISOString()}`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Generate and send OTP
    const otp = this.otpService.generateOtp();
    await this.otpService.storeOtp(loginDto.email, otp, 'login');
    await this.mailService.sendLoginOtp(loginDto.email, otp);

    return {
      message: 'OTP sent to your email',
      email: loginDto.email,
      remainingAttempts: loginLimit.remaining,
    };
  }

  /**
   * Verify email during registration
   */
  async verifyEmail(verifyEmailDto: VerifyEmailDto, ipAddress?: string) {
    // Check IP-based rate limit
    if (ipAddress) {
      const ipLimit = await this.rateLimiterService.checkIpLimit(ipAddress);
      if (!ipLimit.allowed) {
        throw new HttpException('Too many requests from this IP', HttpStatus.TOO_MANY_REQUESTS);
      }
    }

    // Get user first to check account status (may be null for pre-registration)
    const user = await this.usersService.findByEmail(verifyEmailDto.email);

    // Check if account is locked (only if user exists)
    if (user && user.account_locked_until && user.account_locked_until > new Date()) {
      const lockTimeRemaining = Math.ceil((user.account_locked_until.getTime() - Date.now()) / 60000);
      throw new BadRequestException(
        `Account is locked due to too many failed attempts. Try again in ${lockTimeRemaining} minutes.`
      );
    }

    // Check OTP
    const isValid = await this.otpService.validateOtp(
      verifyEmailDto.email,
      verifyEmailDto.otp,
      'register',
    );

    if (!isValid) {
      // Only track failed attempts if user exists
      if (user) {
        user.failed_otp_attempts = (user.failed_otp_attempts || 0) + 1;
        
        // Lock account after 5 failed attempts
        if (user.failed_otp_attempts >= 5) {
          const lockDurationMinutes = 30; // Lock for 30 minutes
          user.account_locked_until = new Date(Date.now() + lockDurationMinutes * 60 * 1000);
          await this.usersRepository.save(user);
          await this.otpService.deleteOtp(verifyEmailDto.email, 'register');
          throw new BadRequestException(
            `Account locked for 30 minutes due to too many failed attempts. Please try again later.`
          );
        }

        // Save failed attempts
        await this.usersRepository.save(user);
      }

      // Track in Redis as well
      const attempts = await this.otpService.trackAttempt(verifyEmailDto.email, 'register');
      const remaining = await this.otpService.getRemainingAttempts(verifyEmailDto.email, 'register');

      throw new BadRequestException(
        `Invalid OTP. ${remaining} attempts remaining before account lock`,
      );
    }

    // Handle two scenarios:
    // 1. User exists in database → they're already registered, don't need verification anymore
    if (user) {
      // Clear any old Redis flags
      await this.redisService.set(`pre_register_verified:${verifyEmailDto.email}`, null, 0);
      
      // Reset failed attempts
      user.failed_otp_attempts = 0;
      user.account_locked_until = null;
      await this.usersRepository.save(user);

      // Delete OTP
      await this.otpService.deleteOtp(verifyEmailDto.email, 'register');

      return {
        message: 'Email verified successfully. You can login now',
        email: verifyEmailDto.email,
      };
    }

    // 2. User doesn't exist (pre-registration verification) → mark in Redis only
    await this.redisService.set(
      `pre_register_verified:${verifyEmailDto.email}`,
      'true',
      60 * 60 * 24 * 30 // 30 days
    );

    // Delete OTP
    await this.otpService.deleteOtp(verifyEmailDto.email, 'register');

    return {
      message: 'Email verified successfully. Please complete your registration',
      email: verifyEmailDto.email,
      verified: true,
    };
  }

  /**
   * Resend verification OTP
   */
  async resendVerificationOtp(resendOtpDto: ResendOtpDto, ipAddress?: string) {
    if (ipAddress) {
      const ipLimit = await this.rateLimiterService.checkIpLimit(ipAddress);
      if (!ipLimit.allowed) {
        throw new HttpException('Too many requests from this IP', HttpStatus.TOO_MANY_REQUESTS);
      }
    }

    const user = await this.usersService.findByEmail(resendOtpDto.email);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    // No is_verified check needed - can always resend OTP

    // Check if account is locked
    if (user.account_locked_until && user.account_locked_until > new Date()) {
      const lockTimeRemaining = Math.ceil((user.account_locked_until.getTime() - Date.now()) / 60000);
      throw new BadRequestException(
        `Account is locked. Cannot resend OTP. Try again in ${lockTimeRemaining} minutes.`
      );
    }

    // Check resend limit
    const canResend = await this.otpService.canResend(resendOtpDto.email);
    if (!canResend) {
      throw new HttpException('Too many resend requests. Try again in 1 hour.', HttpStatus.TOO_MANY_REQUESTS);
    }

    // Reset failed attempts when resending OTP (give user another chance)
    user.failed_otp_attempts = 0;
    user.account_locked_until = null;
    await this.usersRepository.save(user);

    // Generate and send new OTP
    const otp = this.otpService.generateOtp();
    await this.otpService.storeOtp(resendOtpDto.email, otp, 'register');
    await this.otpService.trackResend(resendOtpDto.email);
    await this.mailService.sendVerificationOtp(resendOtpDto.email, otp);

    return {
      message: 'New OTP sent to your email',
      email: resendOtpDto.email,
    };
  }

  /**
   * Verify login OTP and return JWT
   */
  async verifyLoginOtp(verifyLoginOtpDto: VerifyLoginOtpDto, ipAddress?: string) {
    if (ipAddress) {
      const ipLimit = await this.rateLimiterService.checkIpLimit(ipAddress);
      if (!ipLimit.allowed) {
        throw new HttpException('Too many requests from this IP', HttpStatus.TOO_MANY_REQUESTS);
      }
    }

    // Get user first to check account status
    const user = await this.usersService.findByEmail(verifyLoginOtpDto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid user');
    }

    // Check if account is locked
    if (user.account_locked_until && user.account_locked_until > new Date()) {
      const lockTimeRemaining = Math.ceil((user.account_locked_until.getTime() - Date.now()) / 60000);
      throw new BadRequestException(
        `Account is locked due to too many failed attempts. Try again in ${lockTimeRemaining} minutes.`
      );
    }

    // Validate OTP
    const isValid = await this.otpService.validateOtp(
      verifyLoginOtpDto.email,
      verifyLoginOtpDto.otp,
      'login',
    );

    if (!isValid) {
      // Increment failed attempts in database
      user.failed_otp_attempts = (user.failed_otp_attempts || 0) + 1;
      
      // Lock account after 5 failed attempts
      if (user.failed_otp_attempts >= 5) {
        const lockDurationMinutes = 30; // Lock for 30 minutes
        user.account_locked_until = new Date(Date.now() + lockDurationMinutes * 60 * 1000);
        await this.usersRepository.save(user);
        await this.otpService.deleteOtp(verifyLoginOtpDto.email, 'login');
        throw new BadRequestException(
          `Account locked for 30 minutes due to too many failed attempts. Please try again later.`
        );
      }

      // Save failed attempts
      await this.usersRepository.save(user);

      // Track in Redis as well
      const attempts = await this.otpService.trackAttempt(verifyLoginOtpDto.email, 'login');
      const remaining = await this.otpService.getRemainingAttempts(verifyLoginOtpDto.email, 'login');

      throw new BadRequestException(`Invalid OTP. ${remaining} attempts remaining before account lock`);
    }

    // Reset failed attempts on successful login
    user.failed_otp_attempts = 0;
    user.account_locked_until = null;
    await this.usersRepository.save(user);

    // Generate JWT
    const payload = {
      email: user.email,
      sub: user.id,
      role: user.role,
      orgId: user.org_id,
    };

    const access_token = this.jwtService.sign(payload);

    // Delete OTP
    await this.otpService.deleteOtp(verifyLoginOtpDto.email, 'login');

    return {
      access_token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }

  /**
   * Initiate forgot password process
   */
  async forgotPassword(email: string, ipAddress?: string) {
    // Check IP-based rate limit
    if (ipAddress) {
      const ipLimit = await this.rateLimiterService.checkIpLimit(ipAddress);
      if (!ipLimit.allowed) {
        throw new HttpException('Too many requests from this IP', HttpStatus.TOO_MANY_REQUESTS);
      }
    }

    // Generic response to prevent user enumeration
    const genericMessage = { message: 'If this email exists, check your email for reset instructions' };

    const user = await this.usersService.findByEmail(email);
    if (!user) {
      return genericMessage;
    }

    // Check if account is locked
    if (user.account_locked_until && user.account_locked_until > new Date()) {
      return genericMessage;
    }

    // Check if user has a password (not SSO)
    if (!user.password_hash) {
      return genericMessage;
    }

    // Set pending reset flag
    await this.redisService.set(`password_reset_pending:${email}`, 'true', 30 * 60); // 30 minutes

    // Generate and send OTP with password_reset scope
    const otp = this.otpService.generateOtp();
    await this.otpService.storeOtp(email, otp, 'password_reset');
    await this.mailService.sendPasswordResetOtp(email, otp);

    return genericMessage;
  }

  /**
   * Verify forgot password OTP
   */
  async verifyForgotPasswordOtp(email: string, otp: string, ipAddress?: string) {
    // Check IP-based rate limit
    if (ipAddress) {
      const ipLimit = await this.rateLimiterService.checkIpLimit(ipAddress);
      if (!ipLimit.allowed) {
        throw new HttpException('Too many requests from this IP', HttpStatus.TOO_MANY_REQUESTS);
      }
    }

    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Invalid user');
    }

    // Check if account is locked
    if (user.account_locked_until && user.account_locked_until > new Date()) {
      const lockTimeRemaining = Math.ceil((user.account_locked_until.getTime() - Date.now()) / 60000);
      throw new BadRequestException(
        `Account is locked due to too many failed attempts. Try again in ${lockTimeRemaining} minutes.`,
      );
    }

    // Validate OTP
    const isValid = await this.otpService.validateOtp(email, otp, 'password_reset');
    if (!isValid) {
      user.failed_otp_attempts = (user.failed_otp_attempts || 0) + 1;

      // Lock account after 5 failed attempts
      if (user.failed_otp_attempts >= 5) {
        const lockDurationMinutes = 30;
        user.account_locked_until = new Date(Date.now() + lockDurationMinutes * 60 * 1000);
        await this.usersRepository.save(user);
        await this.otpService.deleteOtp(email, 'password_reset');
        throw new BadRequestException(
          'Account locked for 30 minutes due to too many failed attempts. Please try again later.',
        );
      }

      // Save failed attempts
      await this.usersRepository.save(user);

      // Track in Redis as well
      const remaining = await this.otpService.getRemainingAttempts(email, 'password_reset');

      throw new BadRequestException(`Invalid OTP. ${remaining} attempts remaining before account lock`);
    }

    // Reset failed attempts on success
    user.failed_otp_attempts = 0;
    user.account_locked_until = null;
    await this.usersRepository.save(user);

    // Delete OTP (one-time use)
    await this.otpService.deleteOtp(email, 'password_reset');

    // Set verified flag (expires in 30 minutes)
    await this.redisService.set(`password_reset_verified:${email}`, 'true', 30 * 60);

    return {
      message: 'OTP verified. You can reset your password now',
    };
  }

  /**
   * Reset password after OTP verification
   */
  async resetPassword(email: string, newPassword: string, confirmPassword: string) {
    // Check if reset session is verified
    const verified = await this.redisService.get<string>(`password_reset_verified:${email}`);
    if (!verified) {
      throw new UnauthorizedException(
        'Reset session expired or invalid. Please verify OTP again.',
      );
    }

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Invalid user');
    }

    // Check if new password is different from current password
    if (user.password_hash) {
      const isSamePassword = await bcrypt.compare(newPassword, user.password_hash);
      if (isSamePassword) {
        throw new BadRequestException('New password must be different from current password');
      }
    }

    // Hash and update password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password_hash = hashedPassword;

    // Reset failed attempts and unlock account
    user.failed_otp_attempts = 0;
    user.account_locked_until = null;
    await this.usersRepository.save(user);

    // Clear Redis flags
    await this.redisService.set(`password_reset_pending:${email}`, null, 0);
    await this.redisService.set(`password_reset_verified:${email}`, null, 0);

    return {
      message: 'Password reset successfully. You can now login with your new password.',
    };
  }
}