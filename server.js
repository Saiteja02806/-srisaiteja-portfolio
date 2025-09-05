// server.js
'use strict';

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const fs = require('fs-extra');
const sgMail = require('@sendgrid/mail');
const morgan = require('morgan');
const { body, validationResult } = require('express-validator');

const app = express();

/* ---------- Basic middleware ---------- */
app.use(helmet()); // security headers
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Configure CORS - restrict origin in production
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || '*'; // change '*' to your frontend URL in production
app.use(cors({ origin: FRONTEND_ORIGIN, methods: ['GET', 'POST', 'OPTIONS'] }));

// Logging
app.use(morgan('combined'));

/* ---------- Rate limiting (anti-spam) ---------- */
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 6, // limit each IP to 6 requests per windowMs for protected endpoints
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});

/* ---------- SendGrid setup (no key in repo) ---------- */
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
} else {
  console.warn('Warning: SENDGRID_API_KEY not set. Email sending is disabled.');
}

/* ---------- Helpers ---------- */
function safeString(s) {
  return String(s || '').trim();
}

/* ---------- Routes ---------- */

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', env: process.env.NODE_ENV || 'development' });
});

// Example: Serve static build (if you have front-end in /public or /build)
app.use(express.static('public'));

// Contact/send email endpoint
app.post(
  '/send',
  contactLimiter,
  // Validation using express-validator
  [
    body('name').trim().isLength({ min: 1, max: 100 }).withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('message').trim().isLength({ min: 1, max: 5000 }).withMessage('Message is required')
  ],
  async (req, res) => {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array().map(e => e.msg) });
    }

    // If SendGrid not configured, reply with friendly error
    if (!process.env.SENDGRID_API_KEY) {
      return res.status(500).json({ error: 'Email service not configured on server.' });
    }

    const name = safeString(req.body.name);
    const email = safeString(req.body.email);
    const message = safeString(req.body.message);

    // Build email
    const toAddress = process.env.CONTACT_RECEIVER || process.env.TO_EMAIL || 'you@example.com';
    const fromAddress = process.env.FROM_EMAIL || 'no-reply@yourdomain.com'; // must be verified in SendGrid

    const msg = {
      to: toAddress,
      from: fromAddress,
      subject: `Contact form message from ${name}`,
      text: `You received a message from ${name} <${email}>:\n\n${message}`,
      html: `
        <p><strong>From:</strong> ${name} &lt;${email}&gt;</p>
        <hr/>
        <div>${message.replace(/\n/g, '<br/>')}</div>
      `
    };

    try {
      // sendMail
      await sgMail.send(msg);

      // Optionally log to a file (append-only)
      try {
        const logLine = `${new Date().toISOString()} | ${email} | ${name} | ${req.ip}\n`;
        await fs.appendFile('contact_logs.txt', logLine);
      } catch (fileErr) {
        console.warn('Could not write contact log:', fileErr.message);
      }

      return res.json({ success: true, message: 'Message sent successfully.' });
    } catch (err) {
      // Log the SendGrid error for debugging (but avoid leaking api keys)
      console.error('SendGrid error:', err?.response?.body || err.message || err);

      // If SendGrid returned a response body, include a small hint
      const sgHint = err?.response?.body ? ' (SendGrid responded with an error)' : '';
      return res.status(502).json({ error: 'Failed to send email' + sgHint });
    }
  }
);

/* ---------- Generic error handler ---------- */
app.use((err, req, res, next) => {
  console.error('Unexpected server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

/* ---------- Start server ---------- */
const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});



