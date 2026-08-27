import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../prismaClient.js';
const router = express.Router();

const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
const PASSWORD_RULE_MESSAGE = 'Password must be at least 8 characters and include at least one letter and one number';

// SIGNUP (simple — no email verification)
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

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        isVerified: true,
        emergencyContacts: {
          create: {
            name: emergencyContactName || `${name}'s Emergency Contact`,
            phone: emergencyPhone.trim(),
            relation: 'Emergency Contact',
            isPrimary: true
          }
        }
      },
      include: { emergencyContacts: true }
    });

    // Auto-login: return JWT token immediately
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
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
    res.status(500).json({ error: 'Signup failed' });
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

// FORGOT PASSWORD (simple token-based, no email — just resets directly)
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Missing email' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.json({ message: 'If that email is registered, the password can be reset.' });
    }

    // For simplicity without mailer, just acknowledge
    res.json({ message: 'If that email is registered, the password can be reset.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// RESET PASSWORD
router.post('/reset-password', async (req, res) => {
  const { email, newPassword } = req.body;

  if (!email || !newPassword) {
    return res.status(400).json({ error: 'Missing email or new password' });
  }

  if (!PASSWORD_RULE.test(newPassword)) {
    return res.status(400).json({ error: PASSWORD_RULE_MESSAGE });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.status(400).json({ error: 'User not found' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash }
    });

    res.json({ message: 'Password reset successfully. You can now log in with your new password.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

export default router;