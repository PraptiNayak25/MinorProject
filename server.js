// Required imports and app initialization
require('dotenv').config();

const express = require('express');
const app = express();
const PORT = process.env.PORT || 7004;

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');         
const SALT_ROUNDS = 10;
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const { sendMail } = require('./mailer');

// MongoDB connection
mongoose.connect('mongodb://127.0.0.1:27017/digital_time_capsule', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('✅ Connected to MongoDB');
}).catch((error) => {
  console.error('❌ MongoDB connection error:', error);
});

// Middleware
const allowedOrigins = ['http://127.0.0.1:7004', 'http://localhost:7004', 'http://localhost:7004', 'http://127.0.0.1:5501'];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true); // allow non-browser requests like Postman
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Capsule schema
const capsuleSchema = new mongoose.Schema({
  duration: String,
  dataSize: String,
  documentType: String,
  nomineeRelation: String,
  nomineeEmail: String,
  userEmail: String,
  releaseDate: Date,
  pin: String,
  fileName: String,
  filePath: String,
  createdAt: { type: Date, default: Date.now },
});

const Capsule = mongoose.model('Capsule', capsuleSchema);

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// Capsule submission route
app.post('/submit-capsule', upload.single('file-upload'), async (req, res) => {
  try {
    const {
      duration,
      dataSize,
      documentType,
      'nominee-relation': nomineeRelation,
      'nominee-email': nomineeEmail,
      'release-date': releaseDate,
      pin,
    } = req.body;

    if (!duration || !dataSize || !documentType || !nomineeRelation || !nomineeEmail || !releaseDate || !pin || !req.file || !req.body.email) {
      return res.status(400).json({ success: false, message: 'All fields are required, including file upload and user email.' });
    }

    const parsedReleaseDate = new Date(releaseDate);
    if (isNaN(parsedReleaseDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid release date format.' });
    }

    const capsule = new Capsule({
      duration,
      dataSize,
      documentType,
      nomineeRelation,
      nomineeEmail,
      userEmail: req.body.email,
      releaseDate: parsedReleaseDate,
      pin,
      fileName: req.file.originalname,
      filePath: req.file.filename,
    });

    await capsule.save();

    // Send emails to user and nominee
    const userEmail = req.body.email; // User email must be sent in the request body
    const nomineeEmailAddress = nomineeEmail;
    const subject = 'Digital Time Capsule Created';
    const textUser = `Hello,

Your digital time capsule has been created successfully. Your PIN is: ${pin}.

Best regards,
Digital Time Capsule Team`;

    const textNominee = `Hello,

You have been nominated for a digital time capsule. The PIN is: ${pin}.

Best regards,
Digital Time Capsule Team`;

    if (userEmail) {
      sendMail(userEmail, subject, textUser);
    } else {
      console.warn('User email not found in request body; user email not sent.');
    }
    if (nomineeEmailAddress) {
      sendMail(nomineeEmailAddress, subject, textNominee);
    }

    res.status(200).json({
      success: true,
      message: 'Capsule created and stored successfully!',
      pin: capsule.pin,
    });
  } catch (error) {
    console.error('❌ Capsule submission error:', error);
    res.status(500).json({ success: false, message: 'Internal server error during capsule submission.' });
  }
});

// Capsule retrieval route
app.post('/submit-retrieve', async (req, res) => {
  try {
    let { pin, email } = req.body;
    const orConditions = [];

    if (pin) {
      orConditions.push({ pin: pin });
    }
    if (email) {
      email = email.trim();
      console.log('Retrieval email:', email);
      const emailRegex = new RegExp(`^${email}$`, 'i'); // case-insensitive exact match
      orConditions.push({ nomineeEmail: emailRegex });
      orConditions.push({ userEmail: emailRegex });
    }

    if (orConditions.length === 0) {
      return res.status(400).send('Please provide at least PIN or Email for retrieval.');
    }

    const query = { $or: orConditions };

    console.log('Query for retrieval:', query);

    const capsules = await Capsule.find(query);
    console.log('Capsules found:', capsules.length);

    if (!capsules || capsules.length === 0) {
      return res.status(404).send('No capsules available for retrieval yet.');
    }

    res.json(capsules);
  } catch (error) {
    console.error('Retrieve error:', error);
    res.status(500).send('Internal server error');
  }
});

// User schema and authentication
const userSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  address: { type: String },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});
const User = mongoose.model('User', userSchema);

const generatePin = () => {
  return Date.now().toString().slice(-6) + Math.floor(Math.random() * 900 + 100).toString();
};

// Signup route
app.post('/submit-signup', async (req, res) => {
  try {
    const { firstName, lastName, email, phone, address, password } = req.body;

    if (!firstName || !lastName || !email || !phone || !password) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const pin = generatePin();

    const newUser = new User({
      firstName,
      lastName,
      email,
      phone,
      address,
      password: hashedPassword,
      pin, // Save pin in user document
    });

    await newUser.save();

    // Send welcome email with pin
    const subject = 'Welcome to Digital Time Capsule';
    const text = `Hello ${firstName},

Thank you for creating an account with Digital Time Capsule.
Your PIN is: ${pin}

Best regards,
Digital Time Capsule Team`;

    sendMail(email, subject, text);

    res.json({ success: true, message: 'Account created successfully', pin });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Login route
app.post('/submit-login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).send('Missing email or password');
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).send('Invalid email or password');
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).send('Invalid email or password');
    }

    // Check if user is admin
    if (email === 'dtca7198@gmail.com') {
      return res.json({ success: true, isAdmin: true, user: { firstName: user.firstName, lastName: user.lastName, email: user.email } });
    }

    res.json({ success: true, isAdmin: false, user: { firstName: user.firstName, lastName: user.lastName, email: user.email } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).send('Internal server error');
  }
});

// Admin capsules route
app.get('/admin/capsules', async (req, res) => {
  try {
    const capsules = await Capsule.find({});
    res.json(capsules);
  } catch (error) {
    console.error('Admin capsules fetch error:', error);
    res.status(500).send('Internal server error');
  }
});

async function createAdminUser() {
  try {
    const adminEmail = 'dtca7198@gmail.com';
    const existingAdmin = await User.findOne({ email: adminEmail });
    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash('DTC@2025a', SALT_ROUNDS);
      const adminUser = new User({
        firstName: 'Admin',
        lastName: 'User',
        email: adminEmail,
        phone: '0000000000',
        address: 'Admin Address',
        password: hashedPassword,
      });
      await adminUser.save();
      console.log('✅ Admin user created with email:', adminEmail);
    } else {
      console.log('Admin user already exists.');
    }
  } catch (error) {
    console.error('Error creating admin user:', error);
  }
}

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  await createAdminUser();
});
