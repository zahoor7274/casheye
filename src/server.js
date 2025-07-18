// src/server.js
require('dotenv').config(); // Load environment variables from .env file

const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const db = require('./config/database');
const fs = require('fs');

const app = express();
console.log("SERVER_LOG: [6] Express app initialized.");
app.set('trust proxy', 1);
console.log("SERVER_LOG: [6a] 'trust proxy' enabled.");
//const PORT = process.env.PORT || 3000;

// --- Middleware ---
app.use(helmet());
app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // Parse JSON request bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded request bodies
app.use(express.static(path.join(__dirname, '..', 'public')));

// Serve uploaded files statically (for screenshots)
// Ensure the 'uploads' directory exists inside 'public'
//app.use('/uploads', express.static(path.join(__dirname, '..', 'public', 'uploads')));
// src/server.js

// ... (after app.use(express.urlencoded({ extended: true }));)

// vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv
// --- DEDICATED DEBUG ROUTE FOR UPLOADED FILES ---
// This will handle requests like /uploads/some-image.jpg

const fs = require('fs'); // Make sure fs is required at the top with other requires

app.get('/uploads/:filename', (req, res, next) => {
    const fileName = req.params.filename;
    
    // Basic security to prevent accessing files outside the uploads directory
    if (!fileName || fileName.includes('..')) {
        console.log(`[UPLOADS DEBUG] Denied access to invalid filename: ${fileName}`);
        return res.status(400).send('Invalid filename.');
    }

    const filePath = path.join(__dirname, '..', 'public', 'uploads', fileName);

    console.log(`[UPLOADS DEBUG] Received request for file: ${fileName}`);
    console.log(`[UPLOADS DEBUG] Constructed absolute server path: ${filePath}`);

    // Check if the file exists at the constructed path
    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
            console.error(`[UPLOADS DEBUG] ERROR: File not found at path: ${filePath}`);
            // Send a clear 404 instead of letting it fall through to other routes
            return res.status(404).send('The requested image was not found on the server.');
        }

        // If the file exists, send it
        console.log(`[UPLOADS DEBUG] File found. Attempting to send...`);
        res.sendFile(filePath, (sendErr) => {
            if (sendErr) {
                console.error(`[UPLOADS DEBUG] ERROR: An error occurred while sending the file ${filePath}:`, sendErr);
                // If headers haven't been sent yet, pass to the global error handler
                if (!res.headersSent) {
                   next(sendErr);
                }
            } else {
                console.log(`[UPLOADS DEBUG] SUCCESS: Successfully sent file: ${filePath}`);
            }
        });
    });
});
// --- END OF DEDICATED DEBUG ROUTE ---
// ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

// Your other middleware and routes follow...
app.use(express.static(path.join(__dirname, '..', 'public'))); // This serves index.html, css, etc.
app.use('/api', apiLimiter);



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