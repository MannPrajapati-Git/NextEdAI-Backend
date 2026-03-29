const express = require('express');
const router = express.Router();
const Post = require('../model/Post');
const Classroom = require('../model/Classroom');
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// ==================== POST ROUTES ====================

// Create Post (Teacher)
router.post('/create', async (req, res) => {
  console.log('📮 Create Post Request');
  console.log('Request body:', { ...req.body, files: req.body.files?.length || 0 });
  
  try {
    const { classroomId, title, description, videoLink, files, teacherName, allowStudentUpload } = req.body;
    
    // Validation
    if (!classroomId || !title || !description || !teacherName) {
      return res.status(400).json({ message: 'Required fields: classroomId, title, description, teacherName' });
    }

    // Upload files to Cloudinary if they are base64
    const uploadedFiles = [];
    if (files && files.length > 0) {
      for (const file of files) {
        if (file.data && file.data.startsWith('data:')) {
          const uploadRes = await cloudinary.uploader.upload(file.data, {
            folder: 'classroom_posts',
            resource_type: 'auto'
          });
          uploadedFiles.push({
            name: file.name,
            type: file.type,
            size: file.size,
            url: uploadRes.secure_url,
            public_id: uploadRes.public_id
          });
        } else {
          uploadedFiles.push(file);
        }
      }
    }

    // Create post
    const newPost = new Post({
      classroomId,
      title,
      description,
      videoLink: videoLink || '',
      files: uploadedFiles,
      teacherName,
      isEdited: false,
      isDeleted: false,
      allowStudentUpload: allowStudentUpload || false
    });

    await newPost.save();
    console.log('✅ Post created:', newPost._id);

    // Emit socket event to students in the classroom
    const pusher = req.app.get('pusher');
    if (pusher) {
      const classroom = await Classroom.findById(classroomId);
      if (classroom) {
        classroom.students.forEach(student => {
          pusher.trigger(student.email, 'post-added', {
            classroomId,
            post: newPost
          });
        });
      }
    }

    res.status(201).json({ 
      message: 'Post created successfully',
      post: newPost
    });
  } catch (err) {
    console.error('❌ Create post error:', err);
    res.status(500).json({ message: 'Server error creating post' });
  }
});

// Get All Posts for a Classroom
router.get('/classroom/:classroomId', async (req, res) => {
  console.log('📋 Get Classroom Posts Request');
  
  try {
    const { classroomId } = req.params;
    
    // Find all posts for this classroom, sorted by newest first
    const posts = await Post.find({ classroomId })
      .sort({ createdAt: -1 });

    console.log(`✅ Found ${posts.length} posts for classroom ${classroomId}`);

    res.json({ posts });
  } catch (err) {
    console.error('❌ Get posts error:', err);
    res.status(500).json({ message: 'Server error fetching posts' });
  }
});

// Update Post (Teacher)
router.put('/:id', async (req, res) => {
  console.log('✏️ Update Post Request');
  
  try {
    const { id } = req.params;
    const { title, description, videoLink, files, allowStudentUpload } = req.body;
    
    // Find post
    const post = await Post.findById(id);
    
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Update fields
    if (title) post.title = title;
    if (description) post.description = description;
    if (videoLink !== undefined) post.videoLink = videoLink;
    if (files !== undefined) post.files = files;
    if (allowStudentUpload !== undefined) post.allowStudentUpload = allowStudentUpload;
    
    post.isEdited = true;

    await post.save();
    console.log('✅ Post updated:', id);

    const pusher = req.app.get('pusher');
    if (pusher) {
      const classroom = await Classroom.findById(post.classroomId);
      if (classroom) {
        classroom.students.forEach(student => {
          pusher.trigger(student.email, 'post-updated', {
            postId: id,
            post
          });
        });
      }
    }

    res.json({ 
      message: 'Post updated successfully',
      post
    });
  } catch (err) {
    console.error('❌ Update post error:', err);
    res.status(500).json({ message: 'Server error updating post' });
  }
});

// Soft Delete Post (Teacher)
router.delete('/:id', async (req, res) => {
  console.log('🗑️ Delete Post Request (Soft Delete)');
  
  try {
    const { id } = req.params;
    const { deletedBy } = req.body;
    
    // Find post
    const post = await Post.findById(id);
    
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    post.isDeleted = true;
    post.deletedBy = deletedBy || 'Teacher';

    await post.save();
    console.log('✅ Post soft deleted:', id);

    const pusher = req.app.get('pusher');
    if (pusher) {
      const classroom = await Classroom.findById(post.classroomId);
      if (classroom) {
        classroom.students.forEach(student => {
          pusher.trigger(student.email, 'post-deleted', {
            postId: id,
            deletedBy: post.deletedBy
          });
        });
      }
    }

    res.json({ 
      message: 'Post deleted successfully',
      post
    });
  } catch (err) {
    console.error('❌ Delete post error:', err);
    res.status(500).json({ message: 'Server error deleting post' });
  }
});

module.exports = router;
