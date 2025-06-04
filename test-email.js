const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

async function sendTestCapsule() {
  try {
    const form = new FormData();
    form.append('duration', '1 year');
    form.append('dataSize', '10MB');
    form.append('documentType', 'PDF');
    form.append('nominee-relation', 'Friend');
    form.append('nominee-email', 'nominee@example.com');
    form.append('release-date', '2025-12-31');
    form.append('pin', '123456');
    form.append('userEmail', 'user@example.com');
    // Attach a sample file from the project directory or create a dummy file
    const filePath = path.join(__dirname, 'capsule.html'); // Using capsule.html as sample file
    form.append('file-upload', fs.createReadStream(filePath));

const response = await axios.post('http://localhost:7004/submit-capsule', form, {
      headers: form.getHeaders(),
    });

    console.log('Response:', response.data);
  } catch (error) {
    console.error('Error sending test capsule:', error.response ? error.response.data : error.message);
  }
}

sendTestCapsule();
