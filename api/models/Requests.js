import mongoose from "mongoose";

const requestSchema = new mongoose.Schema({
  requesterUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false }, // Permite null para cadastros de proprietário
  requesterRole: { type: String, enum: ['membro', 'admin'], required: true },
  targetRole: { type: String, enum: ['admin', 'master'], required: true },
  type: { type: String, enum: ['leve', 'pesada'], required: true },
  action: { type: String, required: true },
  payload: { type: Object, required: true },
  status: { type: String, enum: ['pendente', 'aprovado', 'recusado'], default: 'pendente', required: true },
  approverUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  fazenda: { type: mongoose.Schema.Types.ObjectId, ref: 'Fazendas' },
}, { timestamps: true });

const Request = mongoose.model('Request', requestSchema);

export default Request;

