const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide your name'],
      trim: true,
      maxlength: [50, 'Name cannot be more than 50 characters']
    },
    email: {
      type: String,
      required: [true, 'Please provide your email'],
      unique: true,
      match: [
        /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/,
        'Please provide a valid email'
      ]
    },
    rating: {
      type: Number,
      required: [true, 'Please provide a rating between 1 and 5'],
      min: 1,
      max: 5
    },
    reviewText: {
      type: String,
      required: [true, 'Please write a review text'],
      trim: true,
      maxlength: [1000, 'Review text cannot be more than 1000 characters']
    }
  },
  {
    timestamps: true,
    collection: 'reviews'
  }
);

module.exports = mongoose.model('Review', reviewSchema);
