const sgMail = require('@sendgrid/mail');

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

const sendOTPEmail = async (to, otp, purpose) => {
  // ALWAYS log to console first so you can grab it from terminal logs
  console.log(`\n[OTP-DEBUG] ${to}: ${otp} (${purpose})\n`);

  if (!process.env.SENDGRID_API_KEY) {
    console.warn('SENDGRID_API_KEY not set. Email not sent, using console fallback.');
    return;
  }

  const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'support@chatx.app';

  const msg = {
    to: to,
    from: fromEmail,
    subject: `ChatX ${purpose.charAt(0).toUpperCase() + purpose.slice(1)} OTP`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 12px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #5E5CE6 0%, #342EAD 100%); padding: 30px; text-align: center; color: white;">
          <h1 style="margin: 0; font-size: 28px;">ChatX</h1>
        </div>
        <div style="padding: 40px; background: #ffffff; text-align: center;">
          <h2 style="color: #333; margin-bottom: 10px;">Verification Code</h2>
          <p style="color: #666; font-size: 16px;">Use the following code to complete your ${purpose}:</p>
          <div style="background: #f8f9ff; border: 2px dashed #5E5CE6; border-radius: 8px; padding: 25px; margin: 30px 0; font-size: 40px; font-weight: bold; letter-spacing: 8px; color: #5E5CE6;">
            ${otp}
          </div>
          <p style="color: #999; font-size: 14px;">This code is valid for 10 minutes. If you didn't request this, please ignore this email.</p>
        </div>
        <div style="background: #f9f9f9; padding: 20px; text-align: center; color: #999; font-size: 12px;">
          &copy; 2024 ChatX App. All rights reserved.
        </div>
      </div>
    `,
  };

  try {
    await sgMail.send(msg);
    console.log('Email sent successfully via SendGrid to:', to);
  } catch (err) {
    console.error('SendGrid error:', err.response ? err.response.body : err.message);
    console.warn('Email delivery failed. Please ensure SENDGRID_FROM_EMAIL is verified as a Single Sender.');
  }
};

module.exports = { sendOTPEmail };