import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class OtpService {
  private readonly otpLength: number;
  private readonly otpExpiryMinutes: number;
  private readonly maxOtpAttempts: number;

  constructor(
    private configService: ConfigService,
    private redisService: RedisService,
  ) {
    this.otpLength = this.configService.get<number>('OTP_LENGTH', 6);
    this.otpExpiryMinutes = this.configService.get<number>('OTP_EXPIRY_MINUTES', 5);
    this.maxOtpAttempts = this.configService.get<number>('MAX_OTP_ATTEMPTS', 5);
  }

  generateOtp(): string {
    const digits = '0123456789';
    let otp = '';
    for (let i = 0; i < this.otpLength; i++) {
      otp += digits[Math.floor(Math.random() * digits.length)];
    }
    return otp;
  }

  async storeOtp(email: string, otp: string, type: 'register' | 'login' | 'password_reset' = 'register'): Promise<void> {
    const key = `otp:${type}:${email}`;
    const expirySeconds = this.otpExpiryMinutes * 60;
    await this.redisService.set(key, otp, expirySeconds);
  }

  async validateOtp(email: string, inputOtp: string, type: 'register' | 'login' | 'password_reset' = 'register'): Promise<boolean> {
    const key = `otp:${type}:${email}`;
    const storedOtp = await this.redisService.get(key);
    return storedOtp === inputOtp;
  }

  async deleteOtp(email: string, type: 'register' | 'login' | 'password_reset' = 'register'): Promise<void> {
    const key = `otp:${type}:${email}`;
    await this.redisService.set(key, null, 0);
  }

  async trackAttempt(email: string, type: 'register' | 'login' | 'password_reset' = 'register'): Promise<number> {
    const attemptKey = `otp:attempts:${type}:${email}`;
    const expirySeconds = this.otpExpiryMinutes * 60;
    const attempts = await this.redisService.incrementCounter(attemptKey, expirySeconds);
    return attempts;
  }

  async getRemainingAttempts(email: string, type: 'register' | 'login' | 'password_reset' = 'register'): Promise<number> {
    const attemptKey = `otp:attempts:${type}:${email}`;
    const attempts = await this.redisService.get<number>(attemptKey) || 0;
    return this.maxOtpAttempts - attempts;
  }

  async canResend(email: string): Promise<boolean> {
    const key = `otp:resend:${email}`;
    const count = await this.redisService.get<number>(key) || 0;
    return count < this.configService.get<number>('MAX_RESEND_ATTEMPTS', 3);
  }

  async trackResend(email: string): Promise<void> {
    const key = `otp:resend:${email}`;
    const ttlSeconds = 3600; // 1 hour
    await this.redisService.incrementCounter(key, ttlSeconds);
  }

  async resetAttempts(email: string, type: 'register' | 'login' | 'password_reset' = 'register'): Promise<void> {
    const attemptKey = `otp:attempts:${type}:${email}`;
    await this.redisService.set(attemptKey, null, 0);
  }
}