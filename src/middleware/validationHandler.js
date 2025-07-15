// src/middleware/validationHandler.js
const { validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (errors.isEmpty()) {
        return next();
    }
    const extractedErrors = [];
    errors.array().map(err => {
        extractedErrors.push({ [err.path]: err.msg });
    });

    return res.status(422).json({
        message: "Validation failed. Please check your input.",
        errors: extractedErrors
    });
};

module.exports = { handleValidationErrors };