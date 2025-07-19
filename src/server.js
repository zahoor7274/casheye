// src/server.js
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const db = require('./config/database');
const fs = require('fs');

const app = express();
app.set('trust proxy', 1);

// --- Core Middleware ---
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// --- PATH DEFINITIONS (CORRECTED) ---
const publicDirPath = path.join(__dirname, '..', 'public');
// Define uploads directory from ENV var, with a fallback for local development
const uploadsDirPath = process.env.UPLOADS_DIR || path.join(publicDirPath, 'uploads');

console.log(`[SERVER STARTUP] Serving general static files from: ${publicDirPath}`);
console.log(`[SERVER STARTUP] Serving uploaded files from URL '/uploads' using physical path: ${uploadsDirPath}`);


// --- STATIC FILE SERVING & UPLOAD ROUTE ---

// 1. DEDICATED ROUTE FOR SERVING UPLOADED FILES from the correct path
app.get('/uploads/:filename', (req, res, next) => {
    const { filename } = req.params;
    if (filename.includes('..')) {
        return res.status(400).send('Invalid filename.');
    }
    // Use the 'uploadsDirPath' variable which correctly reads from the environment variable
    const filePath = path.join(uploadsDirPath, filename);

    res.sendFile(filePath, (err) => {
        if (err) {
            // Log the path it tried to find
            console.error(`Error sending file. Path: ${filePath}`, err.message);
            if (err.code === "ENOENT") {
                res.status(404).send('File not found.');
            } else {
                res.status(500).send('Error serving file.');
            }
        }
    });
});

// 2. GENERAL STATIC FILES FOR FRONTEND (index.html, css, js)
app.use(express.static(publicDirPath));


// --- API ROUTES ---
// ... (your rate limiter and app.use('/api/...') routes)
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200, message: { message: "Too many requests to our API from this IP, please try again after 15 minutes." }, standardHeaders: true, legacyHeaders: false });
app.use('/api', apiLimiter);
const authUserRoutes = require('./routes/authUserRoutes');
const platformRoutes = require('./routes/platformRoutes');
const transactionUserRoutes = require('./routes/transactionUserRoutes');
const userProfileRoutes = require('./routes/userProfileRoutes');
const adminAuthRoutes = require('./routes/adminAuthRoutes');
const adminDashboardRoutes = require('./routes/adminDashboardRoutes');
const adminUserManagementRoutes = require('./routes/adminUserManagementRoutes');
const adminTransactionRoutes = require('./routes/adminTransactionRoutes');
const adminPlatformSettingsRoutes = require('./routes/adminPlatformSettingsRoutes');

app.use('/api/auth', authUserRoutes);
app.use('/api/platform', platformRoutes);
app.use('/api/transactions', transactionUserRoutes);
app.use('/api/users', userProfileRoutes);
app.use('/api/admin/auth', adminAuthRoutes);
app.use('/api/admin/dashboard', adminDashboardRoutes);
app.use('/api/admin/users', adminUserManagementRoutes);
app.use('/api/admin/transactions', adminTransactionRoutes);
app.use('/api/admin/platform', adminPlatformSettingsRoutes);


// --- CATCH-ALL ROUTE ---
app.get('*', (req, res) => {
    res.sendFile(path.resolve(publicDirPath, 'index.html'));
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