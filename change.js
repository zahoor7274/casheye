// hash_admin_pass.js
const bcrypt = require('bcryptjs');
const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout,
});

readline.question('Enter the new admin password: ', (newPassword) => {
    if (!newPassword || newPassword.length < 6) {
        console.error("Password cannot be empty and should be at least 6 characters long.");
        readline.close();
        return;
    }

    bcrypt.hash(newPassword, 10, function(err, hash) {
        if (err) {
            console.error('Error hashing password:', err);
        } else {
            console.log('New Admin Username: (Enter this directly in DB Browser)');
            console.log('Hashed Password (copy this into DB Browser):');
            console.log(hash);
        }
        readline.close();
    });
});