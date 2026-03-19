const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  requireTLS: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendOTPEmail = async (to, otp, purpose) => {
  const mailOptions = {
    from: `"ChatX" <${process.env.EMAIL_USER}>`,
    to,
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
  };

  await transporter.sendMail(mailOptions);
};

module.exports = { sendOTPEmail };