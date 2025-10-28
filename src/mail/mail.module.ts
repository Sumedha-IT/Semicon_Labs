import { Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';

@Module({
  imports: [
    MailerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const port = parseInt(configService.get('SMTP_PORT') || '587');
        const isSecure = configService.get('SMTP_SECURE') === 'true' || configService.get('SMTP_SECURE') === true;
        
        const host = configService.get('SMTP_HOST');
        const user = configService.get('SMTP_USER');
        const pass = configService.get('SMTP_PASS');
        const from = configService.get('SMTP_FROM');
        
        // Log configuration (without password for security)
        console.log('=== MAIL MODULE CONFIG ===');
        console.log('Host:', host);
        console.log('Port:', port);
        console.log('User:', user);
        console.log('From:', from);
        console.log('Secure:', isSecure);
        console.log('Password length:', pass?.length || 0);
        console.log('========================');
        
        return {
          transport: {
            host: host,
            port: port,
            secure: isSecure, // true for 465, false for other ports like 587
            auth: {
              user: user,
              pass: pass,
            },
            // Require STARTTLS for ports like 587
            requireTLS: !isSecure,
            tls: {
              rejectUnauthorized: false, // Accept self-signed certificates (for testing)
            },
          },
          defaults: {
            from: from,
          },
        };
      },
    }),
  ],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}