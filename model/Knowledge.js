const mongoose = require('mongoose');

const knowledgeSchema = new mongoose.Schema({
    title: { type: String, required: true },
    details: { type: String },
    files: [{
        filename: String,
        path: String, // This will store the Cloudinary URL
        public_id: String, // Required for deletion
        mimetype: String
    }],
    content: { type: String }, // Extracted text from files
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Knowledge', knowledgeSchema);
