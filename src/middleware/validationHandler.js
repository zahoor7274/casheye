// src/middleware/validationHandler.js

const { validationResult } = require('express-validator');

/**
 * Middleware to handle validation errors collected by express-validator.
 * If validation errors exist, it sends a 422 Unprocessable Entity response.
 * Otherwise, it passes control to the next middleware in the stack.
 */
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req); // Gets validation errors from the request

    if (errors.isEmpty()) {
        // No validation errors, proceed to the next middleware (e.g., the controller)
        return next();
    }

    // There are validation errors. Format them and send a response.
    const extractedErrors = [];
    errors.array().map(err => {
        // err.path is the field that failed validation (from express-validator v6.LTS+)
        // In older versions, it might have been err.param.
        // We prioritize err.path, but can fall back to err.param for broader compatibility if needed,
        // though for a new project, err.path should be standard.
        const field = err.path || err.param; // Use err.path, fallback to err.param just in case of old validator version remnants
        extractedErrors.push({ [field]: err.msg });
    });

    return res.status(422).json({ // 422 Unprocessable Entity
        message: "Validation failed. Please check your input.",
        errors: extractedErrors
    });
};

module.exports = {
    handleValidationErrors
};