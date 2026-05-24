const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-movie-tracker-key';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Custom Request Logger for debugging
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Authentication Middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

    if (!token) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(403).json({ error: 'Invalid or expired authentication token.' });
    }
}

// AUTHENTICATION API ROUTES

// User Signup
app.post('/api/auth/signup', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required.' });
        }

        const trimmedUsername = username.trim();
        if (trimmedUsername.length < 3) {
            return res.status(400).json({ error: 'Username must be at least 3 characters long.' });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
        }

        // Check if user already exists
        const existingUser = db.getUserByUsername(trimmedUsername);
        if (existingUser) {
            return res.status(400).json({ error: 'Username is already taken.' });
        }

        // Hash the password securely
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        // Save user to data store
        const newUser = db.saveUser(trimmedUsername, passwordHash);

        // Generate token
        const token = jwt.sign({ id: newUser.id, username: newUser.username }, JWT_SECRET, { expiresIn: '7d' });

        return res.status(201).json({
            message: 'User registered successfully',
            token: token,
            user: { id: newUser.id, username: newUser.username }
        });
    } catch (error) {
        console.error('Signup error:', error);
        return res.status(500).json({ error: 'An internal server error occurred.' });
    }
});

// User Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required.' });
        }

        // Retrieve user
        const user = db.getUserByUsername(username);
        if (!user) {
            return res.status(401).json({ error: 'Invalid username or password.' });
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Invalid username or password.' });
        }

        // Generate token
        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });

        return res.status(200).json({
            message: 'Logged in successfully',
            token: token,
            user: { id: user.id, username: user.username }
        });
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ error: 'An internal server error occurred.' });
    }
});

// MOVIES API ROUTES

// Get all movies of logged-in user
app.get('/api/movies', authenticateToken, (req, res) => {
    try {
        const movies = db.getMovies(req.user.id);
        return res.status(200).json(movies);
    } catch (error) {
        console.error('Fetch movies error:', error);
        return res.status(500).json({ error: 'Failed to retrieve movie logs.' });
    }
});

// Add movie
app.post('/api/movies', authenticateToken, (req, res) => {
    try {
        const { title, rating, poster } = req.body;

        if (!title) {
            return res.status(400).json({ error: 'Movie title is required.' });
        }

        const newMovie = db.addMovie(req.user.id, title, rating || '⭐⭐⭐⭐⭐ 5/5', poster || '');
        return res.status(201).json(newMovie);
    } catch (error) {
        console.error('Add movie error:', error);
        return res.status(500).json({ error: 'Failed to save movie log.' });
    }
});

// Delete movie
app.delete('/api/movies/:id', authenticateToken, (req, res) => {
    try {
        const movieId = req.params.id;
        const deleted = db.deleteMovie(movieId, req.user.id);

        if (!deleted) {
            return res.status(404).json({ error: 'Movie not found or unauthorized.' });
        }

        return res.status(200).json({ message: 'Movie deleted successfully.' });
    } catch (error) {
        console.error('Delete movie error:', error);
        return res.status(500).json({ error: 'Failed to delete movie log.' });
    }
});

// Fallback Route for SPA or static index page
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start the server
app.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(`  Movie Tracker Server is active and operational!`);
    console.log(`  Local Address: http://localhost:${PORT}`);
    console.log(`==================================================`);
});
