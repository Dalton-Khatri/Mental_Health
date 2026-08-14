import nodemailer from 'nodemailer';

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

async function sendVerificationCode(toEmail, code) {
  const transporter = await getTransporter();

  const info = await transporter.sendMail({
    from: '"Lucid" <noreply@lucid.dev>',
    to: toEmail,
    subject: 'Your Lucid verification code',
    html: `<p>Welcome to Lucid!</p>
           <p>Your verification code is:</p>
           <h2 style="letter-spacing: 4px;">${code}</h2>
           <p>Enter this code in the app to activate your account. This code expires in 10 minutes.</p>
           <p>If you didn't sign up, you can ignore this email.</p>`
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);
  console.log('Verification code email preview URL:', previewUrl);
  if (previewUrl) await openPreview(previewUrl);
}

async function sendResetPasswordEmail(toEmail, token) {
  const transporter = await getTransporter();
  const link = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

  const info = await transporter.sendMail({
    from: '"Lucid" <noreply@lucid.dev>',
    to: toEmail,
    subject: 'Reset your Lucid password',
    html: `<p>We received a request to reset your password.</p>
           <p>Click the link below to set a new password. This link expires in 1 hour.</p>
           <a href="${link}">${link}</a>
           <p>If you didn't request this, you can ignore this email.</p>`
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);
  console.log('Reset password email preview URL:', previewUrl);
  if (previewUrl) await openPreview(previewUrl);
}

export { sendVerificationCode, sendResetPasswordEmail };