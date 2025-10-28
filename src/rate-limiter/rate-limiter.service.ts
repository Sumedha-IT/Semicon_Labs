import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { ConfigService } from '@nestjs/config';

export interface RateLimitResult {
  allowed: boolean;
  resetTime: number; // Unix timestamp when limit resets
  remaining: number;
}

@Injectable()
export class RateLimiterService {
  constructor(
    private redisService: RedisService,
    private configService: ConfigService,
  ) {}

  /**
   * Check if a request should be rate-limited
   * @param key Unique key (e.g., email, IP address)
   * @param limit Maximum number of requests allowed
   * @param windowSeconds Time window in seconds
   * @returns RateLimitResult
   */
  async checkLimit(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<RateLimitResult> {
    const redisKey = `rate:${key}`;
    
    // Get current count
    const current = await this.redisService.get<number>(redisKey) || 0;
    
    if (current >= limit) {
      // Calculate reset time
      const resetTime = Date.now() + (windowSeconds * 1000);
      return {
        allowed: false,
        resetTime: Math.floor(resetTime / 1000),
        remaining: 0,
      };
    }

    // Increment counter
    const newCount = await this.redisService.incrementCounter(
      redisKey,
      windowSeconds,
    );

    return {
      allowed: true,
      resetTime: Math.floor(Date.now() / 1000) + windowSeconds,
      remaining: Math.max(0, limit - newCount),
    };
  }

  /**
   * Check rate limit for specific operation (registration, login, resend)
   */
  async checkOperationLimit(
    operation: 'register' | 'login' | 'resend' | 'verify',
    identifier: string, // email or IP
  ): Promise<RateLimitResult> {
    const limits = {
      register: {
        limit: this.configService.get<number>('RATE_LIMIT_REGISTER_PER_HOUR', 3),
        window: 3600, // 1 hour
      },
      login: {
        limit: this.configService.get<number>('RATE_LIMIT_LOGIN_PER_15MIN', 5),
        window: 900, // 15 minutes
      },
      resend: {
        limit: this.configService.get<number>('MAX_RESEND_ATTEMPTS', 3),
        window: 3600, // 1 hour
      },
      verify: {
        limit: this.configService.get<number>('MAX_OTP_ATTEMPTS', 5),
        window: 300, // 5 minutes (same as OTP expiry)
      },
    };

    const config = limits[operation];
    const redisKey = `${operation}:${identifier}`;
    
    return this.checkLimit(redisKey, config.limit, config.window);
  }

  /**
   * Check IP-based rate limiting
   */
  async checkIpLimit(ip: string): Promise<RateLimitResult> {
    const limit = this.configService.get<number>('RATE_LIMIT_IP_PER_HOUR', 20);
    const window = 3600; // 1 hour
    const redisKey = `ip:${ip}`;
    
    return this.checkLimit(redisKey, limit, window);
  }

  /**
   * Reset rate limit for a key
   */
  async resetLimit(key: string): Promise<void> {
    await this.redisService.resetCounter(key);
  }

  /**
   * Get remaining attempts for an operation
   */
  async getRemainingAttempts(
    operation: string,
    identifier: string,
  ): Promise<number> {
    const redisKey = `${operation}:${identifier}`;
    const current = await this.redisService.get<number>(redisKey) || 0;
    
    const limits = {
      register: this.configService.get<number>('RATE_LIMIT_REGISTER_PER_HOUR', 3),
      login: this.configService.get<number>('RATE_LIMIT_LOGIN_PER_15MIN', 5),
      resend: this.configService.get<number>('MAX_RESEND_ATTEMPTS', 3),
      verify: this.configService.get<number>('MAX_OTP_ATTEMPTS', 5),
    };

    const limit = limits[operation] || 5;
    return Math.max(0, limit - current);
  }
}