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


const projectRoot = path.resolve(__dirname, '..');
const publicDirPath = path.join(projectRoot, 'public');
const uploadsDirPath = path.join(publicDirPath, 'uploads');
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
// Serve uploaded files statically (for screenshots)
// Ensure the 'uploads' directory exists inside 'public'
// app.use('/uploads', express.static(path.join(__dirname, '..', 'public', 'uploads')));

app.get('/uploads/:filename', (req, res) => {
    const { filename } = req.params;

    // Security: Prevent directory traversal (e.g., ../../secrets.txt)
    if (filename.includes('..')) {
        return res.status(400).send('Invalid filename.');
    }

    // Use the absolute path we already calculated at startup
    const filePath = path.join(uploadsDirPath, filename);

    // Send the file. The callback will handle errors like the file not existing.
    res.sendFile(filePath, (err) => {
        if (err) {
            console.error(`Error sending file ${filename}:`, err);
            // The 'ENOENT' error code means "Error, No Entry" (file not found)
            if (err.code === "ENOENT") {
                res.status(404).send('File not found.');
            } else {
                // For other errors (e.g., permission issues), send a generic server error
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
console.log("[ROUTER_CHECK] Importing route modules...");
const authUserRoutes = require('./routes/authUserRoutes');
console.log("[ROUTER_CHECK] authUserRoutes is:", typeof authUserRoutes);
const platformRoutes = require('./routes/platformRoutes');
console.log("[ROUTER_CHECK] platformRoutes is:", typeof platformRoutes);
const transactionUserRoutes = require('./routes/transactionUserRoutes');
console.log("[ROUTER_CHECK] transactionUserRoutes is:", typeof transactionUserRoutes);
const userProfileRoutes = require('./routes/userProfileRoutes');
console.log("[ROUTER_CHECK] userProfileRoutes is:", typeof userProfileRoutes);

app.use('/api/auth', authUserRoutes);
app.use('/api/platform', platformRoutes);
app.use('/api/transactions', transactionUserRoutes);
app.use('/api/users', userProfileRoutes);

// Admin Routes
const adminAuthRoutes = require('./routes/adminAuthRoutes');
console.log("[ROUTER_CHECK] adminAuthRoutes is:", typeof adminAuthRoutes);
const adminDashboardRoutes = require('./routes/adminDashboardRoutes');
console.log("[ROUTER_CHECK] adminDashboardRoutes is:", typeof adminDashboardRoutes);
const adminUserManagementRoutes = require('./routes/adminUserManagementRoutes');
console.log("[ROUTER_CHECK] adminUserManagementRoutes is:", typeof adminUserManagementRoutes);
const adminTransactionRoutes = require('./routes/adminTransactionRoutes');
console.log("[ROUTER_CHECK] adminTransactionRoutes is:", typeof adminTransactionRoutes);
const adminPlatformSettingsRoutes = require('./routes/adminPlatformSettingsRoutes');
console.log("[ROUTER_CHECK] adminPlatformSettingsRoutes is:", typeof adminPlatformSettingsRoutes);

console.log("[ROUTER_CHECK] All route modules imported. Proceeding to mount.");
// const adminManageAdminsRoutes = require('./routes/adminManageAdminsRoutes'); // For UI demo, real admin management needs careful thought

app.use('/api/admin/auth', adminAuthRoutes);
app.use('/api/admin/dashboard', adminDashboardRoutes);
app.use('/api/admin/users', adminUserManagementRoutes);
app.use('/api/admin/transactions', adminTransactionRoutes);
app.use('/api/admin/platform', adminPlatformSettingsRoutes);


console.log("[ROUTER_CHECK] All API routes mounted successfully.");
// app.use('/api/admin/manage', adminManageAdminsRoutes);

// --- CATCH-ALL ROUTE for Single Page App behavior ---
app.get(/^(?!\/api).*/, (req, res) => {
    // The regex /^(?!\/api).*/ means: "match any path that does NOT start with /api"
    console.log(`[CATCH-ALL] Serving index.html for non-API route: ${req.path}`);
    res.sendFile(path.resolve(__dirname, '..', 'public', 'index.html'));
});

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