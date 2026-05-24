-- D1 Database Schema for Movies Tracker

DROP TABLE IF EXISTS users;
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    passwordHash TEXT NOT NULL,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP
);

DROP TABLE IF EXISTS movies;
CREATE TABLE movies (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    title TEXT NOT NULL,
    rating TEXT NOT NULL,
    poster TEXT DEFAULT '',
    createdAt TEXT NOT NULL,
    FOREIGN KEY (userId) REFERENCES users (id) ON DELETE CASCADE
);
