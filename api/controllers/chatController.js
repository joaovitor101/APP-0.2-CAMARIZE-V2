import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';

function ensureAdminOrMaster(user) {
  const role = user?.role;
  if (role !== 'admin' && role !== 'master') {
    const err = new Error('Acesso restrito');
    err.status = 403;
    throw err;
  }
}

export async function upsertConversation(req, res) {
  try {
    ensureAdminOrMaster(req.loggedUser);
    const { adminId, masterId } = req.body;
    if (!adminId || !masterId) return res.status(400).json({ error: 'adminId e masterId são obrigatórios' });
    const participants = [adminId, masterId];
    let conv = await Conversation.findOne({ participants: { $all: participants, $size: 2 } });
    if (!conv) conv = await Conversation.create({ participants, unreadCounts: {} });
    return res.json(conv);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
}

export async function listMyConversations(req, res) {
  try {
    ensureAdminOrMaster(req.loggedUser);
    const userId = req.loggedUser.id;
    const conversations = await Conversation.find({ participants: userId }).sort({ lastMessageAt: -1 });
    res.json(conversations);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
}

export async function getMessages(req, res) {
  try {
    ensureAdminOrMaster(req.loggedUser);
    const { id } = req.params;
    const { after } = req.query;
    const query = { conversationId: id };
    if (after) query.createdAt = { $gt: new Date(after) };
    const messages = await Message.find(query).sort({ createdAt: 1 }).limit(200);
    res.json(messages);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
}

export async function sendMessage(req, res) {
  try {
    ensureAdminOrMaster(req.loggedUser);
    const { id } = req.params; // conversationId
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'Texto obrigatório' });
    const msg = await Message.create({ conversationId: id, senderId: req.loggedUser.id, text: text.trim() });
    await Conversation.findByIdAndUpdate(id, { $set: { lastMessageAt: new Date() } });
    res.status(201).json(msg);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
}

export async function markRead(req, res) {
  try {
    ensureAdminOrMaster(req.loggedUser);
    const { id } = req.params; // conversationId
    // Para MVP: apenas retorno 200; leitura por usuário pode ser aprimorada depois
    res.json({ ok: true });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
}

export async function deleteConversation(req, res) {
  try {
    ensureAdminOrMaster(req.loggedUser);
    if (req.loggedUser.role !== 'master') {
      const err = new Error('Somente o Master pode apagar conversas');
      err.status = 403;
      throw err;
    }
    const { id } = req.params; // conversationId
    const conv = await Conversation.findById(id);
    if (!conv) return res.status(404).json({ error: 'Conversa não encontrada' });
    const isParticipant = (conv.participants || []).some(p => String(p) === String(req.loggedUser.id));
    if (!isParticipant) {
      const err = new Error('Acesso negado a esta conversa');
      err.status = 403;
      throw err;
    }
    const delMsgs = await Message.deleteMany({ conversationId: id });
    await Conversation.findByIdAndDelete(id);
    res.json({ ok: true, deletedMessages: delMsgs?.deletedCount || 0, conversationId: id });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
}

export default { upsertConversation, listMyConversations, getMessages, sendMessage, markRead, deleteConversation };


