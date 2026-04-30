require('dotenv').config();
const jwt = require('jsonwebtoken');

// payload based on routes/auth.js: signToken(row)
const payload = {
  id: 1,
  username: 'admin',
  role: 'admin',
  display_name: 'Admin'
};
const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
console.log(token);
