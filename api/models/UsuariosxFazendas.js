import mongoose from "mongoose";

const UsuariosxFazendasSchema = new mongoose.Schema({
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  fazenda: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Fazendas",
    required: true
  },
  ativo: {
    type: Boolean,
    default: true,
    required: true
  }
});

const UsuariosxFazendas = mongoose.model("UsuariosxFazendas", UsuariosxFazendasSchema);
export default UsuariosxFazendas; 