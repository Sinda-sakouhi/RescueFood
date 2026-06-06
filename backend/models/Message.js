const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true
    },
    expediteur: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    contenu: {
      type: String,
      required: true,
      trim: true,
      maxlength: 4000
    },
    luPar: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    ],
    dateLecture: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

messageSchema.index({ conversation: 1, createdAt: 1 });
messageSchema.index({ expediteur: 1, createdAt: -1 });

module.exports = mongoose.model('Message', messageSchema);
