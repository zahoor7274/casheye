// src/server.js
require('dotenv').config(); // Load environment variables from .env file

const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
console.log("SERVER_LOG: [6] Express app initialized.");
app.set('trust proxy', 1);
console.log("SERVER_LOG: [6a] 'trust proxy' enabled.");
const PORT = process.env.PORT || 3000;

// --- Database Setup (SQLite) ---
const db = require('./config/database'); // We'll create this next

// --- Middleware ---
app.use(helmet());
app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // Parse JSON request bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded request bodies
app.use(express.static(path.join(__dirname, '..', 'public')));

// Serve uploaded files statically (for screenshots)
// Ensure the 'uploads' directory exists inside 'public'
app.use('/uploads', express.static(path.join(__dirname, '..', 'public', 'uploads')));


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
// We'll define these later and import them
// e.g., const authRoutes = require('./routes/authRoutes');
// app.use('/api/auth', authRoutes);

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


// --- Global Error Handler (Basic) ---
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something went wrong!', error: err.message });
});

// --- Start Server ---
 app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    // Initialize database tables when server starts
        db.initTables().then(() => {
        console.log('Database tables initialized/checked.');
/*        if (process.env.INITIAL_ADMIN_CREATED !== 'true') { // Check the flag
            const { createDefaultAdmin } = require('./models/adminModel');
            // Make createDefaultAdmin use env vars for username/password or pass them
            const defaultAdminUser = process.env.DEFAULT_ADMIN_USERNAME || 'professor';
            const defaultAdminPass = process.env.DEFAULT_ADMIN_PASSWORD || 'password123';

            createDefaultAdmin(defaultAdminUser, defaultAdminPass) // Or modify createDefaultAdmin to use env
                .then(msg => {
                    console.log(msg);
                    if (msg.includes('created')) {
                        console.log("IMPORTANT: Set INITIAL_ADMIN_CREATED=true in your .env file to prevent re-creation.");
                    }
                })
                .catch(err => console.error("Error creating default admin:", err));
        } else {
            console.log("Default admin creation skipped (INITIAL_ADMIN_CREATED is true).");
        }*/
    }).catch(err => {
        console.error('Failed to initialize database tables:', err);
    });
});

module.exports = app;