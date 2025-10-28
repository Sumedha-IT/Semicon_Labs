import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class RedisService {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  async setOtp(email: string, otp: string, expiryInSeconds: number): Promise<void> {
    const key = `otp:register:${email}`;
    await this.cacheManager.set(key, otp, expiryInSeconds * 1000);
  }

  async getOtp(email: string): Promise<string | undefined> {
    const key = `otp:register:${email}`;
    return await this.cacheManager.get(key);
  }

  async deleteOtp(email: string): Promise<void> {
    const key = `otp:register:${email}`;
    await this.cacheManager.del(key);
  }

  async incrementCounter(key: string, ttlSeconds: number): Promise<number> {
    const count = await this.cacheManager.get<number>(key) || 0;
    const newCount = count + 1;
    await this.cacheManager.set(key, newCount, ttlSeconds * 1000);
    return newCount;
  }

  async resetCounter(key: string): Promise<void> {
    await this.cacheManager.del(key);
  }

  async get<T>(key: string): Promise<T | undefined> {
    return await this.cacheManager.get<T>(key);
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.cacheManager.set(key, value, ttlSeconds * 1000);
    } else {
      await this.cacheManager.set(key, value);
    }
  }
}