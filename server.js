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

/* ---------- Middleware ---------- */
app.use(helmet()); 
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cors()); // allow all origins
app.use(morgan('combined'));

/* ---------- Rate limiting ---------- */
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 6,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});

/* ---------- SendGrid setup ---------- */
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

// Contact form endpoint
app.post(
  '/send',
  contactLimiter,
  [
    body('name').trim().isLength({ min: 1, max: 100 }).withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('message').trim().isLength({ min: 1, max: 5000 }).withMessage('Message is required')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array().map(e => e.msg) });
    }

    if (!process.env.SENDGRID_API_KEY) {
      return res.status(500).json({ error: 'Email service not configured.' });
    }

    const name = safeString(req.body.name);
    const email = safeString(req.body.email);
    const message = safeString(req.body.message);

    const toAddress = process.env.TO_EMAIL || 'chundusrisaiteja@gmail.com';
    const fromAddress = process.env.FROM_EMAIL || 'chundusrisaiteja2003@gmail.com';

    const msg = {
      to: toAddress,
      from: fromAddress,
      subject: `Contact form message from ${name}`,
      text: `From: ${name} <${email}>\n\n${message}`,
      html: `<p><strong>From:</strong> ${name} &lt;${email}&gt;</p><hr/><p>${message.replace(/\n/g, '<br/>')}</p>`
    };

    try {
      await sgMail.send(msg);

      // Optional: log requests to file
      const logLine = `${new Date().toISOString()} | ${email} | ${name} | ${req.ip}\n`;
      await fs.appendFile('contact_logs.txt', logLine);

      return res.json({ success: true, message: 'Message sent successfully.' });
    } catch (err) {
      console.error('SendGrid error:', err?.response?.body || err.message || err);
      return res.status(502).json({ error: 'Failed to send email' });
    }
  }
);

/* ---------- Error handler ---------- */
app.use((err, req, res, next) => {
  console.error('Unexpected error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

/* ---------- Start server ---------- */
const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});




