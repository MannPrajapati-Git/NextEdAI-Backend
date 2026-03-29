const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const Knowledge = require('../model/Knowledge');
const { Readable } = require('stream');

// Cloudinary Config - Uses env vars from server.js/dotenv
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Multer Memory Storage (Required for Vercel/Cloudinary Stream)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Helper to upload buffer to Cloudinary
const uploadToCloudinary = (buffer, filename) => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            { resource_type: 'auto', folder: 'knowledge', public_id: `file_${Date.now()}_${filename.split('.')[0]}` },
            (error, result) => {
                if (error) return reject(error);
                resolve(result);
            }
        );
        Readable.from(buffer).pipe(uploadStream);
    });
};

// Knowledge Management
router.get('/', async (req, res) => {
    try {
        const items = await Knowledge.find();
        res.json(items);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/', upload.array('files'), async (req, res) => {
    const { title, details } = req.body;
    let combinedContent = "";
    let uploadedFiles = [];

    try {
        if (req.files) {
            for (const file of req.files) {
                // 1. Extract Content
                if (file.mimetype === 'application/pdf') {
                    const data = await pdfParse(file.buffer);
                    combinedContent += `\n--- Content from ${file.originalname} ---\n${data.text}\n`;
                } else if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
                    const result = await mammoth.extractRawText({ buffer: file.buffer });
                    combinedContent += `\n--- Content from ${file.originalname} ---\n${result.value}\n`;
                } else if (file.mimetype.startsWith('text/')) {
                    combinedContent += `\n--- Content from ${file.originalname} ---\n${file.buffer.toString('utf8')}\n`;
                }

                // 2. Upload to Cloudinary
                const result = await uploadToCloudinary(file.buffer, file.originalname);
                uploadedFiles.push({
                    filename: file.originalname,
                    path: result.secure_url,
                    public_id: result.public_id,
                    mimetype: file.mimetype
                });
            }
        }

        const newItem = new Knowledge({ 
            title, 
            details, 
            files: uploadedFiles,
            content: combinedContent 
        });
        await newItem.save();
        res.status(201).json(newItem);
    } catch (err) {
        console.error("Knowledge Upload Error:", err);
        res.status(500).json({ error: err.message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const item = await Knowledge.findById(req.params.id);
        if (item) {
            // Delete from Cloudinary
            for (const f of item.files) {
                if (f.public_id) {
                    await cloudinary.uploader.destroy(f.public_id);
                }
            }
            await Knowledge.findByIdAndDelete(req.params.id);
        }
        res.json({ message: 'Knowledge item deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
