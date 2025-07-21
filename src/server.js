// src/server.js
require('dotenv').config(); // Load environment variables from .env file

const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const db = require('./config/database');
const fs = require('fs')

const app = express();
app.set('trust proxy', 1);
//const PORT = process.env.PORT || 3000;

// --- Middleware ---
app.use(helmet());
app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // Parse JSON request bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded request bodies
// app.use(express.static(path.join(__dirname, '..', 'public')));

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



// --- Basic Route ---
app.get('/', (req, res) => {
    res.send('CashEye API is running!');
});


const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Allow 100 requests to any /api endpoint per 15 minutes per IP
    message: { message: "Too many requests to our API from this IP, please try again after 15 minutes." },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api', apiLimiter);
// --- API Routes ---
const authUserRoutes = require('./routes/authUserRoutes');
const platformRoutes = require('./routes/platformRoutes');
const transactionUserRoutes = require('./routes/transactionUserRoutes');
const userProfileRoutes = require('./routes/userProfileRoutes');

app.use('/api/auth', authUserRoutes);
app.use('/api/platform', platformRoutes);
app.use('/api/transactions', transactionUserRoutes);
app.use('/api/users', userProfileRoutes);

// Admin Routes
const adminAuthRoutes = require('./routes/adminAuthRoutes');
const adminDashboardRoutes = require('./routes/adminDashboardRoutes');
const adminUserManagementRoutes = require('./routes/adminUserManagementRoutes');
const adminTransactionRoutes = require('./routes/adminTransactionRoutes');
const adminPlatformSettingsRoutes = require('./routes/adminPlatformSettingsRoutes');

// const adminManageAdminsRoutes = require('./routes/adminManageAdminsRoutes'); // For UI demo, real admin management needs careful thought

app.use('/api/admin/auth', adminAuthRoutes);
app.use('/api/admin/dashboard', adminDashboardRoutes);
app.use('/api/admin/users', adminUserManagementRoutes);
app.use('/api/admin/transactions', adminTransactionRoutes);
app.use('/api/admin/platform', adminPlatformSettingsRoutes);


// app.use('/api/admin/manage', adminManageAdminsRoutes);

// --- CATCH-ALL ROUTE for Single Page App behavior ---
//app.get(/^(?!\/api).*/, (req, res) => {
    //The regex /^(?!\/api).*/ means: "match any path that does NOT start with /api"
//    console.log(`[CATCH-ALL] Serving index.html for non-API route: ${req.path}`);
//    res.sendFile(path.resolve(__dirname, '..', 'public', 'index.html'));
//});

// --- Global Error Handler (Basic) ---
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something went wrong!', error: err.message });
});



const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`SERVER_LOG: [12] SUCCESS! Server is now listening on port ${PORT}.`);
    db.initTables()
        .then(() => {
            console.log('SERVER_LOG: [14] Database tables initialization successful.');
            // This is how you call an async function from a .then() block
            const { createDefaultAdmin } = require('./models/adminModel');
            createDefaultAdmin()
                .then(msg => console.log(msg))
                .catch(err => console.error("Error during default admin creation:", err));
            console.log("SERVER_LOG: [15] App is fully ready and healthy.");
        })
        .catch(err => {
            console.error('SERVER_LOG_FATAL: [14a] FAILED to initialize database tables!', err);
            process.exit(1); // Exit if DB init fails
        });
});

module.exports = app;