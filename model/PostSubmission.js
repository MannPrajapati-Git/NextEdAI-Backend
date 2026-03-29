const mongoose = require('mongoose');

const postSubmissionSchema = new mongoose.Schema({
  postId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    required: true,
    index: true
  },
  studentId: {
    type: String,
    required: true
  },
  studentName: {
    type: String,
    required: true
  },
  message: {
    type: String,
    default: ''
  },
  files: [{
    name: { type: String, required: true },
    type: { type: String, required: true },
    size: { type: String, required: true },
    url: { type: String, required: true },
    public_id: { type: String, required: true }
  }],
  submittedAt: {
    type: Date,
    default: Date.now
  }
}, { 
  timestamps: true 
});

// Index for faster queries
postSubmissionSchema.index({ postId: 1, studentId: 1 });

module.exports = mongoose.model('PostSubmission', postSubmissionSchema);
