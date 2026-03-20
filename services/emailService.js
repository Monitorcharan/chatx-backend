const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const sendOTPEmail = async (to, otp, purpose) => {
  // ALWAYS log to console first so you can grab it from Render logs even if email fails
  console.log(`\n[DEV-DEBUG] OTP for ${to}: ${otp} (${purpose})\n`);

  try {
    const { data, error } = await resend.emails.send({
      from: 'ChatX <onboarding@resend.dev>',
      to: [to],
      subject: `ChatX ${purpose} OTP`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #5E5CE6; padding: 20px; text-align: center; color: white;">
            <h1>ChatX</h1>
          </div>
          <div style="padding: 30px; background: #f5f5f5;">
            <h2>Your ${purpose} OTP</h2>
            <p>Use the following code to complete your ${purpose}:</p>
            <div style="background: white; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #5E5CE6;">
              ${otp}
            </div>
            <p>This code is valid for 5 minutes.</p>
          </div>
        </div>
      `,
    });

    if (error) {
      console.warn('Resend 403 Restricted (Testing Mode). OTP fallback logged to console.');
      // Don't throw error if it's a validation error (unverified recipient) 
      // so the user can still test via console.
      return; 
    }

    console.log('Email sent successfully via Resend:', data.id);
  } catch (err) {
    console.warn('Resend connection issue. OTP fallback logged to console.');
  }
};

module.exports = { sendOTPEmail };