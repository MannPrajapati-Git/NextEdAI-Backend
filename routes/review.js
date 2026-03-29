const express = require('express');
const router = express.Router();
const Review = require('../model/Review');

// POST /api/reviews - Submit a new review
router.post('/', async (req, res) => {
    try {
        const { name, email, rating, reviewText } = req.body;
        
        // Validation
        if (!name || !email || !rating || !reviewText) {
            return res.status(400).json({ success: false, message: 'Please provide all details' });
        }

        // Check if user already submitted a review
        const existingReview = await Review.findOne({ email: email.toLowerCase() });
        if (existingReview) {
            return res.status(400).json({ 
                success: false, 
                message: 'You have already submitted a review using this email.' 
            });
        }

        // Create new review
        const review = await Review.create({
            name,
            email: email.toLowerCase(),
            rating: Number(rating),
            reviewText
        });

        res.status(201).json({ success: true, data: review });
    } catch (error) {
        console.error('Error creating review:', error);
        
        // Handle Mongoose Validator errors
        if (error.name === 'ValidationError') {
           const messages = Object.values(error.errors).map(val => val.message);
           return res.status(400).json({ success: false, message: messages.join(', ') });
        }
        res.status(500).json({ success: false, message: 'Server error. Please try again later.' });
    }
});

// GET /api/reviews - Fetch all reviews
router.get('/', async (req, res) => {
    try {
        // Find all reviews and sort by newest first (descending timestamp)
        const reviews = await Review.find().sort({ createdAt: -1 });
        res.status(200).json({ success: true, count: reviews.length, data: reviews });
    } catch (error) {
        console.error('Error fetching reviews:', error);
        res.status(500).json({ success: false, message: 'Server error. Please try again later.' });
    }
});

module.exports = router;
