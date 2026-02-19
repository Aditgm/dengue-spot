const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;
  const emailService = process.env.EMAIL_SERVICE || 'gmail';

  if (!emailUser || !emailPass) {
    console.warn('Email not configured — OTP emails will be logged to console');
    return null;
  }

  transporter = nodemailer.createTransport({
    service: emailService,
    auth: {
      user: emailUser,
      pass: emailPass
    }
  });

  return transporter;
}

async function sendOtpEmail(to, code, purpose = 'login') {
  const purposeText = {
    login: 'Login Verification',
    register: 'Registration Verification',
    'reset-password': 'Password Reset'
  }[purpose] || 'Verification';

  const html = `
    <div style="font-family: 'Segoe UI', system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: linear-gradient(145deg, #060e1a, #0d1c32); border-radius: 16px; border: 1px solid rgba(0,180,216,0.2);">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #48cae4; font-size: 28px; margin: 0 0 4px;">DengueSpot</h1>
        <p style="color: #90e0ef; font-size: 14px; margin: 0;">${purposeText}</p>
      </div>
      <div style="background: rgba(0,180,216,0.08); border: 1px solid rgba(0,180,216,0.15); border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 20px;">
        <p style="color: #cdefff; font-size: 14px; margin: 0 0 16px;">Your verification code is:</p>
        <div style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #ffffff; background: linear-gradient(135deg, rgba(0,180,216,0.15), rgba(0,150,199,0.1)); border-radius: 10px; padding: 16px 24px; display: inline-block; border: 1px solid rgba(0,180,216,0.2);">
          ${code}
        </div>
        <p style="color: rgba(144,224,239,0.6); font-size: 12px; margin: 16px 0 0;">This code expires in <strong>5 minutes</strong></p>
      </div>
      <p style="color: rgba(144,224,239,0.5); font-size: 12px; text-align: center; margin: 0;">If you didn't request this code, you can safely ignore this email.</p>
    </div>
  `;

  const transport = getTransporter();

  if (!transport) {
    // Fallback: log to console for development
    console.log(`\n========== OTP EMAIL ==========`);
    console.log(`To: ${to}`);
    console.log(`Purpose: ${purposeText}`);
    console.log(`Code: ${code}`);
    console.log(`Expires in 5 minutes`);
    console.log(`===============================\n`);
    return { success: true, fallback: true };
  }

  try {
    await transport.sendMail({
      from: `"DengueSpot" <${process.env.EMAIL_USER}>`,
      to,
      subject: `${code} — DengueSpot ${purposeText}`,
      html
    });
    return { success: true };
  } catch (error) {
    console.error('Email send error:', error);
    // Fallback to console logging
    console.log(`\n========== OTP EMAIL (FALLBACK) ==========`);
    console.log(`To: ${to} | Code: ${code}`);
    console.log(`==========================================\n`);
    return { success: true, fallback: true, error: error.message };
  }
}

module.exports = { sendOtpEmail };
