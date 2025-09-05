// server.js (safer version)
const express = require('express');
const cors = require('cors');
const fs = require('fs-extra');
const path = require('path');
const sgMail = require('@sendgrid/mail');
const rateLimit = require('express-rate-limit');

const app = express();

// Security / limits
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'https://saisteja02806.github.io'; // your GitHub Pages origin
app.use(cors({ origin: FRONTEND_ORIGIN }));
app.use(express.json({ limit: '50kb' })); // limit request size

// Rate limiter for the enquiry endpoint
const enquiryLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,             // max 10 requests per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' }
});

const PORT = process.env.PORT || 3000;
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const TO_EMAIL = process.env.TO_EMAIL || 'srisaiteja03@gmail.com';
const FROM_EMAIL = process.env.FROM_EMAIL || TO_EMAIL; // must be a verified sender in SendGrid

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
  console.log('SendGrid API key detected.');
} else {
  console.log('SendGrid API key NOT set — emails will be skipped.');
}

app.post('/api/enquiry', enquiryLimiter, async (req, res) => {
  try {
    const { name, email, message } = req.body || {};
    if (!name || !email || !message) {
      return res.status(400).json({ message: 'Missing fields' });
    }

    // sanitize / basic validation
    if (String(name).length > 200 || String(email).length > 200 || String(message).length > 5000) {
      return res.status(400).json({ message: 'Input too long' });
    }

    // Try to send email, but do not fail the request if SendGrid errors
    if (SENDGRID_API_KEY) {
      const msg = {
        to: TO_EMAIL,
        from: FROM_EMAIL,
        subject: `Portfolio enquiry from ${name}`,
        text: `Name: ${name}\nEmail: ${email}\n\n${message}`,
        html: `<p><strong>Name:</strong> ${name}</p><p><strong>Email:</strong> ${email}</p><p>${message}</p>`
      };
      try {
        await sgMail.send(msg);
        console.log('SendGrid: email sent');
      } catch (sendErr) {
        // Log full error (SendGrid returns helpful body); continue processing
        console.error('SendGrid error:', sendErr && (sendErr.response ? sendErr.response.body : sendErr));
      }
    } else {
      console.log('Skipping email send because SENDGRID_API_KEY not configured.');
    }

    // Always save the enquiry as a fallback
    const out = { name, email, message, receivedAt: new Date().toISOString(), source: 'render' };
    const dir = path.join(__dirname, 'data');
    await fs.ensureDir(dir);
    await fs.appendFile(path.join(dir, 'enquiries.jsonl'), JSON.stringify(out) + '\n');
    console.log('Enquiry saved to data/enquiries.jsonl');

    return res.json({ message: 'Enquiry received. Thank you!' });
  } catch (err) {
    console.error('Enquiry handler error:', err);
    return res.status(500).json({ message: 'Server error — check logs' });
  }
});

app.get('/', (req, res) => res.send('Enquiry API running.'));

app.listen(PORT, () => console.log(`Server listening on ${PORT}`));

