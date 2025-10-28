export const EMAIL_TEMPLATES = {
    verificationSubject: 'Verify Your Email Address',
    loginOtpSubject: 'Your Login Verification Code',
    
    getVerificationHtml: (otp: string, expiryMinutes: number) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333;">Email Verification</h2>
        <p style="font-size: 16px; color: #666;">
          Your verification code is:
        </p>
        <div style="background: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0; border-radius: 5px;">
          <h1 style="font-size: 36px; color: #007bff; margin: 0; letter-spacing: 5px;">${otp}</h1>
        </div>
        <p style="font-size: 14px; color: #999;">
          This code expires in ${expiryMinutes} minutes.
        </p>
        <p style="font-size: 14px; color: #999;">
          If you didn't request this code, please ignore this email.
        </p>
      </div>
    `,
    
    getLoginOtpHtml: (otp: string, expiryMinutes: number) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333;">Login Verification</h2>
        <p style="font-size: 16px; color: #666;">
          Someone is trying to log in to your account. Your verification code is:
        </p>
        <div style="background: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0; border-radius: 5px;">
          <h1 style="font-size: 36px; color: #007bff; margin: 0; letter-spacing: 5px;">${otp}</h1>
        </div>
        <p style="font-size: 14px; color: #999;">
          This code expires in ${expiryMinutes} minutes.
        </p>
        <p style="font-size: 14px; color: #999;">
          If this wasn't you, please ignore this email.
        </p>
      </div>
    `,
  };