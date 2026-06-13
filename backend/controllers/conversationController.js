const mongoose = require('mongoose');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Annonce = require('../models/Annonce');

// POST /api/conversations — créer une conversation
async function createConversation(request, response, next) {
  try {
    const { annonceId, destinataireId } = request.body;

    if (!mongoose.isValidObjectId(annonceId) ||
        !mongoose.isValidObjectId(destinataireId)) {
      return response.status(400).json({ message: 'Identifiant invalide' });
    }

    const annonce = await Annonce.findById(annonceId);
    if (!annonce) {
      return response.status(404).json({ message: 'Annonce introuvable' });
    }

    // Vérifier si une conversation existe déjà
    const existante = await Conversation.findOne({
      annonce: annonceId,
      participants: {
        $all: [request.user._id, destinataireId]
      }
    });

    if (existante) {
      return response.json({
        message: 'Conversation déjà existante',
        conversation: existante
      });
    }

    const conversation = await Conversation.create({
      participants: [request.user._id, destinataireId],
      annonce: annonceId,
      statut: 'ACTIVE'
    });

    return response.status(201).json({
      message: 'Conversation créée',
      conversation
    });
  } catch (error) {
    return next(error);
  }
}

// GET /api/conversations — mes conversations
async function mesConversations(request, response, next) {
  try {
    const conversations = await Conversation.find({
      participants: request.user._id,
      statut: 'ACTIVE'
    })
      .populate('participants', 'nom prenom role avatarUrl')
      .populate('annonce', 'titre type statut')
      .sort({ dernierMessageAt: -1 });

    return response.json({ conversations });
  } catch (error) {
    return next(error);
  }
}

// POST /api/conversations/:id/messages — envoyer un message
async function envoyerMessage(request, response, next) {
  try {
    if (!mongoose.isValidObjectId(request.params.id)) {
      return response.status(400).json({ message: 'Identifiant invalide' });
    }

    const conversation = await Conversation.findById(request.params.id);

    if (!conversation) {
      return response.status(404).json({
        message: 'Conversation introuvable'
      });
    }

    // Vérifier que l'utilisateur est participant
    const estParticipant = conversation.participants.some((p) =>
      p.equals(request.user._id)
    );

    if (!estParticipant) {
      return response.status(403).json({
        message: 'Vous ne participez pas à cette conversation'
      });
    }

    const { contenu } = request.body;

    if (!contenu || contenu.trim().length === 0) {
      return response.status(400).json({
        message: 'Le message ne peut pas être vide'
      });
    }

    const message = await Message.create({
      conversation: conversation._id,
      expediteur: request.user._id,
      contenu: contenu.trim(),
      luPar: [request.user._id]
    });

    // Mettre à jour la date du dernier message
    conversation.dernierMessageAt = new Date();
    await conversation.save();

    return response.status(201).json({
      message: 'Message envoyé',
      data: message
    });
  } catch (error) {
    return next(error);
  }
}

// GET /api/conversations/:id/messages — voir les messages
async function getMessages(request, response, next) {
  try {
    if (!mongoose.isValidObjectId(request.params.id)) {
      return response.status(400).json({ message: 'Identifiant invalide' });
    }

    const conversation = await Conversation.findById(request.params.id);

    if (!conversation) {
      return response.status(404).json({
        message: 'Conversation introuvable'
      });
    }

    // Vérifier que l'utilisateur est participant
    const estParticipant = conversation.participants.some((p) =>
      p.equals(request.user._id)
    );

    if (!estParticipant) {
      return response.status(403).json({
        message: 'Vous ne participez pas à cette conversation'
      });
    }

    const messages = await Message.find({
      conversation: request.params.id
    })
      .populate('expediteur', 'nom prenom avatarUrl')
      .sort({ createdAt: 1 });

    // Marquer les messages non lus comme lus
    await Message.updateMany(
      {
        conversation: request.params.id,
        luPar: { $ne: request.user._id }
      },
      { $addToSet: { luPar: request.user._id } }
    );

    return response.json({ messages });
  } catch (error) {
    return next(error);
  }
}

// PATCH /api/messages/:id/lu — marquer un message comme lu
async function marquerLu(request, response, next) {
  try {
    if (!mongoose.isValidObjectId(request.params.id)) {
      return response.status(400).json({ message: 'Identifiant invalide' });
    }

    const message = await Message.findById(request.params.id);

    if (!message) {
      return response.status(404).json({ message: 'Message introuvable' });
    }

    await Message.findByIdAndUpdate(request.params.id, {
      $addToSet: { luPar: request.user._id }
    });

    return response.json({ message: 'Message marqué comme lu' });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createConversation,
  mesConversations,
  envoyerMessage,
  getMessages,
  marquerLu
};