// src/utils/helpers.js
const crypto = require('crypto');

function generateReferralCode(length = 8) {
    return crypto.randomBytes(Math.ceil(length / 2))
        .toString('hex') // convert to hexadecimal format
        .slice(0, length).toUpperCase(); // return required number of characters
}

module.exports = {
    generateReferralCode
};