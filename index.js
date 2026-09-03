require('dotenv').config();

const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use('/public', express.static(`${process.cwd()}/public`));

// Connect to MongoDB Atlas
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// User schema and model
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true
  }
});

const User = mongoose.model('User', userSchema);

// Exercise schema and model
const exerciseSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User'
  },
  description: {
    type: String,
    required: true
  },
  duration: {
    type: Number,
    required: true
  },
  date: {
    type: Date,
    required: true
  }
});

const Exercise = mongoose.model('Exercise', exerciseSchema);

// Homepage
app.get('/', function(req, res) {
  res.sendFile(process.cwd() + '/views/index.html');
});

// Create a new user
app.post('/api/users', async function(req, res) {
  try {
    const user = new User({
      username: req.body.username
    });

    const savedUser = await user.save();

    res.json({
      username: savedUser.username,
      _id: savedUser._id
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

// Get all users
app.get('/api/users', async function(req, res) {
  try {
    const users = await User.find({}).select('username _id');

    res.json(users);
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

// Add an exercise to a user
app.post('/api/users/:_id/exercises', async function(req, res) {
  try {
    const user = await User.findById(req.params._id);

    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    const exerciseDate = req.body.date
      ? new Date(req.body.date)
      : new Date();

    if (isNaN(exerciseDate.getTime())) {
      return res.json({
        error: 'Invalid Date'
      });
    }

    const duration = Number(req.body.duration);

    const exercise = new Exercise({
      userId: user._id,
      description: req.body.description,
      duration: duration,
      date: exerciseDate
    });

    const savedExercise = await exercise.save();

    res.json({
      username: user.username,
      description: savedExercise.description,
      duration: savedExercise.duration,
      date: savedExercise.date.toDateString(),
      _id: user._id
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

// Get a user's exercise log
app.get('/api/users/:_id/logs', async function(req, res) {
  try {
    const user = await User.findById(req.params._id);

    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    const exerciseQuery = {
      userId: user._id
    };

    // Add optional date filters
    if (req.query.from || req.query.to) {
      exerciseQuery.date = {};

      if (req.query.from) {
        exerciseQuery.date.$gte = new Date(req.query.from);
      }

      if (req.query.to) {
        const toDate = new Date(req.query.to);
        toDate.setUTCHours(23, 59, 59, 999);
        exerciseQuery.date.$lte = toDate;
      }
    }

    let query = Exercise.find(exerciseQuery).sort({ date: 1 });

    // Add the optional limit
    if (req.query.limit) {
      const limit = parseInt(req.query.limit, 10);

      if (!isNaN(limit) && limit > 0) {
        query = query.limit(limit);
      }
    }

    const exercises = await query;

    const log = exercises.map(function(exercise) {
      return {
        description: exercise.description,
        duration: exercise.duration,
        date: exercise.date.toDateString()
      };
    });

    res.json({
      username: user.username,
      count: log.length,
      _id: user._id,
      log: log
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

// Start the server
app.listen(port, function() {
  console.log(`Listening on port ${port}`);
});