// assets/app.js
document.getElementById('year').textContent = new Date().getFullYear();

const form = document.getElementById('enquiryForm');
const status = document.getElementById('formStatus');

form.addEventListener('submit', async e => {
  e.preventDefault();
  status.textContent = 'Sending...';
  const payload = {
    name: form.name.value.trim(),
    email: form.email.value.trim(),
    message: form.message.value.trim()
  };
  try {
    // Replace this URL with your deployed backend endpoint
    const BACKEND_URL = 'https://YOUR_BACKEND_DOMAIN/api/enquiry';
    const res = await fetch(BACKEND_URL, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Server error');
    const data = await res.json();
    status.textContent = data?.message || 'Message sent — thank you!';
    form.reset();
  } catch (err) {
    console.error(err);
    status.textContent = 'Could not send message. Please email: srisaiteja03@gmail.com';
  }
});
