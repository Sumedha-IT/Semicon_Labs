import { Controller, Get, Post, Body } from '@nestjs/common';
import { AppService } from './app.service';
import { MailService } from './mail/mail.service';
import { Public } from './common/decorator/public.decorator';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly mailService: MailService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  getHealth(): { status: string; timestamp: string } {
    return {
      status: 'OK',
      timestamp: new Date().toISOString(),
    };
  }

  // TEST ENDPOINT - Remove after testing
  @Public()
  @Post('test-email')
  async testEmail(@Body() body: { email: string; type?: 'verification' | 'login' }) {
    const testOtp = '123456';
    
    try {
      if (body.type === 'login') {
        await this.mailService.sendLoginOtp(body.email, testOtp);
      } else {
        await this.mailService.sendVerificationOtp(body.email, testOtp);
      }
      
      return {
        success: true,
        message: `Test email sent to ${body.email}`,
        otp: testOtp,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
