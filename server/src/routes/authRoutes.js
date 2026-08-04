import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '../prismaClient.js';
import { sendVerificationCode, sendResetPasswordEmail } from '../utils/mailer.js';
const router = express.Router();

const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
const PASSWORD_RULE_MESSAGE = 'Password must be at least 8 characters and include at least one letter and one number';
const MAX_VERIFY_ATTEMPTS = 5;
const CODE_EXPIRY_MINUTES = 10;

function generateCode() {
  return crypto.randomInt(100000, 999999).toString();
}

// SIGNUP
router.post('/signup', async (req, res) => {
  const { name, email, password, emergencyPhone, emergencyContactName } = req.body;

  if (!name || !email || !password || !emergencyPhone) {
    return res.status(400).json({ error: 'Missing required fields: name, email, password, or emergency contact number' });
  }

  if (!PASSWORD_RULE.test(password)) {
    return res.status(400).json({ error: PASSWORD_RULE_MESSAGE });
  }

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const verifyCode = generateCode();
    const verifyCodeExpiry = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000);

    await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        verifyCode,
        verifyCodeExpiry,
        verifyAttempts: 0,
        isVerified: false,
        emergencyContacts: {
          create: {
            name: emergencyContactName || `${name}'s Emergency Contact`,
            phone: emergencyPhone.trim(),
            relation: 'Emergency Contact',
            isPrimary: true
          }
        }
      }
    });

    await sendVerificationCode(email, verifyCode);

    res.status(201).json({
      message: 'Account created. We sent a 6-digit code to your email — enter it to verify your account.',
      email
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Signup failed' });
  }
});

// VERIFY CODE
router.post('/verify-code', async (req, res) => {
  const { email, code } = req.body;

  if (!email || !code) {
    return res.status(400).json({ error: 'Missing email or code' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.status(400).json({ error: 'Invalid email or code' });
    }

    if (user.isVerified) {
      return res.json({ message: 'Account already verified. You can log in.' });
    }

    if (!user.verifyCode || !user.verifyCodeExpiry || user.verifyCodeExpiry < new Date()) {
      return res.status(400).json({ error: 'Code has expired. Please request a new one.' });
    }

    if (user.verifyAttempts >= MAX_VERIFY_ATTEMPTS) {
      return res.status(429).json({ error: 'Too many incorrect attempts. Please request a new code.' });
    }

    if (user.verifyCode !== code) {
      const attemptsLeft = MAX_VERIFY_ATTEMPTS - (user.verifyAttempts + 1);
      await prisma.user.update({
        where: { id: user.id },
        data: { verifyAttempts: { increment: 1 } }
      });
      return res.status(400).json({
        error: `Incorrect code. ${attemptsLeft > 0 ? `${attemptsLeft} attempt(s) left.` : 'No attempts left — please request a new code.'}`
      });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        isVerified: true,
        verifyCode: null,
        verifyCodeExpiry: null,
        verifyAttempts: 0
      }
    });

    res.json({ message: 'Email verified successfully. You can now log in.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// RESEND CODE
router.post('/resend-code', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Missing email' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.status(400).json({ error: 'Invalid email' });
    }

    if (user.isVerified) {
      return res.json({ message: 'Account already verified. You can log in.' });
    }

    const verifyCode = generateCode();
    const verifyCodeExpiry = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: { verifyCode, verifyCodeExpiry, verifyAttempts: 0 }
    });

    await sendVerificationCode(email, verifyCode);

    res.json({ message: 'A new code has been sent to your email.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to resend code' });
  }
});

// LOGIN
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Missing email or password' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { emergencyContacts: true }
    });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (!user.isVerified) {
      return res.status(403).json({ error: 'Please verify your email before logging in.', needsVerification: true, email: user.email });
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        emergencyContacts: user.emergencyContacts
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// FORGOT PASSWORD (still link-based — unchanged)
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Missing email' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.json({ message: 'If that email is registered, a reset link has been sent.' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken, resetTokenExpiry }
    });

    await sendResetPasswordEmail(email, resetToken);

    res.json({ message: 'If that email is registered, a reset link has been sent.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// RESET PASSWORD (still link-based — unchanged)
router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Missing token or new password' });
  }

  if (!PASSWORD_RULE.test(newPassword)) {
    return res.status(400).json({ error: PASSWORD_RULE_MESSAGE });
  }

  try {
    const user = await prisma.user.findFirst({ where: { resetToken: token } });

    if (!user || !user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
      return res.status(400).json({ error: 'Invalid or expired reset link' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, resetToken: null, resetTokenExpiry: null }
    });

    res.json({ message: 'Password reset successfully. You can now log in with your new password.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

export default router;