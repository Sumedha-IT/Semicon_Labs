import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailService {
  constructor(
    private mailerService: MailerService,
    private configService: ConfigService,
  ) {}

  async sendVerificationOtp(email: string, otp: string): Promise<void> {
    try {
      console.log('DEBUG: Attempting to send verification email to', email);
      const otpExpiryMinutes = this.configService.get<number>('OTP_EXPIRY_MINUTES', 5);
      
      const smtpHost = this.configService.get('SMTP_HOST');
      const smtpPort = this.configService.get('SMTP_PORT');
      const smtpUser = this.configService.get('SMTP_USER');
      
      console.log('DEBUG: SMTP Config:', { smtpHost, smtpPort, smtpUser });
      
      await this.mailerService.sendMail({
        to: email,
        subject: 'Verify Your Email Address',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #333;">Email Verification</h2>
            <p style="font-size: 16px; color: #666;">
              Your verification code is:
            </p>
            <div style="background: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0; border-radius: 5px;">
              <h1 style="font-size: 36px; color: #007bff; margin: 0; letter-spacing: 5px;">${otp}</h1>
            </div>
            <p style="font-size: 14px; color: #999;">
              This code expires in ${otpExpiryMinutes} minutes.
            </p>
            <p style="font-size: 14px; color: #999;">
              If you didn't request this code, please ignore this email.
            </p>
          </div>
        `,
        text: `Your verification code is: ${otp}. This code expires in ${otpExpiryMinutes} minutes.`,
      });
      
      console.log('DEBUG: Verification email sent successfully');
    } catch (error) {
      console.error('ERROR: Failed to send verification email');
      console.error('ERROR details:', error);
      console.error('ERROR message:', error.message);
      console.error('ERROR stack:', error.stack);
      throw error;
    }
  }

  async sendLoginOtp(email: string, otp: string): Promise<void> {
    try {
      console.log('DEBUG: Attempting to send login OTP email to', email);
      const otpExpiryMinutes = this.configService.get<number>('OTP_EXPIRY_MINUTES', 5);
      
      await this.mailerService.sendMail({
        to: email,
        subject: 'Your Login Verification Code',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #333;">Login Verification</h2>
            <p style="font-size: 16px; color: #666;">
              Someone is trying to log in to your account. Your verification code is:
            </p>
            <div style="background: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0; border-radius: 5px;">
              <h1 style="font-size: 36px; color: #007bff; margin: 0; letter-spacing: 5px;">${otp}</h1>
            </div>
            <p style="font-size: 14px; color: #999;">
              This code expires in ${otpExpiryMinutes} minutes.
            </p>
            <p style="font-size: 14px; color: #999;">
              If this wasn't you, please ignore this email.
            </p>
          </div>
        `,
        text: `Your login verification code is: ${otp}. This code expires in ${otpExpiryMinutes} minutes.`,
      });
      
      console.log('DEBUG: Login OTP email sent successfully');
    } catch (error) {
      console.error('ERROR: Failed to send login OTP email');
      console.error('ERROR details:', error);
      throw error;
    }
  }

  async sendSmsOtp(phoneNumber: string, otp: string): Promise<void> {
    try {
      console.log('DEBUG: Attempting to send SMS to', phoneNumber);
      const otpExpiryMinutes = this.configService.get<number>('OTP_EXPIRY_MINUTES', 5);
      
      // TODO: Integrate with SMS provider (Twilio, AWS SNS, etc.)
      // For now, this is a placeholder that logs the OTP
      console.log(`DEBUG: SMS OTP for ${phoneNumber}: ${otp}`);
      console.log(`DEBUG: OTP expires in ${otpExpiryMinutes} minutes`);
      
      // In production, you would integrate with an SMS service like:
      // - Twilio: await this.twilioClient.messages.create({ to: phoneNumber, body: `Your OTP is: ${otp}` });
      // - AWS SNS: await this.snsClient.publish({ PhoneNumber: phoneNumber, Message: `Your OTP is: ${otp}` });
      
      console.log('DEBUG: SMS OTP sent successfully (logged to console)');
    } catch (error) {
      console.error('ERROR: Failed to send SMS');
      console.error('ERROR details:', error);
      throw error;
    }
  }

  async sendPasswordResetOtp(email: string, otp: string): Promise<void> {
    try {
      console.log('DEBUG: Attempting to send password reset OTP email to', email);
      const otpExpiryMinutes = this.configService.get<number>('OTP_EXPIRY_MINUTES', 5);
      
      await this.mailerService.sendMail({
        to: email,
        subject: 'Password Reset Verification Code',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #333;">Password Reset Request</h2>
            <p style="font-size: 16px; color: #666;">
              You've requested to reset your password. Your verification code is:
            </p>
            <div style="background: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0; border-radius: 5px;">
              <h1 style="font-size: 36px; color: #dc3545; margin: 0; letter-spacing: 5px;">${otp}</h1>
            </div>
            <p style="font-size: 14px; color: #999;">
              This code expires in ${otpExpiryMinutes} minutes.
            </p>
            <p style="font-size: 14px; color: #999;">
              If you didn't request this code, please ignore this email and your password will remain unchanged.
            </p>
          </div>
        `,
        text: `Your password reset verification code is: ${otp}. This code expires in ${otpExpiryMinutes} minutes.`,
      });
      
      console.log('DEBUG: Password reset OTP email sent successfully');
    } catch (error) {
      console.error('ERROR: Failed to send password reset OTP email');
      console.error('ERROR details:', error);
      throw error;
    }
  }
}