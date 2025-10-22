import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      console.log(`Login failed: User not found with email: ${email}`);
      return null;
    }

    if (!user.password_hash) {
      console.log(
        `Login failed: User ${email} has no password_hash in database`,
      );
      return null;
    }

    if (!password) {
      console.log(`Login failed: No password provided`);
      return null;
    }

    console.log(`Attempting password comparison for user: ${email}`);
    const isMatch = await bcrypt.compare(
      String(password),
      String(user.password_hash),
    );

    if (isMatch) {
      console.log(`Login successful for user: ${email}`);
      const { password_hash, ...result } = user;
      return result;
    }

    console.log(`Login failed: Password mismatch for user: ${email}`);
    return null;
  }

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
      throw error; // Re-throw to be handled by the global exception filter
    }
  }
}
