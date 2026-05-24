const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data.json');

// Initialize database file if it doesn't exist
function initDB() {
    if (!fs.existsSync(DB_PATH)) {
        fs.writeFileSync(DB_PATH, JSON.stringify({ users: [], movies: [] }, null, 2), 'utf8');
    }
}

// Thread-safe / Atomic atomic read
function readDB() {
    initDB();
    try {
        const raw = fs.readFileSync(DB_PATH, 'utf8');
        return JSON.parse(raw);
    } catch (err) {
        console.error("Error reading database, resetting to default structures.", err);
        return { users: [], movies: [] };
    }
}

// Atomic write to prevent file corruption
function writeDB(data) {
    const tempPath = DB_PATH + '.tmp';
    try {
        fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
        fs.renameSync(tempPath, DB_PATH);
        return true;
    } catch (err) {
        console.error("Error writing to database securely:", err);
        if (fs.existsSync(tempPath)) {
            try { fs.unlinkSync(tempPath); } catch (_) {}
        }
        return false;
    }
}

module.exports = {
    // User Operations
    getUsers() {
        return readDB().users;
    },

    getUserByUsername(username) {
        const lowerName = username.trim().toLowerCase();
        return readDB().users.find(u => u.username.toLowerCase() === lowerName);
    },

    saveUser(username, passwordHash) {
        const db = readDB();
        const newUser = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
            username: username.trim(),
            passwordHash: passwordHash
        };
        db.users.push(newUser);
        writeDB(db);
        return newUser;
    },

    // Movie Operations
    getMovies(userId) {
        return readDB().movies.filter(m => m.userId === userId);
    },

    addMovie(userId, title, rating, poster) {
        const db = readDB();
        const newMovie = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
            userId: userId,
            title: title.trim(),
            rating: rating,
            poster: poster || "",
            createdAt: new Date().toISOString()
        };
        db.movies.push(newMovie);
        writeDB(db);
        return newMovie;
    },

    deleteMovie(movieId, userId) {
        const db = readDB();
        const initialCount = db.movies.length;
        db.movies = db.movies.filter(m => !(m.id === movieId && m.userId === userId));
        if (db.movies.length < initialCount) {
            writeDB(db);
            return true;
        }
        return false;
    }
};
