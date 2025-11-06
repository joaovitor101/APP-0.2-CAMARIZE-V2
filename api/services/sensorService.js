import Sensores from "../models/Sensores.js";

class sensorService {
  async getAll() {
    try {
      return await Sensores.find().populate('id_tipo_sensor');
    } catch (error) {
      console.log(error);
      return [];
    }
  }

  async getAllByUser(userId) {
    try {
      return await Sensores.find({ user: userId }).populate('id_tipo_sensor');
    } catch (error) {
      console.log(error);
      return [];
    }
  }

  async getById(id) {
    try {
      return await Sensores.findById(id).populate('id_tipo_sensor');
    } catch (error) {
      console.log(error);
      return null;
    }
  }

  async getByIdAndUser(id, userId) {
    try {
      return await Sensores.findOne({ _id: id, user: userId }).populate('id_tipo_sensor');
    } catch (error) {
      console.log(error);
      return null;
    }
  }

  async create(data) {
    try {
      // Se id_tipo_sensor vier como string, buscar ou criar o tipo
      if (typeof data.id_tipo_sensor === 'string') {
        const TiposSensor = (await import('../models/Tipos_sensores.js')).default;
        const descricao = data.id_tipo_sensor.trim();
        let tipo = await TiposSensor.findOne({ descricao });
        if (!tipo) {
          tipo = await TiposSensor.create({ descricao });
        }
        data.id_tipo_sensor = tipo._id;
      }
      
      const novo = new Sensores(data);
      return await novo.save();
    } catch (error) {
      console.log("Erro ao salvar sensor:", error);
      return null;
    }
  }

  async update(id, data) {
    try {
      return await Sensores.findByIdAndUpdate(id, data, { new: true });
    } catch (error) {
      console.log("Erro ao atualizar sensor:", error);
      return null;
    }
  }

  async updateByUser(id, userId, data) {
    try {
      return await Sensores.findOneAndUpdate(
        { _id: id, user: userId }, 
        data, 
        { new: true }
      );
    } catch (error) {
      console.log("Erro ao atualizar sensor:", error);
      return null;
    }
  }

  async delete(id) {
    try {
      return await Sensores.findByIdAndDelete(id);
    } catch (error) {
      console.log("Erro ao deletar sensor:", error);
      return null;
    }
  }

  async deleteByUser(id, userId) {
    try {
      return await Sensores.findOneAndDelete({ _id: id, user: userId });
    } catch (error) {
      console.log("Erro ao deletar sensor:", error);
      return null;
    }
  }
}

export default new sensorService(); 