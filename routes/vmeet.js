const express = require('express');
const router = express.Router();
const Classroom = require('../model/Classroom');

// Get Vmeet Info (Room Title & Existence)
router.get('/info/:roomId', async (req, res) => {
    try {
        const { roomId } = req.params;
        
        // Find if this is a valid classroom code
        const classroom = await Classroom.findOne({ code: roomId });
        
        if (classroom) {
            return res.json({ 
                exists: true, 
                title: `${classroom.subject} - ${classroom.teacherName}'s Class` 
            });
        }
        
        // If not a classroom, it might be a custom room ID
        // In the original logic, any room ID was valid to create
        res.json({ 
            exists: false, 
            title: 'Custom Meeting' 
        });
    } catch (err) {
        console.error('Vmeet Info Error:', err);
        res.status(500).json({ message: 'Server error fetching room info' });
    }
});

module.exports = router;
