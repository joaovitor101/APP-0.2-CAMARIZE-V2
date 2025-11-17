#!/usr/bin/env node

import mongoose from "mongoose/index.js";
import dotenv from "dotenv";
import readline from 'readline';
// Evitar usar Models do Mongoose aqui para não conflitar instâncias.
// Vamos usar a conexão nativa (db.collection(...)) para buscar e inserir.

// Carrega as variáveis de ambiente
dotenv.config({ path: './api/.env' });

const mongoUrl = process.env.MONGO_URL || "mongodb://localhost:27017/camarize";
const inferredDbFromUri = (() => {
  try {
    const tail = mongoUrl.split('/').pop() || '';
    return (tail.split('?')[0] || '').trim() || undefined;
  } catch { return undefined; }
})();
const dbName = 'camarize';

// Interface de leitura do terminal
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Função para fazer perguntas ao usuário
function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function populateSpecificCativeiros() {
  try {
    console.log("🔍 Adicionando parâmetros manualmente...");
    
    // Configurar timeout maior para conexão
    mongoose.set('bufferCommands', false);
    console.log(`🌐 Conectando em: ${mongoUrl} | dbName: ${dbName}`);
    mongoose.connection.on('connected', () => console.log('🔌 mongoose connected'));
    mongoose.connection.on('error', (e) => console.error('🔴 mongoose connection error:', e.message));
    mongoose.connection.on('disconnected', () => console.log('🔌 mongoose disconnected'));
    await mongoose.connect(mongoUrl, {
      serverSelectionTimeoutMS: 30000, // 30 segundos
      socketTimeoutMS: 45000, // 45 segundos
      dbName
    });
    console.log("✅ Conexão com MongoDB estabelecida!");
    try {
      const ping = await mongoose.connection.db.admin().command({ ping: 1 });
      console.log(`🔗 Ping OK (${JSON.stringify(ping)}) | host: ${mongoose.connection.host} | db: ${mongoose.connection.name}`);
    } catch (e) {
      console.error('❌ Ping falhou (verifique MONGO_URL/IP no Atlas ou serviço local):', e.message);
    }
    
    // Aguardar um pouco para garantir que a conexão está estável
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Debug: Listar todas as coleções
    console.log("\n🔍 Verificando coleções disponíveis...");
    const allCollections = await mongoose.connection.db.listCollections().toArray();
    console.log(`📚 Total de coleções: ${allCollections.length}`);
    allCollections.forEach(col => {
      console.log(`   - ${col.name}`);
    });
    
    // Verificar se a coleção cativeiros existe
    const cativeirosCollectionExists = allCollections.some(col => col.name === 'cativeiros');
    console.log(`\n✅ Coleção 'cativeiros' existe? ${cativeirosCollectionExists ? 'SIM' : 'NÃO'}`);
    
    // Contar documentos na coleção sem filtro
    const totalDocs = await mongoose.connection.db.collection('cativeiros').countDocuments({});
    console.log(`📊 Total de documentos na coleção 'cativeiros': ${totalDocs}`);
    
    // Buscar TODOS os documentos sem projeção para debug
    const allDocs = await mongoose.connection.db
      .collection('cativeiros')
      .find({})
      .toArray();
    console.log(`\n🔍 Documentos encontrados (sem filtro): ${allDocs.length}`);
    if (allDocs.length > 0) {
      console.log("📝 Primeiro documento encontrado:");
      console.log(JSON.stringify(allDocs[0], null, 2));
    }
    
    // Buscar cativeiros existentes (consulta leve e com timeout maior) - usando driver nativo
    const t0 = Date.now();
    const cativeiros = await mongoose.connection.db
      .collection('cativeiros')
      .find({}, { projection: { _id: 1, nome: 1, id_tipo_camarao: 1 } })
      .toArray();
    console.log(`\n⏱️ cativeiros.find (com projeção) levou ${Date.now() - t0}ms`);
    console.log(`📋 Encontrados ${cativeiros.length} cativeiros`);
    
    if (cativeiros.length === 0) {
      console.log("\n❌ Nenhum cativeiro encontrado na coleção 'cativeiros'!");
      console.log(`   Mas encontramos ${totalDocs} documentos na coleção.`);
      console.log("   Isso pode indicar um problema com a projeção ou estrutura dos documentos.");
      return;
    }
    
    // Buscar tipos de camarão para mostrar informações (coleção tiposcamaroes)
    const tiposCamarao = await mongoose.connection.db
      .collection('tiposcamaroes')
      .find({})
      .toArray();
    const tiposMap = {};
    tiposCamarao.forEach(tipo => {
      tiposMap[tipo._id.toString()] = tipo.nome;
    });
    
    // Mostrar cativeiros disponíveis
    console.log("\n🏠 Cativeiros disponíveis:");
    cativeiros.forEach((cativeiro, index) => {
      const tipoNome = tiposMap[cativeiro.id_tipo_camarao?.toString()] || 'Tipo não definido';
      console.log(`   ${index + 1}. ${cativeiro.nome} (${tipoNome})`);
    });
    
    // Escolher cativeiro
    const escolhaCativeiro = await question("\n📝 Escolha o número do cativeiro: ");
    const indiceCativeiro = parseInt(escolhaCativeiro) - 1;
    
    if (indiceCativeiro < 0 || indiceCativeiro >= cativeiros.length) {
      console.log("❌ Escolha inválida!");
      return;
    }
    
    const cativeiroEscolhido = cativeiros[indiceCativeiro];
    console.log(`\n✅ Cativeiro selecionado: ${cativeiroEscolhido.nome}`);
    
    // Coletar dados do usuário
    console.log("\n📊 Insira os valores dos parâmetros:");
    
    const temperatura = await question("🌡️ Temperatura (°C): ");
    const ph = await question("🧪 pH: ");
    const amonia = await question("⚗️ Amônia (mg/L): ");
    
    // Validar dados
    const temp = parseFloat(temperatura);
    const phValue = parseFloat(ph);
    const amoniaValue = parseFloat(amonia);
    
    if (isNaN(temp) || isNaN(phValue) || isNaN(amoniaValue)) {
      console.log("❌ Valores inválidos! Use apenas números.");
      return;
    }
    
    // Confirmar dados
    console.log("\n📋 Dados a serem inseridos:");
    console.log(`   Cativeiro: ${cativeiroEscolhido.nome}`);
    console.log(`   Temperatura: ${temp}°C`);
    console.log(`   pH: ${phValue}`);
    console.log(`   Amônia: ${amoniaValue} mg/L`);
    console.log(`   Data/Hora: ${new Date().toLocaleString()}`);
    
    const confirmacao = await question("\n❓ Confirmar inserção? (s/n): ");
    
    if (confirmacao.toLowerCase() !== 's' && confirmacao.toLowerCase() !== 'sim') {
      console.log("❌ Operação cancelada.");
      return;
    }
    
    // Criar registro
    const insertRes = await mongoose.connection.db
      .collection('parametros_atuais')
      .insertOne({
        datahora: new Date(),
        temp_atual: temp,
        ph_atual: phValue,
        amonia_atual: amoniaValue,
        id_cativeiro: cativeiroEscolhido._id
      });
    console.log("\n✅ Parâmetro inserido com sucesso!");
    console.log(`📊 ID do registro: ${insertRes.insertedId}`);
    
    // Mostrar estatísticas
    const totalParametros = await mongoose.connection.db.collection('parametros_atuais').countDocuments();
    const parametrosCativeiro = await mongoose.connection.db.collection('parametros_atuais').countDocuments({ id_cativeiro: cativeiroEscolhido._id });
    
    console.log(`\n📈 Estatísticas:`);
    console.log(`   Total de parâmetros no banco: ${totalParametros}`);
    console.log(`   Parâmetros deste cativeiro: ${parametrosCativeiro}`);
    
    // Perguntar se quer adicionar mais
    const adicionarMais = await question("\n❓ Adicionar mais um registro? (s/n): ");
    
    if (adicionarMais.toLowerCase() === 's' || adicionarMais.toLowerCase() === 'sim') {
      console.log("\n" + "=".repeat(50));
      await populateSpecificCativeiros(); // Recursão para adicionar mais
    } else {
      console.log("\n🎉 Processo finalizado!");
    }
    
  } catch (error) {
    console.error("❌ Erro durante a inserção:", error);
  } finally {
    rl.close();
    await mongoose.disconnect();
    console.log("🔌 Conexão com MongoDB fechada.");
  }
}

populateSpecificCativeiros(); 