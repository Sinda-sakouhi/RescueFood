const express = require('express');
const {
  createConversation,
  mesConversations,
  envoyerMessage,
  getMessages,
  marquerLu
} = require('../controllers/conversationController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticate, mesConversations);
router.post('/', authenticate, createConversation);
router.get('/:id/messages', authenticate, getMessages);
router.post('/:id/messages', authenticate, envoyerMessage);
router.patch('/messages/:id/lu', authenticate, marquerLu);

module.exports = router;