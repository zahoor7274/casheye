// src/server.js
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const db = require('./config/database');

const app = express();
console.log("SERVER_LOG: [6] Express app initialized.");
app.set('trust proxy', 1);
console.log("SERVER_LOG: [6a] 'trust proxy' enabled.");

// --- Middleware ---
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- CORRECTED STATIC FILE SERVING ORDER ---
// 1. Handle SPECIFIC static paths first, like /uploads.
// This ensures that any request starting with /uploads is ONLY handled here.
app.use('/uploads', express.static(path.join(__dirname, '..', 'public', 'uploads')));

// 2. Handle GENERAL static files for your frontend (index.html, css, js).
// This serves files from the root of the 'public' directory.
// A request to yoursite.com/script.js will look for public/script.js.
app.use(express.static(path.join(__dirname, '..', 'public')));
// -------------------------------------------

// --- Rate Limiting for API ---
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200, // Increased for general API usage
    message: { message: "Too many requests to our API from this IP, please try again after 15 minutes." },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api', apiLimiter);

// --- API Routes ---
const authUserRoutes = require('./routes/authUserRoutes');
const platformRoutes = require('./routes/platformRoutes');
// ... (all other route imports)
const adminPlatformSettingsRoutes = require('./routes/adminPlatformSettingsRoutes');

app.use('/api/auth', authUserRoutes);
app.use('/api/platform', platformRoutes);
// ... (all other app.use for routes)
app.use('/api/admin/platform', adminPlatformSettingsRoutes);

// --- Root Route for Health Check (can be here or at top) ---
app.get('/api', (req, res) => { // Changed to /api to avoid conflict with frontend index.html
    res.send('CashEye API is running!');
});

// --- Catch-all for Frontend SPA routing (IMPORTANT: place this AFTER all other routes) ---
// This serves your main index.html for any GET request that didn't match an API route or a static file.
app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '..', 'public', 'index.html'));
});

// --- Global Error Handler ---
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something went wrong!', error: err.message });
});

// --- Start Server ---
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`SERVER_LOG: [12] SUCCESS! Server is now listening on port ${PORT}.`);
    db.initTables()
        .then(() => {
            console.log('SERVER_LOG: [14] Database tables initialization successful.');
            const { createDefaultAdmin } = require('./models/adminModel');
            createDefaultAdmin()
                .then(msg => console.log(msg))
                .catch(err => console.error("Error during default admin creation:", err));
            console.log("SERVER_LOG: [15] App is fully ready and healthy.");
        })
        .catch(err => {
            console.error('SERVER_LOG_FATAL: [14a] FAILED to initialize database tables!', err);
            process.exit(1);
        });
});

module.exports = app;