const express = require('express');
const cors = require('cors');
const fs = require('fs-extra');
const path = require('path');
const sgMail = require('@sendgrid/mail');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY; // set in cloud
const TO_EMAIL = process.env.TO_EMAIL || 'srisaiteja03@gmail.com';

if (SENDGRID_API_KEY) sgMail.setApiKey(SENDGRID_API_KEY);

app.post('/api/enquiry', async (req, res) => {
  try {
    const { name, email, message } = req.body || {};
    if (!name || !email || !message) return res.status(400).json({ message: 'Missing fields' });

    // Send email if SendGrid key is provided
    if (SENDGRID_API_KEY) {
      const msg = {
        to: TO_EMAIL,
        from: TO_EMAIL,
        subject: `Portfolio enquiry from ${name}`,
        text: `Name: ${name}\nEmail: ${email}\n\n${message}`,
        html: `<p><strong>Name:</strong> ${name}</p><p><strong>Email:</strong> ${email}</p><p>${message}</p>`
      };
      await sgMail.send(msg);
    }

    // fallback: append to a local file (useful for debugging)
    const out = {
      name, email, message, receivedAt: new Date().toISOString()
    };
    const dir = path.join(__dirname, 'data');
    await fs.ensureDir(dir);
    await fs.appendFile(path.join(dir, 'enquiries.jsonl'), JSON.stringify(out) + '\n');

    return res.json({ message: 'Enquiry received. Thank you!' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Failed to process enquiry' });
  }
});

app.get('/', (req, res) => res.send('Enquiry API running.'));

app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
