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

app.use(express.static(publicDirPath));
// app.use('/uploads', express.static(uploadsDirPath))

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
app.get('*', (req, res) => {
    // This sends index.html for any GET request that wasn't an API call or a found static file.
    res.sendFile(path.join(publicDirPath, 'index.html'));
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