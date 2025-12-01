const bcrypt = require('bcryptjs');

const STOCK_PASSWORD = process.env.STOCK_PASSWORD || '2255';

// Simple password verification for stock operations
const verifyStockPassword = (req, res, next) => {
  const { password } = req.body;
  
  if (!password) {
    return res.status(401).json({ message: 'Password is required' });
  }
  
  if (password !== STOCK_PASSWORD) {
    return res.status(401).json({ message: 'Incorrect password' });
  }
  
  next();
};

module.exports = {
  verifyStockPassword,
};