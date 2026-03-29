const express = require('express');
const router = express.Router();
const Exam = require('../model/Exam');
const ExamSubmission = require('../model/ExamSubmission');
const Classroom = require('../model/Classroom');
const User = require('../model/User');
const multer = require('multer');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Groq = require('groq-sdk');

// Multer Memory Storage for serverless
const storage = multer.memoryStorage();
const upload = multer({ storage });


// Create a new exam
router.post('/create', async (req, res) => {
  try {
    const { classroomId, teacherName, examName, subject, questions, examType } = req.body;

    const newExam = new Exam({
      classroomId,
      teacherName,
      examName,
      subject,
      questions,
      examType: examType || "manual"
    });

    await newExam.save();

    const pusher = req.app.get('pusher');
    if (pusher) {
      pusher.trigger('exams', 'new-exam', { classroomId, examName });
    }

    res.status(201).json({ success: true, message: 'Exam created successfully', exam: newExam });
  } catch (error) {
    console.error('Error creating exam:', error);
    res.status(500).json({ success: false, message: 'Failed to create exam' });
  }
});

// Generate Exam with AI
router.post('/generate-ai', upload.single('material'), async (req, res) => {
  try {
    const { numQuestions, difficulty, topic } = req.body;
    let combinedContent = "";

    // Extract text from uploaded file if exists
    if (req.file) {
      if (req.file.mimetype === 'application/pdf') {
        const data = await pdfParse(req.file.buffer);
        combinedContent += data.text;
      } else if (req.file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const result = await mammoth.extractRawText({ buffer: req.file.buffer });
        combinedContent += result.value;
      } else if (req.file.mimetype.startsWith('text/')) {
        combinedContent += req.file.buffer.toString('utf8');
      }
    } else if (topic) {
        combinedContent = topic;
    } else {
        return res.status(400).json({ success: false, message: 'No material or topic provided for generation.' });
    }

    const questionCount = parseInt(numQuestions) || 5;
    const diff = difficulty || "medium";

    const prompt = `You are an expert educator. Generate a multiple-choice exam based strictly on the following material.
Number of questions: ${questionCount}
Difficulty: ${diff}

Material:
"""
${combinedContent.substring(0, 30000)} // Limit context to avoid token issues
"""

Output the result ONLY as a valid JSON array of objects, with no markdown formatting around it (no \`\`\`json).
Each object must have the following structure:
{
  "questionText": "The actual question?",
  "options": {
    "a": "First option",
    "b": "Second option",
    "c": "Third option",
    "d": "Fourth option"
  },
  "correctAnswer": "a" // must be one of "a", "b", "c", "d"
}

IMPORTANT: You MUST randomly distribute the correct answers across "a", "b", "c", and "d" so that every option is used as a correct answer roughly an equal number of times. Do NOT favor "b" or "c".`;

    let generatedText = "";

    // Try Gemini first if key exists, else Groq
    if (process.env.GEMINI_API_KEY) {
      console.log('Using Gemini for exam generation...');
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent(prompt);
      generatedText = result.response.text();
    } else if (process.env.GROQ_API_KEY) {
      console.log('Using Groq for exam generation...');
      const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
      const chatCompletion = await groq.chat.completions.create({
          messages: [{ role: 'user', content: prompt }],
          model: "openai/gpt-oss-120b"
      });
      generatedText = chatCompletion.choices[0]?.message?.content || "";
    } else {
      throw new Error("No AI API keys configured (GEMINI_API_KEY or GROQ_API_KEY).");
    }

    // Clean up response if it contains markdown code blocks
    let cleanJSON = generatedText.replace(/```json/gi, '').replace(/```/g, '').trim();
    
    // Parse the JSON
    let questions;
    try {
      questions = JSON.parse(cleanJSON);
    } catch (parseError) {
      console.error("Failed to parse AI response:", cleanJSON);
      throw new Error("AI returned invalid JSON format.");
    }

    // Validate structure
    if (!Array.isArray(questions) || questions.length === 0) {
        throw new Error("AI did not return an array of questions.");
    }

    // NEW robust shuffle to prevent AI patterns (A, B, C, D...)
    const shuffledQuestions = questions.map((q, qIdx) => {
      const correctText = q.options[q.correctAnswer];
      const allOptionTexts = Object.values(q.options);

      // Perform shuffle using Fisher-Yates
      for (let i = allOptionTexts.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allOptionTexts[i], allOptionTexts[j]] = [allOptionTexts[j], allOptionTexts[i]];
      }

      // Map back to keys a, b, c, d
      const keys = ['a', 'b', 'c', 'd'];
      const newOptions = {};
      let newCorrectAnswer = 'a';

      keys.forEach((key, index) => {
        newOptions[key] = allOptionTexts[index];
        if (allOptionTexts[index] === correctText) {
          newCorrectAnswer = key;
        }
      });

      console.log(`[SHUFFLE] Q${qIdx+1} Correct Answer text was at "${q.correctAnswer}", now at "${newCorrectAnswer}"`);
      return {
        ...q,
        options: newOptions,
        correctAnswer: newCorrectAnswer
      };
    });

    res.status(200).json({ success: true, questions: shuffledQuestions });
  } catch (error) {
    console.error('Error generating AI exam:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to generate exam using AI' });
  }
});

// Get all exams for a classroom
router.get('/classroom/:classroomId', async (req, res) => {
  try {
    const exams = await Exam.find({ classroomId: req.params.classroomId }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, exams });
  } catch (error) {
    console.error('Error fetching exams:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch exams' });
  }
});

// Get a single exam by ID
router.get('/:examId', async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.examId);
    if (!exam) return res.status(404).json({ success: false, message: 'Exam not found' });
    res.status(200).json({ success: true, exam });
  } catch (error) {
    console.error('Error fetching exam:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch exam details' });
  }
});


// Delete an exam
router.delete('/:examId', async (req, res) => {
  try {
    const examId = req.params.examId;
    
    // Delete the exam
    await Exam.findByIdAndDelete(examId);
    
    // Also delete all submissions for this exam
    await ExamSubmission.deleteMany({ examId: examId });

    // Optional: emit socket event if needed for realtime updates
    // const io = req.app.get('socketio');
    // io.emit('exam-deleted', { examId: examId, message: "The exam has been deleted by teacher" });

    res.status(200).json({ success: true, message: 'Exam deleted successfully' });
  } catch (error) {
    console.error('Error deleting exam:', error);
    res.status(500).json({ success: false, message: 'Failed to delete exam' });
  }
});

// Get submissions for a specific exam
router.get('/:examId/submissions', async (req, res) => {
  try {
    const submissions = await ExamSubmission.find({ examId: req.params.examId }).sort({ submittedAt: -1 });
    res.status(200).json({ success: true, submissions });
  } catch (error) {
    console.error('Error fetching submissions:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch submissions' });
  }
});

// Submit an exam (for student side, though we only implement teacher side now, this is useful for future or full picture)
router.post('/submit', async (req, res) => {
  try {
    const { examId, studentId, studentName, rollNumber, answers } = req.body;
    
    const exam = await Exam.findById(examId);
    if (!exam) return res.status(404).json({ success: false, message: 'Exam not found' });

    let correctCount = 0;
    let wrongCount = 0;
    
    const processedAnswers = answers.map(ans => {
      const question = exam.questions.id(ans.questionId);
      const isCorrect = question.correctAnswer === ans.selectedOption;
      if (isCorrect) correctCount++;
      else wrongCount++;
      
      return {
        questionId: ans.questionId,
        selectedOption: ans.selectedOption,
        isCorrect
      };
    });

    const newSubmission = new ExamSubmission({
      examId,
      examName: exam.examName,
      subject: exam.subject,
      studentId,
      studentName,
      rollNumber,
      totalQuestions: exam.questions.length,
      correctCount,
      wrongCount,
      answers: processedAnswers
    });

    await newSubmission.save();
    res.status(201).json({ success: true, message: 'Exam submitted successfully', submission: newSubmission });
  } catch (error) {
    console.error('Error submitting exam:', error);
    res.status(500).json({ success: false, message: 'Failed to submit exam' });
  }
});

// Get submissions for a specific student
router.get('/student-submissions/:studentEmail', async (req, res) => {
  try {
    const submissions = await ExamSubmission.find({ studentId: req.params.studentEmail })
      .populate('examId', 'examName subject')
      .sort({ submittedAt: -1 });
    res.status(200).json({ success: true, submissions });
  } catch (error) {
    console.error('Error fetching student submissions:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch student submissions' });
  }
});

module.exports = router;
