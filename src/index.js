import { Hono } from 'hono';
import { sign, verify } from 'hono/jwt';
import bcrypt from 'bcryptjs';

const app = new Hono();
const JWT_SECRET = 'super-secret-movie-tracker-key'; // In production, bind this to env.JWT_SECRET

// Custom Request Logger
app.use('*', async (c, next) => {
    console.log(`[Worker] ${c.req.method} ${c.req.url}`);
    await next();
});

// Authentication Middleware for API routes
app.use('/api/movies/*', async (c, next) => {
    const authHeader = c.req.header('Authorization');
    const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

    if (!token) {
        return c.json({ error: 'Access denied. No token provided.' }, 401);
    }

    try {
        const decoded = await verify(token, JWT_SECRET);
        c.set('user', decoded);
        await next();
    } catch (err) {
        return c.json({ error: 'Invalid or expired authentication token.' }, 403);
    }
});

// AUTHENTICATION API ROUTES

// User Signup
app.post('/api/auth/signup', async (c) => {
    try {
        const { username, password } = await c.req.json();

        if (!username || !password) {
            return c.json({ error: 'Username and password are required.' }, 400);
        }

        const trimmedUsername = username.trim();
        if (trimmedUsername.length < 3) {
            return c.json({ error: 'Username must be at least 3 characters long.' }, 400);
        }
        if (password.length < 6) {
            return c.json({ error: 'Password must be at least 6 characters long.' }, 400);
        }

        // Check if user already exists
        const existingUser = await c.env.DB.prepare(
            "SELECT * FROM users WHERE LOWER(username) = ?"
        ).bind(trimmedUsername.toLowerCase()).first();

        if (existingUser) {
            return c.json({ error: 'Username is already taken.' }, 400);
        }

        // Hash password securely (bcryptjs pure JS works natively in workers)
        const salt = bcrypt.genSaltSync(10);
        const passwordHash = bcrypt.hashSync(password, salt);

        // Generate unique UUID
        const userId = crypto.randomUUID();

        // Save to Cloudflare D1 SQL database
        await c.env.DB.prepare(
            "INSERT INTO users (id, username, passwordHash) VALUES (?, ?, ?)"
        ).bind(userId, trimmedUsername, passwordHash).run();

        // Sign modern Web Cryptography JWT token
        const token = await sign(
            { id: userId, username: trimmedUsername, exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7) },
            JWT_SECRET
        );

        return c.json({
            message: 'User registered successfully',
            token: token,
            user: { id: userId, username: trimmedUsername }
        }, 201);
    } catch (error) {
        console.error('Signup worker error:', error);
        return c.json({ error: 'An internal server error occurred.' }, 500);
    }
});

// User Login
app.post('/api/auth/login', async (c) => {
    try {
        const { username, password } = await c.req.json();

        if (!username || !password) {
            return c.json({ error: 'Username and password are required.' }, 400);
        }

        // Retrieve user from D1 database
        const user = await c.env.DB.prepare(
            "SELECT * FROM users WHERE LOWER(username) = ?"
        ).bind(username.trim().toLowerCase()).first();

        if (!user) {
            return c.json({ error: 'Invalid username or password.' }, 401);
        }

        // Verify password
        const isPasswordValid = bcrypt.compareSync(password, user.passwordHash);
        if (!isPasswordValid) {
            return c.json({ error: 'Invalid username or password.' }, 401);
        }

        // Sign JWT token
        const token = await sign(
            { id: user.id, username: user.username, exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7) },
            JWT_SECRET
        );

        return c.json({
            message: 'Logged in successfully',
            token: token,
            user: { id: user.id, username: user.username }
        }, 200);
    } catch (error) {
        console.error('Login worker error:', error);
        return c.json({ error: 'An internal server error occurred.' }, 500);
    }
});

// MOVIES API ROUTES

// Get all movies of logged-in user
app.get('/api/movies', async (c) => {
    try {
        const user = c.get('user');
        const { results } = await c.env.DB.prepare(
            "SELECT * FROM movies WHERE userId = ? ORDER BY createdAt DESC"
        ).bind(user.id).all();

        return c.json(results, 200);
    } catch (error) {
        console.error('Fetch movies worker error:', error);
        return c.json({ error: 'Failed to retrieve movie logs.' }, 500);
    }
});

// Add movie
app.post('/api/movies', async (c) => {
    try {
        const user = c.get('user');
        const { title, rating, poster } = await c.req.json();

        if (!title) {
            return c.json({ error: 'Movie title is required.' }, 400);
        }

        const movieId = crypto.randomUUID();
        const createdAt = new Date().toISOString();

        await c.env.DB.prepare(
            "INSERT INTO movies (id, userId, title, rating, poster, createdAt) VALUES (?, ?, ?, ?, ?, ?)"
        ).bind(movieId, user.id, title.trim(), rating || '⭐⭐⭐⭐⭐ 5/5', poster || '', createdAt).run();

        return c.json({
            id: movieId,
            userId: user.id,
            title: title.trim(),
            rating: rating,
            poster: poster || '',
            createdAt: createdAt
        }, 201);
    } catch (error) {
        console.error('Add movie worker error:', error);
        return c.json({ error: 'Failed to save movie log.' }, 500);
    }
});

// Delete movie
app.delete('/api/movies/:id', async (c) => {
    try {
        const user = c.get('user');
        const movieId = c.req.param('id');

        const { success } = await c.env.DB.prepare(
            "DELETE FROM movies WHERE id = ? AND userId = ?"
        ).bind(movieId, user.id).run();

        return c.json({ message: 'Movie deleted successfully.' }, 200);
    } catch (error) {
        console.error('Delete movie worker error:', error);
        return c.json({ error: 'Failed to delete movie log.' }, 500);
    }
});

export default app;
