const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const Pusher = require('pusher');

dotenv.config();

const app = express();

// Pusher Initialization
const pusher = new Pusher({
    appId: process.env.PUSHER_APP_ID,
    key: process.env.PUSHER_KEY,
    secret: process.env.PUSHER_SECRET,
    cluster: process.env.PUSHER_CLUSTER,
    useTLS: true
});

const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));
app.use('/uploads', express.static('uploads'));

// Set pusher on app for controller access (Replaces socketio)
app.set('pusher', pusher);

// Request Logger
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connected to MongoDB: NextEd AI'))
    .catch(err => console.error('MongoDB connection error:', err));

// Routes
const chatbotRoutes = require('./routes/chatbot');
const knowledgeRoutes = require('./routes/knowledge');
const aitutorRoutes = require('./routes/aitutor');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const classroomRoutes = require('./routes/classroom');
const teacherRoutes = require('./routes/teacher');
const postRoutes = require('./routes/post');
const examRoutes = require('./routes/examRoutes');
const submissionRoutes = require('./routes/submission');

app.use('/api', chatbotRoutes);
app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/aitutor', aitutorRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/classroom', classroomRoutes);
app.use('/api/teacher', teacherRoutes);
app.use('/api/post', postRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/submission', submissionRoutes);
app.use('/api/vmeet', require('./routes/vmeet'));
app.use('/api/reviews', require('./routes/review'));

// Root route for health check
app.get('/', (req, res) => {
    res.send('NextEd AI Backend is running in production mode.');
});

// For Vercel, we export the app
module.exports = app;

// Local development listener
if (process.env.NODE_ENV !== 'production') {
    app.listen(port, () => {
        console.log(`Server running at http://localhost:${port}`);
    });
}
