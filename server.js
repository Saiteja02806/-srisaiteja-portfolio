// server.js
const express = require('express');
const cors = require('cors');
const fs = require('fs-extra');
const sgMail = require('@sendgrid/mail');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Set SendGrid API key from environment variable (DO NOT hardcode)
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
} else {
  console.warn('Warning: SENDGRID_API_KEY is not set. Email sending disabled.');
}

// Example route: health check
app.get('/', (req, res) => {
  res.send('Hello from srisaiteja-backend');
});

// Example contact form endpoint (server-side only)
app.post('/send', async (req, res) => {
  try {
    const { name, email, message } = req.body;
    if (!process.env.SENDGRID_API_KEY) {
      return res.status(500).json({ error: 'Email service not configured.' });
    }

    const msg = {
      to: 'you@example.com', // change to your receiving address
      from: 'no-reply@yourdomain.com', // must be a verified sender in SendGrid
      subject: `Contact form: ${name}`,
      text: `From: ${name} <${email}>\n\n${message}`,
      html: `<p>From: <strong>${name}</strong> &lt;${email}&gt;</p><p>${message}</p>`
    };

    await sgMail.send(msg);
    return res.json({ success: true });
  } catch (err) {
    console.error('Send error', err);
    return res.status(500).json({ error: 'Failed to send email' });
  }
});

// Bind to Render's port or fallback 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Listening on ${PORT}`));


