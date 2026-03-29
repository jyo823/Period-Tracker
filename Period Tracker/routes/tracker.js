const express = require('express');
const Entry = require('../models/Entry');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// All tracker routes require authentication
router.use(authMiddleware);

// GET /api/tracker/entries - Get all entries for the logged-in user
router.get('/entries', async (req, res) => {
  try {
    const { type, startDate, endDate, limit } = req.query;

    const query = { userId: req.user._id };

    if (type) {
      query.type = type;
    }

    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = startDate;
      if (endDate) query.date.$lte = endDate;
    }

    const maxLimit = Math.min(parseInt(limit) || 200, 500);

    const entries = await Entry.find(query)
      .sort({ createdAt: -1 })
      .limit(maxLimit);

    res.json({
      success: true,
      count: entries.length,
      entries
    });
  } catch (error) {
    console.error('Get entries error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching entries.'
    });
  }
});

// POST /api/tracker/entries - Create a new entry
router.post('/entries', async (req, res) => {
  try {
    const { type, date, flowLevel, symptoms, mood, notes, reminderTime, reminderEnabled } = req.body;

    if (!type || !['log', 'symptom', 'reminder'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Valid entry type is required (log, symptom, or reminder).'
      });
    }

    if ((type === 'log' || type === 'symptom') && !date) {
      return res.status(400).json({
        success: false,
        message: 'Date is required for log and symptom entries.'
      });
    }

    if (type === 'symptom' && (!symptoms || symptoms.length === 0)) {
      return res.status(400).json({
        success: false,
        message: 'At least one symptom is required.'
      });
    }

    const entry = new Entry({
      userId: req.user._id,
      type,
      date: date || '',
      flowLevel: flowLevel || 'none',
      symptoms: symptoms || [],
      mood: mood || '',
      notes: notes || '',
      reminderTime: reminderTime || '',
      reminderEnabled: reminderEnabled || false
    });

    await entry.save();

    res.status(201).json({
      success: true,
      message: 'Entry saved successfully!',
      entry
    });
  } catch (error) {
    console.error('Create entry error:', error);

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({
        success: false,
        message: messages.join(' ')
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error saving entry.'
    });
  }
});

// DELETE /api/tracker/entries/:id - Delete an entry
router.delete('/entries/:id', async (req, res) => {
  try {
    const entry = await Entry.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'Entry not found.'
      });
    }

    res.json({
      success: true,
      message: 'Entry deleted successfully.'
    });
  } catch (error) {
    console.error('Delete entry error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting entry.'
    });
  }
});

// GET /api/tracker/stats - Get summary stats
router.get('/stats', async (req, res) => {
  try {
    const userId = req.user._id;

    // Get period days count
    const periodLogs = await Entry.find({
      userId,
      type: 'log',
      flowLevel: { $ne: 'none', $ne: '' }
    }).select('date flowLevel');

    const periodDates = new Set(
      periodLogs
        .filter(l => l.flowLevel && l.flowLevel !== 'none')
        .map(l => l.date)
    );

    // Get today's data
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const todayLogs = await Entry.find({
      userId,
      type: 'log',
      date: todayStr
    }).sort({ createdAt: -1 }).limit(1);

    const todayMood = todayLogs.length > 0 && todayLogs[0].mood ? todayLogs[0].mood : '--';

    // Calculate cycle day
    let cycleDay = '--';
    if (periodDates.size > 0) {
      const sortedDates = Array.from(periodDates).sort((a, b) => new Date(b) - new Date(a));
      const lastPeriod = new Date(sortedDates[0]);
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      lastPeriod.setHours(0, 0, 0, 0);
      const diffTime = now - lastPeriod;
      const diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1);
      cycleDay = diffDays;
    }

    // Check reminder
    const reminder = await Entry.findOne({
      userId,
      type: 'reminder',
      reminderEnabled: true
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      stats: {
        cycleDay,
        periodDays: periodDates.size,
        todayMood,
        reminderStatus: reminder ? 'On' : 'Off',
        reminderTime: reminder ? reminder.reminderTime : ''
      }
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching stats.'
    });
  }
});

module.exports = router;