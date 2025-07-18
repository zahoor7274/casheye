// src/server.js
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const db = require('./config/database');
const fs = require('fs'); // We need fs for a startup check

const app = express();
app.set('trust proxy', 1);

// --- Core Middleware ---
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- PATH DEFINITION AND DEBUGGING ---
// Get the absolute path to the project root directory
const projectRoot = path.resolve(__dirname, '..');
// Define absolute paths for public and uploads directories
const publicDirPath = path.join(projectRoot, 'public');
const uploadsDirPath = path.join(publicDirPath, 'uploads');

// Log these paths on startup to be 100% sure they are correct
console.log(`[PATH DEBUG] Project Root: ${projectRoot}`);
console.log(`[PATH DEBUG] Public Directory Path: ${publicDirPath}`);
console.log(`[PATH DEBUG] Uploads Directory Path: ${uploadsDirPath}`);

// Check if directories exist on startup
if (fs.existsSync(publicDirPath)) {
    console.log('[PATH DEBUG] Public directory confirmed to exist.');
} else {
    console.error('[PATH DEBUG] FATAL: Public directory NOT FOUND.');
}
if (fs.existsSync(uploadsDirPath)) {
    console.log('[PATH DEBUG] Uploads directory confirmed to exist.');
} else {
    console.error('[PATH DEBUG] WARNING: Uploads directory NOT FOUND. It will be created on first upload.');
}
// --- END PATH DEBUGGING ---


// --- STATIC FILE SERVING (Correct Order) ---
// 1. Handle specific static path for /uploads
app.use('/uploads', express.static(uploadsDirPath));

// 2. Handle general static files for the frontend (index.html, etc.)
app.use(express.static(publicDirPath));


// --- API ROUTES ---
const apiLimiter = rateLimit({ /* ... your config ... */ });
app.use('/api', apiLimiter);

// (Import all your route files here)
const authUserRoutes = require('./routes/authUserRoutes');
// ... etc ...
const adminPlatformSettingsRoutes = require('./routes/adminPlatformSettingsRoutes');

// (Mount all your API routes here)
app.use('/api/auth', authUserRoutes);
// ... etc ...
app.use('/api/admin/platform', adminPlatformSettingsRoutes);


// --- CATCH-ALL ROUTE for Single Page App behavior ---
app.get('*', (req, res) => {
    // This sends index.html for any GET request that wasn't an API call or a found static file.
    res.sendFile(path.join(publicDirPath, 'index.html'));
});

// --- Global Error Handler ---
app.use((err, req, res, next) => {
    console.error("GLOBAL_ERROR_HANDLER:", err.stack);
    res.status(500).json({ message: 'An unexpected server error occurred.' });
});

// --- Start Server ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`SERVER_LOG: Server is now listening on port ${PORT}.`);
    db.initTables()
        .then(() => {
            console.log('SERVER_LOG: Database tables initialization check complete.');
            const { createDefaultAdmin } = require('./models/adminModel');
            createDefaultAdmin()
                .then(msg => console.log(`SERVER_LOG: ${msg}`))
                .catch(err => console.error("SERVER_LOG_ERROR: Error during default admin creation:", err));
        })
        .catch(err => {
            console.error('SERVER_LOG_FATAL: FAILED to initialize database tables!', err);
            process.exit(1);
        });
});

module.exports = app;