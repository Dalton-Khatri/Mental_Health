const nodemailer = require('nodemailer');

let transporterPromise = null;

// Creates a fake test inbox (Ethereal) the first time this file is used.
// No real credentials needed — safe for every teammate to run independently.
async function getTransporter() {
  if (!transporterPromise) {
    transporterPromise = nodemailer.createTestAccount().then((testAccount) => {
      return nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      });
    });
  }
  return transporterPromise;
}

// Opens the fake email preview directly in the default browser,
// so nobody has to go check the terminal for a link.
async function openPreview(url) {
  const open = (await import('open')).default;
  await open(url);
}

async function sendVerificationEmail(toEmail, token) {
  const transporter = await getTransporter();
  const link = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;

  const info = await transporter.sendMail({
    from: '"SerenityScreen" <noreply@serenityscreen.dev>',
    to: toEmail,
    subject: 'Verify your SerenityScreen account',
    html: `<p>Welcome to SerenityScreen!</p>
           <p>Click the link below to verify your email and activate your account:</p>
           <a href="${link}">${link}</a>
           <p>If you didn't sign up, you can ignore this email.</p>`
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);
  console.log('Verification email preview URL:', previewUrl);
  if (previewUrl) await openPreview(previewUrl);
}

async function sendResetPasswordEmail(toEmail, token) {
  const transporter = await getTransporter();
  const link = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

  const info = await transporter.sendMail({
    from: '"SerenityScreen" <noreply@serenityscreen.dev>',
    to: toEmail,
    subject: 'Reset your SerenityScreen password',
    html: `<p>We received a request to reset your password.</p>
           <p>Click the link below to set a new password. This link expires in 1 hour.</p>
           <a href="${link}">${link}</a>
           <p>If you didn't request this, you can ignore this email.</p>`
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);
  console.log('Reset password email preview URL:', previewUrl);
  if (previewUrl) await openPreview(previewUrl);
}

module.exports = { sendVerificationEmail, sendResetPasswordEmail };