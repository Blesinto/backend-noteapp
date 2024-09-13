require('dotenv').config();

const config = require('./config.js');

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

mongoose.connect(config.connectionString);

const User = require('./models/user.model'); // Capitalize the model name for convention
const Note = require('./models/note.model');
// const Quiz = require('./models/quiz.model');

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
  })
);

// ============= new code =============================================

// app.post('/create-account', async (req, res) => {
//   const { fullName, email, password, role } = req.body; // Accept 'role' in the request body

//   // Validate input fields
//   if (!fullName || !password || !email || !role) {
//     return res
//       .status(400)
//       .json({ error: true, message: 'All fields are required' });
//   }

//   // Check if the user already exists
//   const isUser = await User.findOne({ email });
//   if (isUser) {
//     return res.json({ error: true, message: 'User already exists' });
//   }

//   // Ensure role is either 'admin' or 'student'
//   if (role !== 'admin' && role !== 'student') {
//     return res.status(400).json({ error: true, message: 'Invalid role' });
//   }

//   // Create new user with role
//   const newUser = new User({ fullName, email, password, role });
//   await newUser.save();

//   // Generate JWT token with role
//   const accessToken = jwt.sign(
//     { id: newUser._id, role: newUser.role },
//     process.env.ACCESS_TOKEN_SECRET,
//     { expiresIn: '10h' }
//   );

//   // Send response
//   return res.json({
//     error: false,
//     user: newUser,
//     accessToken,
//     message: 'Registration Successful',
//   });
// });

// creat account

// create account
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
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user with hashed password and dynamically assigned role
    const newUser = new User({
      fullName,
      email,
      password: hashedPassword,
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
        id: newUser._id,
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

// creat Quiz
app.get('/get-quiz-questions', async (req, res) => {
  const questions = [
    {
      question: 'What is the capital of France?',
      options: [
        { optionText: 'Berlin', isCorrect: false },
        { optionText: 'Madrid', isCorrect: false },
        { optionText: 'Paris', isCorrect: true },
        { optionText: 'Rome', isCorrect: false },
      ],
    },
    {
      question: 'Who developed the theory of relativity?',
      options: [
        { optionText: 'Isaac Newton', isCorrect: false },
        { optionText: 'Albert Einstein', isCorrect: true },
        { optionText: 'Galileo Galilei', isCorrect: false },
        { optionText: 'Nikola Tesla', isCorrect: false },
      ],
    },
    {
      question: 'Which planet is known as the Red Planet?',
      options: [
        { optionText: 'Earth', isCorrect: false },
        { optionText: 'Mars', isCorrect: true },
        { optionText: 'Jupiter', isCorrect: false },
        { optionText: 'Saturn', isCorrect: false },
      ],
    },
  ];

  try {
    res.status(200).json(questions); // Return the questions array
  } catch (error) {
    res.status(500).json({
      error: true,
      message: 'Internal server error',
    });
  }
});

// Login
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  // Validate input fields
  if (!email || !password) {
    return res.status(400).json({
      error: true,
      message: 'Email and password are required',
    });
  }

  try {
    // Find the user by email, including their role
    const userInfo = await User.findOne({ email }).select(
      'email password role'
    ); // Explicitly select fields

    // Check if user exists and if the password matches
    if (!userInfo || !(await bcrypt.compare(password, userInfo.password))) {
      return res.status(400).json({
        error: true,
        message: 'Invalid credentials',
      });
    }

    // Generate JWT token with user id and role
    const accessToken = jwt.sign(
      { id: userInfo._id, role: userInfo.role }, // Include role in payload
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: '10h' }
    );

    // Send the JWT token and role to the frontend
    return res.json({
      error: false,
      message: 'Login successful',
      accessToken, // Send the token
      role: userInfo.role, // Send the role
    });
  } catch (error) {
    console.error(error); // Log error for debugging
    return res.status(500).json({
      error: true,
      message: 'Internal server error',
    });
  }
});

// Add Notes
app.post(
  '/add-notes',
  authenticateToken,
  upload.single('file'),
  async (req, res) => {
    const { title, content, tags } = req.body;
    const { user } = req.user;

    if (!title || !content) {
      return res
        .status(400)
        .json({ error: true, message: 'Title and content are required' });
    }

    let noteData = { title, content, tags: tags || [], userId: user._id };

    if (req.file) {
      const result = await cloudinaryUpload.uploader.upload(req.file.path, {
        resource_type: 'auto',
      });
      noteData.fileUrl = result.url;
      noteData.fileExtension = req.file.originalname.split('.').pop();
    }

    try {
      const note = new Note(noteData);
      await note.save();
      return res.json({
        error: false,
        note,
        message: 'Note added successfully',
      });
    } catch (error) {
      return res
        .status(500)
        .json({ error: true, message: 'Internal server error' });
    }
  }
);

// Edit Note
app.put('/edit-note/:noteId', authenticateToken, async (req, res) => {
  const { noteId } = req.params;
  const { title, content, tags, isPinned } = req.body;
  const { user } = req.user;

  if (!title && !content && !tags) {
    return res
      .status(400)
      .json({ error: true, message: 'No changes provided' });
  }

  try {
    const note = await Note.findOne({ _id: noteId, userId: user._id });
    if (!note) {
      return res.status(404).json({ error: true, message: 'Note not found' });
    }

    if (title) note.title = title;
    if (content) note.content = content;
    if (tags) note.tags = tags;
    if (isPinned) note.isPinned = isPinned;

    await note.save();
    return res.json({
      error: false,
      note,
      message: 'Note updated successfully',
    });
  } catch (error) {
    return res
      .status(500)
      .json({ error: true, message: 'Internal server error' });
  }
});

// Get All Notes
app.get('/get-all-notes', async (req, res) => {
  try {
    const notes = await Note.find({});
    return res.json({
      error: false,
      notes,
      message: 'All notes retrieved successfully',
    });
  } catch (error) {
    return res
      .status(500)
      .json({ error: true, message: 'Internal server error' });
  }
});

// Get Single Note
app.get('/get-note/:id', async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);
    return res.json({
      error: false,
      note,
      message: 'Note retrieved successfully',
    });
  } catch (error) {
    return res
      .status(500)
      .json({ error: true, message: 'Internal server error' });
  }
});

// Delete Note
app.delete('/delete-note/:noteId', authenticateToken, async (req, res) => {
  const { noteId } = req.params;
  const { user } = req.user;

  try {
    const note = await Note.findOne({ _id: noteId, userId: user._id });
    if (!note) {
      return res.status(404).json({ error: true, message: 'Note not found' });
    }
    await Note.deleteOne({ _id: noteId, userId: user._id });
    return res.json({ error: false, message: 'Note deleted successfully' });
  } catch (error) {
    return res
      .status(500)
      .json({ error: true, message: 'Internal server error' });
  }
});

// Search Notes
app.get('/search-note', async (req, res) => {
  const { query } = req.query;

  if (!query) {
    return res
      .status(400)
      .json({ error: true, message: 'Search query is required' });
  }

  try {
    const matchingNotes = await Note.find({
      $or: [
        { title: { $regex: new RegExp(query, 'i') } },
        { content: { $regex: new RegExp(query, 'i') } },
      ],
    });

    if (matchingNotes.length === 0) {
      return res
        .status(404)
        .json({ error: true, message: 'No matching notes found' });
    }

    return res.status(200).json({ error: false, notes: matchingNotes });
  } catch (error) {
    return res
      .status(500)
      .json({ error: true, message: 'Internal server error' });
  }
});

// Get User Info
app.get('/get-user', authenticateToken, async (req, res) => {
  const { user } = req.user;

  try {
    const isUser = await User.findById(user._id);
    if (!isUser) {
      return res.sendStatus(401);
    }

    return res.json({
      user: {
        fullName: isUser.fullName,
        email: isUser.email,
        _id: isUser._id,
        createdOn: isUser.createdOn,
      },
    });
  } catch (error) {
    return res
      .status(500)
      .json({ error: true, message: 'Internal server error' });
  }
});

console.log(process.env.NODE_ENV);
// Start server
const PORT = process.env.NODE_ENV === 'development' ? 8000 : process.env.PORT;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = app;
