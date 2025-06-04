require('dotenv').config();
const nodemailer = require('nodemailer');

async function sendTestEmail() {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS,
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: process.env.GMAIL_USER,
      subject: 'Test Email from Digital Time Capsule',
      text: 'This is a test email to verify SMTP configuration.',
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Test email sent:', info.response);
  } catch (error) {
    console.error('Error sending test email:', error);
  }
}

sendTestEmail();
