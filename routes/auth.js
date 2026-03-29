const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// ==================== STUDENT ROUTES ====================

// Student Signup
router.post('/signup/student', authController.studentSignup);

// Student Login
router.post('/login/student', authController.studentLogin);

// ==================== TEACHER ROUTES ====================

// Teacher Signup
router.post('/signup/teacher', authController.teacherSignup);

// Teacher Login
router.post('/login/teacher', authController.teacherLogin);

// ==================== COMMON ROUTES ====================

// Logout
router.post('/logout', authController.logout);

// Delete Account
router.delete('/delete-account', authController.deleteAccount);

// Pusher Channel Auth
router.post('/pusher/auth', authController.pusherAuth);

// Validate Teacher Status
router.post('/validate-teacher', authController.validateTeacher);

module.exports = router;
