import express from 'express';
import Auth from '../middleware/Auth.js';
import chatController from '../controllers/chatController.js';

const router = express.Router();

router.post('/conversations', Auth.Authorization, chatController.upsertConversation);
router.get('/conversations/mine', Auth.Authorization, chatController.listMyConversations);
router.get('/conversations/:id/messages', Auth.Authorization, chatController.getMessages);
router.post('/conversations/:id/messages', Auth.Authorization, chatController.sendMessage);
router.post('/conversations/:id/read', Auth.Authorization, chatController.markRead);
router.delete('/conversations/:id', Auth.Authorization, chatController.deleteConversation);

export default router;


