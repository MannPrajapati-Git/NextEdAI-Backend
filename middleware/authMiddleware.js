const Admin = require('../model/Admin');

// Middleware to verify admin authentication
const verifyAdmin = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(401).json({ 
        success: false, 
        message: 'Admin authentication required' 
      });
    }

    // Verify admin exists
    const admin = await Admin.findOne({ email: email.toLowerCase() });
    if (!admin) {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. Admin privileges required.' 
      });
    }

    req.admin = admin;
    next();
  } catch (err) {
    console.error('Admin verification error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Error verifying admin credentials' 
    });
  }
};

module.exports = { verifyAdmin };
