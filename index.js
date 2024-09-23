require('dotenv').config();

const config = require('./config.js');

const mongoose = require('mongoose');

mongoose.connect(config.connectionString);

const User = require('./models/user.model'); // Capitalize the model name for convention
const Note = require('./models/note.model');

const express = require('express');
const cors = require('cors');
const app = express();

const jwt = require('jsonwebtoken');
const { authenticateToken } = require('./utilities');

const multer = require('multer');
const cloudinaryUpload = require('./models/cloudinaryUpload.js');
const upload = multer({ dest: 'uploads/' }); // Multer config

app.use(express.json());

app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  })
);

app.get('/', (req, res) => {
  res.json({ data: 'hello' });
});

// Backend ready

// Create Account
app.post('/create-account', async (req, res) => {
  console.log(req.body);
  const { fullName, email, password, registrationType } = req.body;

  // Define default role as 'student'
  let role = 'student';

  console.log('Received registrationType:', registrationType);

  if (registrationType === 'admin') {
    role = 'admin';
  }

  // Validate input fields
  if (!fullName || !email || !password || !registrationType) {
    return res.status(400).json({
      error: true,
      message:
        'All fields (fullName, email, password, registrationType) are required',
    });
  }
  console.log('Role being assigned:', role);

  try {
    // Check if the user already exists
    const isUser = await User.findOne({ email });
    if (isUser) {
      return res.status(400).json({
        error: true,
        message: 'User already exists',
      });
    }

    // Hash the password for security
    // const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user with hashed password and dynamically assigned role
    const newUser = new User({
      fullName,
      email,
      password,
      role: role || 'student', // Assign role dynamically based on registration type
    });

    await newUser.save();

    // Generate JWT token with user id and role
    const accessToken = jwt.sign(
      { id: newUser._id, role: newUser.role },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: '10h' }
    );

    // Send response with the token and user info
    return res.status(201).json({
      error: false,
      user: {
        id: newUser?._id,
        fullName: newUser.fullName,
        email: newUser.email,
        role: newUser.role, // Ensure role is included in the response
      },
      accessToken,
      message: 'Registration successful',
    });
  } catch (error) {
    console.error(error); // Log error for debugging
    return res.status(500).json({
      error: true,
      message: 'Internal server error',
    });
  }
});

// login
app.post('/login', async (req, res) => {
  console.log('hekko word');
  const { email, password } = req.body;

  // Check if email and password are provided
  if (!email || !password) {
    return res
      .status(400)
      .json({ error: true, message: 'Email and password are required' });
  }

  try {
    // Find the user by email
    const userInfo = await User.findOne({ email });
    if (!userInfo) {
      return res.status(400).json({ error: true, message: 'User not found' });
    }

    // Check if the email and password match
    if (userInfo.email === email && userInfo.password === password) {
      // Include the role in the JWT payload
      const user = { id: userInfo._id, role: userInfo.role };

      // Generate the JWT token with role
      const accessToken = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '10h', // Adjust token expiration time
      });

      // Return the response with token and role
      return res.json({
        error: false,
        message: 'Login successful',
        accessToken, // Send the access token
        role: userInfo.role, // Send the user's role
      });
    } else {
      return res.status(400).json({
        error: true,
        message: 'Invalid credentials',
      });
    }
  } catch (error) {
    // Handle any errors
    console.error(error);
    return res.status(500).json({
      error: true,
      message: 'Internal server error',
    });
  }
});

// ADD notes
app.post(
  '/add-notes',
  authenticateToken,
  upload.single('file'),
  async (req, res) => {
    const { title, content, tags } = req.body;

    const { user } = req;

    if (!title) {
      return res
        .status(400)
        .json({ error: true, message: 'Title is required' });
    }
    if (!content) {
      return res
        .status(400)
        .json({ error: true, message: 'content is required' });
    }

    let readyData;

    if (req.file) {
      const result = await cloudinaryUpload.uploader.upload(req.file.path, {
        resource_type: 'auto', // This allows any file type to be uploaded
      });

      const originalFile = req.file.originalname.split('.');
      let fileExtention = originalFile[originalFile.length - 1];

      readyData = {
        title,
        content,
        tags: tags || [],
        fileUrl: result.url,
        fileExtention: fileExtention,
        userId: user._id,
      };
    } else {
      readyData = {
        title,
        content,
        tags: tags || [],
        userId: user._id,
      };
    }

    // const fileUrl = `${result.url}.${fileExtention}`;

    try {
      const note = new Note(readyData);
      await note.save();

      return res.json({
        error: false,
        note,
        message: 'Note add Successfully',
      });
    } catch (error) {
      return res.status(500).json({
        error: true,
        message: 'Internal server error',
      });
    }
  }
);

// edit note
app.put('/edit-note/:noteId', authenticateToken, async (req, res) => {
  const noteId = req.params.noteId;
  const { title, content } = req.body;
  const user = req.user;
  console.log(user);
  if (!title && !content) {
    return res
      .status(400)
      .json({ error: true, message: 'No changes provided' });
  }
  try {
    const note = await Note.findOne({ _id: noteId, userId: user._id });
    // if note not found
    if (!note) {
      return res.status(400).json({ error: true, message: 'Note not found' });
    }
    const updatedNotes = await Note.findOneAndUpdate(
      {
        _id: noteId,
        userId: user._id,
      },
      {
        ...req.body,
      },
      { new: true }
    );
    return res.json({
      error: false,
      success: true,
      note: updatedNotes,
      message: 'Note added sucessfully',
    });
  } catch (error) {
    return res
      .status(400)
      .json({ error: true, message: 'internal server error' });
  }
});

// Get All notes
app.get('/get-all-notes/', async (req, res) => {
  // const { user } = req.user;
  try {
    const notes = await Note.find({});

    // console.log(notes);
    return res.json({
      error: false,
      notes,
      message: 'All notes retrieved successfully',
    });
  } catch (error) {
    return res.status(500).json({
      error: true,
      message: 'internal server error',
    });
  }
});

// Get one notes
app.get('/get-all-notes/:id', async (req, res) => {
  // const { user } = req.user;
  try {
    const note = await Note.findById(req.params.id);

    // console.log(notes);
    return res.json({
      error: false,
      note,
      message: 'All notes retrieved successfully',
    });
  } catch (error) {
    return res.status(500).json({
      error: true,
      message: 'internal server error',
    });
  }
});
// Delete note
app.delete('/delete-note/:noteId/', authenticateToken, async (req, res) => {
  console.log('here ooo');
  const noteId = req.params.noteId;
  // console.log(req.user);
  const { user } = req;
  // let userId = String(user._id);

  // console.log(String(user._id));

  try {
    const note = await Note.findOne({ _id: noteId });
    console.log(note);
    if (!note) {
      return res.status(404).json({ error: true, message: 'Note not found' });
    }
    if (String(user._id) !== String(note.userId)) {
      return res
        .status(401)
        .json({ error: true, message: 'You cannot delete this note' });
    }
    await Note.deleteOne({ _id: noteId, userId: user._id });
    return res.json({
      error: true,
      message: 'note deleted successfully',
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      error: true,
      message: 'internal server error',
    });
  }
});

// Get user
app.get('/get-user', authenticateToken, async (req, res) => {
  const { user } = req.user;
  const isUser = await User.findOne({ _id: user._id });

  if (!isUser) {
    return res.sendStatus(401);
  }
  return res.json({
    user: {
      fullName: isUser.fullName,
      email: isUser.email,
      '._id': isUser._id,
      createdon: isUser.createdon,
    },
    message: '',
  });
});

app.listen(
  process.env.NODE_ENV === 'development' ? 8000 : process.env.PORT,
  () => {
    console.log('listening on port 8000');
  }
);
module.exports = app;

// // Generate a random secret key
// const crypto = require('crypto');
// const secretKey = crypto.randomBytes(64).toString('hex');

// console.log('Generated Secret Key:', secretKey);
