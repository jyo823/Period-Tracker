const mongoose = require('mongoose');

const entrySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    required: true,
    enum: ['log', 'symptom', 'reminder']
  },
  date: {
    type: String,
    required: function() {
      return this.type !== 'reminder';
    }
  },
  flowLevel: {
    type: String,
    enum: ['none', 'spotting', 'light', 'medium', 'heavy', ''],
    default: 'none'
  },
  symptoms: {
    type: [String],
    default: []
  },
  mood: {
    type: String,
    default: ''
  },
  notes: {
    type: String,
    default: '',
    maxlength: 1000
  },
  reminderTime: {
    type: String,
    default: ''
  },
  reminderEnabled: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Compound index for efficient queries
entrySchema.index({ userId: 1, date: 1, type: 1 });
entrySchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Entry', entrySchema);