const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema(
  {
    participants: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        }
      ],
      required: true,
      validate: {
        validator(participants) {
          return (
            participants.length === 2 &&
            new Set(participants.map(String)).size === 2
          );
        },
        message: 'Une conversation doit avoir deux participants différents'
      }
    },
    annonce: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Annonce',
      required: true
    },
    matching: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Matching',
      default: null
    },
    statut: {
      type: String,
      enum: ['ACTIVE', 'ARCHIVEE'],
      default: 'ACTIVE'
    },
    dernierMessageAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

conversationSchema.pre('validate', function normalizeParticipants() {
  if (this.participants?.length) {
    this.participants.sort((a, b) => String(a).localeCompare(String(b)));
  }
});

conversationSchema.index({ participants: 1, statut: 1 });
conversationSchema.index({ annonce: 1, createdAt: -1 });
conversationSchema.index({ matching: 1 }, { sparse: true });

module.exports = mongoose.model('Conversation', conversationSchema);
