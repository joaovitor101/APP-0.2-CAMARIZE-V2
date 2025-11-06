import { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import Modal from '../../components/Modal';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useAuth } from '@/hooks/useAuth';

const CreatableSelect = dynamic(() => import('react-select/creatable'), { ssr: false });

export default function AdminPanel() {
  const { isAuthenticated, loading: authLoading, user } = useAuth();
  const [initialTabApplied, setInitialTabApplied] = useState(false);
  const [items, setItems] = useState([]);
  const [allRequests, setAllRequests] = useState([]);
  const [filteredRequests, setFilteredRequests] = useState([]);
  const [cativeiros, setCativeiros] = useState([]);
  const [fazendas, setFazendas] = useState([]);
  const [users, setUsers] = useState([]);
  const [tiposCamarao, setTiposCamarao] = useState([]);
  const [condicoesIdeais, setCondicoesIdeais] = useState([]);
  const [sensores, setSensores] = useState([]); // mantemos carregado para futuras funcionalidades
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showNewTipoModal, setShowNewTipoModal] = useState(false);
  const [newTipoNome, setNewTipoNome] = useState('');
  const [swapForm, setSwapForm] = useState({ cativeiroId: '', temperatura: false, ph: false, amonia: false });
  const [linkForm, setLinkForm] = useState({ cativeiroId: '', temperatura: false, ph: false, amonia: false, allowed: { temperatura: true, ph: true, amonia: true } });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('cativeiros'); // requests | solicitacoes | cativeiros
  const [requesterFilter, setRequesterFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  // Chat state
  const [chatConversations, setChatConversations] = useState([]);
  const [chatSelectedId, setChatSelectedId] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [chatText, setChatText] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  const getMyId = () => {
    const fromUser = user?.id || user?._id;
    const stored = (typeof window !== 'undefined') ? (JSON.parse(sessionStorage.getItem('usuarioCamarize') || localStorage.getItem('usuarioCamarize') || '{}')) : {};
    const fromStorage = stored?.id || stored?._id;
    return String(fromUser || fromStorage || '');
  };

  const getDisplayName = (senderId) => {
    const me = getMyId();
    if (String(senderId) === String(me)) return 'Você (Admin)';
    const u = (users || []).find(x => String(x.id || x._id) === String(senderId));
    // users aqui contém masters; default para Master
    return u?.nome || u?.email || 'Master';
  };

  const getConversationTitle = (conv) => {
    const me = getMyId();
    const otherId = (Array.isArray(conv?.participants) ? conv.participants : []).find(p => String(p) !== String(me));
    const u = (users || []).find(x => String(x.id || x._id) === String(otherId));
    return u?.nome || u?.email || 'Master';
  };
  const [expandedFazenda, setExpandedFazenda] = useState({}); // id -> bool
  const [expandedCativeiro, setExpandedCativeiro] = useState({}); // id -> bool
  const [showCreateModal, setShowCreateModal] = useState(false);
  // Dietas por cativeiro (cache simples)
  const [cativeiroDieta, setCativeiroDieta] = useState({}); // id -> { descricao }
  const [newDietaForm, setNewDietaForm] = useState({ descricao: '', quantidade: '' });
  const isMaster = (user?.role || (typeof window !== 'undefined' ? (JSON.parse(sessionStorage.getItem('usuarioCamarize') || localStorage.getItem('usuarioCamarize') || '{}')?.role) : '')) === 'master';
  const [newCativeiro, setNewCativeiro] = useState({
    fazendaId: '',
    nome: '',
    id_tipo_camarao: '',
    data_instalacao: '',
    temp_media_diaria: '',
    ph_medio_diario: '',
    amonia_media_diaria: ''
  });

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  const getToken = () => (typeof window !== 'undefined' ? (sessionStorage.getItem('token') || localStorage.getItem('token')) : null);

  // Deriva o tipo do sensor a partir de múltiplas fontes
  const getSensorType = (sensor) => {
    // 1) Se o sensor vier populado com id_tipo_sensor como objeto, usar descricao/nome
    try {
      if (!sensor) return '';
      if (typeof sensor.id_tipo_sensor === 'object' && sensor.id_tipo_sensor) {
        const desc = sensor.id_tipo_sensor.descricao || sensor.id_tipo_sensor.nome;
        if (desc) return String(desc).toLowerCase();
      }
      // 2) direto do campo (string) ou campo alternativo 'tipo'
      const directField = sensor.id_tipo_sensor || sensor.tipo;
      if (typeof directField === 'string' && directField.trim()) return directField.toLowerCase();

      // 3) lookup pelo id (quando `sensor` é id ou objeto com _id)
      const sid = typeof sensor === 'string' ? sensor : (sensor?._id || sensor?.id);
      if (sid) {
        const full = (sensores || []).find(x => String(x._id) === String(sid));
        if (full) {
          if (typeof full.id_tipo_sensor === 'object' && full.id_tipo_sensor) {
            const d = full.id_tipo_sensor.descricao || full.id_tipo_sensor.nome;
            if (d) return String(d).toLowerCase();
          }
          if (typeof full.id_tipo_sensor === 'string' && full.id_tipo_sensor.trim()) return full.id_tipo_sensor.toLowerCase();
          const alias = String(full?.apelido || '').toLowerCase();
          if (alias.includes('temp')) return 'temperatura';
          if (alias.includes('ph')) return 'ph';
          if (alias.includes('amonia') || alias.includes('nh3')) return 'amonia';
        }
      }

      // 4) heurística pelo próprio apelido no objeto parcial
      const aliasLocal = String(sensor && sensor.apelido || '').toLowerCase();
      if (aliasLocal.includes('temp')) return 'temperatura';
      if (aliasLocal.includes('ph')) return 'ph';
      if (aliasLocal.includes('amonia') || aliasLocal.includes('nh3')) return 'amonia';
    } catch (e) {
      // se algo falhar, devolve string vazia para evitar mostrar [object Object]
      return '';
    }
    return '';
  };

  const load = async () => {
    try {
      setLoading(true);
      const token = getToken();
      const headers = { Authorization: `Bearer ${token}` };
      const [reqs, fzs, cats, tipos, condicoes, sens, us] = await Promise.all([
        axios.get(`${apiUrl}/requests`, { headers }),
        axios.get(`${apiUrl}/fazendas`, { headers }),
        axios.get(`${apiUrl}/cativeiros`, { headers }),
        axios.get(`${apiUrl}/camaroes`, { headers }),
        axios.get(`${apiUrl}/condicoes-ideais`, { headers }),
        axios.get(`${apiUrl}/sensores`, { headers }),
        axios.get(`${apiUrl}/users/masters/all`, { headers }).catch(() => ({ data: [] })),
      ]);
      setItems(reqs.data);
      setFazendas(fzs.data);
      setCativeiros(cats.data);
      setTiposCamarao(tipos.data);
      setCondicoesIdeais(condicoes.data);
      setSensores(sens.data);
      setUsers(us.data || []);
    } catch (e) {
      setError('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const loadAllRequests = async () => {
    try {
      const token = getToken();
      const headers = { Authorization: `Bearer ${token}` };
      const response = await axios.get(`${apiUrl}/requests/all-admin`, { headers });
      return response.data;
    } catch (e) {
      console.error('Erro ao carregar requests dos funcionários:', e);
      return [];
    }
  };

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      load();
    }
  }, [authLoading, isAuthenticated]);

  // Respeitar query ?tab=... para abrir diretamente a aba correspondente
  useEffect(() => {
    if (typeof window === 'undefined' || initialTabApplied) return;
    try {
      const params = new URLSearchParams(window.location.search);
      const qTab = params.get('tab');
      if (qTab && ['requests', 'solicitacoes', 'cativeiros'].includes(qTab)) {
        setTab(qTab);
      }
      setInitialTabApplied(true);
    } catch {}
  }, [initialTabApplied]);

  useEffect(() => {
    if (tab === 'requests' && isAuthenticated) {
      loadAllRequests().then(setAllRequests);
    }
  }, [tab, isAuthenticated]);

  // Chat polling
  useEffect(() => {
    let timer;
    async function tick() {
      try {
        if (tab !== 'chat') return;
        const token = getToken();
        const headers = { Authorization: `Bearer ${token}` };
        const convs = await axios.get(`${apiUrl}/chat/conversations/mine`, { headers });
        setChatConversations(convs.data || []);
        if (chatSelectedId) {
          const msgs = await axios.get(`${apiUrl}/chat/conversations/${chatSelectedId}/messages`, { headers });
          setChatMessages(msgs.data || []);
        }
      } catch {}
    }
    if (tab === 'chat') {
      tick();
      timer = setInterval(tick, 5000);
    }
    return () => { if (timer) clearInterval(timer); };
  }, [tab, chatSelectedId]);

  const openConversation = async (convId) => {
    try {
      setChatSelectedId(convId);
      setChatLoading(true);
      const token = getToken();
      const headers = { Authorization: `Bearer ${token}` };
      const msgs = await axios.get(`${apiUrl}/chat/conversations/${convId}/messages`, { headers });
      setChatMessages(msgs.data || []);
    } catch {} finally {
      setChatLoading(false);
    }
  };

  const startConversationWithMaster = async (masterId) => {
    try {
      const token = getToken();
      const headers = { Authorization: `Bearer ${token}` };
      let me = (user?.id) || (JSON.parse(sessionStorage.getItem('usuarioCamarize') || localStorage.getItem('usuarioCamarize') || '{}')?.id);
      if (!me) {
        const meRes = await axios.get(`${apiUrl}/users/me`, { headers });
        me = meRes.data?._id || meRes.data?.id;
      }
      if (!me || !masterId) throw new Error('IDs inválidos');
      const res = await axios.post(`${apiUrl}/chat/conversations`, { adminId: me, masterId }, { headers });
      await loadConversationsOnce();
      setTab('chat');
      if (res?.data?._id) openConversation(res.data._id);
    } catch (e) {
      const msg = e?.response?.data?.error || e.message || 'Falha desconhecida';
      alert('Não foi possível iniciar a conversa: ' + msg);
    }
  };

  const loadConversationsOnce = async () => {
    try {
      const token = getToken();
      const headers = { Authorization: `Bearer ${token}` };
      const convs = await axios.get(`${apiUrl}/chat/conversations/mine`, { headers });
      setChatConversations(convs.data || []);
    } catch {}
  };

  const sendChatMessage = async () => {
    try {
      if (!chatSelectedId || !chatText.trim()) return;
      const token = getToken();
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.post(`${apiUrl}/chat/conversations/${chatSelectedId}/messages`, { text: chatText }, { headers });
      setChatMessages(prev => [...prev, res.data]);
      setChatText('');
    } catch {}
  };

  // Auto-scroll para última mensagem
  useEffect(() => {
    try { chatEndRef.current && chatEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' }); } catch {}
  }, [chatMessages.length, chatSelectedId]);

  useEffect(() => {
    let filtered = [...allRequests];
    if (requesterFilter) {
      filtered = filtered.filter(item =>
        item.requesterUser?.nome?.toLowerCase().includes(requesterFilter.toLowerCase()) ||
        item.requesterUser?.email?.toLowerCase().includes(requesterFilter.toLowerCase())
      );
    }
    if (dateFilter) {
      const [year, month, day] = dateFilter.split('-').map(Number);
      const filterDate = new Date(year, month - 1, day);
      const fy = filterDate.getFullYear();
      const fm = filterDate.getMonth();
      const fd = filterDate.getDate();
      filtered = filtered.filter(item => {
        const d = new Date(item.createdAt);
        return d.getFullYear() === fy && d.getMonth() === fm && d.getDate() === fd;
      });
    }
    setFilteredRequests(filtered);
    // Filtro por ação (nome da ação ou label mapeada)
    if (actionFilter) {
      const q = actionFilter.toLowerCase();
      filtered = filtered.filter(item => {
        const raw = (item.action || '').toLowerCase();
        const label = (getActionLabel(item.action) || '').toLowerCase();
        return raw.includes(q) || label.includes(q);
      });
    }
    setFilteredRequests(filtered);
  }, [allRequests, requesterFilter, dateFilter, actionFilter]);

  const groupedByFazenda = () => {
    const map = {};
    // seed com todas as fazendas para aparecer mesmo sem cativeiros
    fazendas.forEach(f => { map[String(f._id)] = []; });
    
    cativeiros.forEach(c => {
      // tenta várias chaves possíveis de vínculo e normaliza para string
      const raw = c.fazenda?._id || c.fazendaId || c.fazenda || c.fazenda_id;
      const fallback = fazendas[0]?._id ? String(fazendas[0]._id) : '';
      const fzId = raw ? String(raw) : fallback;
      
      if (!map[fzId]) map[fzId] = [];
      map[fzId].push(c);
    });
    
    return map;
  };

  const loadSensorsForCativeiro = async (cativeiroId) => {
    try {
      const token = getToken();
      const res = await axios.get(`${apiUrl}/cativeiros/${cativeiroId}/sensores`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const raw = Array.isArray(res.data) ? res.data : [];
      const sensores = raw.map(item => item?.id_sensor || item).filter(Boolean);
      setCativeiros(prev => prev.map(c => c._id === cativeiroId ? { ...c, sensores } : c));
    } catch (e) {}
  };

  const loadDietaAtual = async (cativeiroId) => {
    try {
      const res = await axios.get(`${apiUrl}/dietas/atual/${cativeiroId}`);
      if (res?.data) {
        setCativeiroDieta(prev => ({ ...prev, [cativeiroId]: res.data }));
      }
    } catch (e) {
      setCativeiroDieta(prev => ({ ...prev, [cativeiroId]: null }));
    }
  };

  const upsertDietaForCativeiro = async (cativeiroId) => {
    try {
      const token = getToken();
      const headers = { Authorization: `Bearer ${token}` };
      const atual = cativeiroDieta[cativeiroId];
      if (atual && atual.dietaId) {
        await axios.put(`${apiUrl}/dietas/${atual.dietaId}`, { descricao: newDietaForm.descricao, quantidade: newDietaForm.quantidade }, { headers });
      } else {
        const d = await axios.post(`${apiUrl}/dietas`, { descricao: newDietaForm.descricao, quantidade: newDietaForm.quantidade }, { headers });
        const dietaId = d?.data?._id;
        if (!dietaId) throw new Error('Falha ao criar dieta');
        await axios.post(`${apiUrl}/dietas/assign/${cativeiroId}`, { dietaId, ativo: true }, { headers });
      }
      // Recarrega dieta atual
      await loadDietaAtual(cativeiroId);
      // Limpa form
      setNewDietaForm({ descricao: '', quantidade: '' });
      alert('Dieta atualizada com sucesso.');
    } catch (e) {
      alert('Erro ao criar/atribuir dieta: ' + (e?.response?.data?.error || e.message));
    }
  };

  const getActionLabel = (action) => {
    const map = {
      editar_cativeiro_add_sensor: 'Solicitar vínculo de sensor',
      editar_cativeiro_remove_sensor: 'Solicitar troca de sensor(es)',
      cadastrar_cativeiro: 'Cadastrar cativeiro',
      editar_cativeiro: 'Editar cativeiro',
      editar_sensor: 'Editar sensor',
    };
    return map[action] || action;
  };

  const formatRequestDetails = (action, payload) => {
    const getCativeiroNomeById = (cid) => {
      const c = cativeiros.find(x => String(x._id) === String(cid));
      return c ? (c.nome || c._id) : (cid || 'N/A');
    };
    if (action === 'editar_cativeiro_add_sensor') {
      const nome = getCativeiroNomeById(payload?.cativeiroId);
      return (
        <div style={{ background: '#f8fafc', padding: 12, borderRadius: 6, marginTop: 8, border: '1px solid #e2e8f0' }}>
          <div><strong>Cativeiro:</strong> {nome}</div>
          <div style={{ color: '#6b7280', fontSize: 13, marginTop: 4 }}>Solicitação de vínculo de sensores (Master decidirá quais associar).</div>
        </div>
      );
    }
    if (action === 'editar_cativeiro_remove_sensor') {
      const nome = getCativeiroNomeById(payload?.cativeiroId);
      const tipos = Array.isArray(payload?.tipos) ? payload.tipos : [];
      return (
        <div style={{ background: '#f8fafc', padding: 12, borderRadius: 6, marginTop: 8, border: '1px solid #e2e8f0' }}>
          <div style={{ marginBottom: 6 }}><strong>Cativeiro:</strong> {nome}</div>
          <div><strong>Trocar sensores:</strong></div>
          <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
            {tipos.length > 0 ? tipos.map(t => (
              <span key={t} style={{ padding: '4px 8px', background: '#e5e7eb', borderRadius: 999, fontSize: 12, color: '#374151' }}>{t}</span>
            )) : <span style={{ color: '#6b7280' }}>Nenhum tipo informado</span>}
          </div>
        </div>
      );
    }
    if (action === 'editar_cativeiro') {
      const nome = typeof payload?.cativeiroId !== 'undefined' ? getCativeiroNomeById(payload.cativeiroId) : '—';
      const tipoCam = typeof payload?.id_tipo_camarao !== 'undefined' ? (tiposCamarao.find(t => String(t._id) === String(payload.id_tipo_camarao)) || null) : null;
      return (
        <div style={{ background: '#f8fafc', padding: 12, borderRadius: 6, marginTop: 8, border: '1px solid #e2e8f0' }}>
          <div style={{ marginBottom: 6 }}><strong>Cativeiro:</strong> {nome}</div>
          <div><strong>Alterações:</strong></div>
          <ul style={{ marginTop: 6, marginLeft: 18 }}>
            {typeof payload?.nome !== 'undefined' && (<li><strong>Nome:</strong> {payload.nome || 'N/A'}</li>)}
            {typeof payload?.id_tipo_camarao !== 'undefined' && (
              <li><strong>Tipo de Camarão:</strong> {tipoCam ? tipoCam.nome : payload.id_tipo_camarao}</li>
            )}
            {typeof payload?.temp_media_diaria !== 'undefined' && (<li><strong>Temp ideal (°C):</strong> {payload.temp_media_diaria}</li>)}
            {typeof payload?.ph_medio_diario !== 'undefined' && (<li><strong>pH ideal:</strong> {payload.ph_medio_diario}</li>)}
            {typeof payload?.amonia_media_diaria !== 'undefined' && (<li><strong>Amônia ideal (mg/L):</strong> {payload.amonia_media_diaria}</li>)}
          </ul>
        </div>
      );
    }
    if (action === 'editar_sensor') {
      // Mostrar tipo e apelido do sensor quando disponível em `sensores`
      const sensorMatch = (sensores || []).find(s => String(s._id) === String(payload?.id) || String(s.id) === String(payload?.id));
      const tipo = sensorMatch ? (typeof sensorMatch.id_tipo_sensor === 'object' ? sensorMatch.id_tipo_sensor.descricao || sensorMatch.id_tipo_sensor.nome : sensorMatch.id_tipo_sensor) : null;
      const apelido = sensorMatch ? (sensorMatch.apelido || '') : (payload?.apelido || 'N/A');
      return (
        <div style={{ background: '#f8fafc', padding: 12, borderRadius: 6, marginTop: 8, border: '1px solid #e2e8f0' }}>
          <div><strong>Sensor:</strong> {tipo ? `${tipo} | ${apelido}` : (payload?.apelido || payload?.id || 'N/A')}</div>
          {payload?.apelido && <div><strong>Novo Apelido:</strong> {payload.apelido}</div>}
        </div>
      );
    }
    return (
      <pre style={{ background: '#f9fafb', padding: 8, borderRadius: 4, fontSize: '12px', marginTop: 4, overflow: 'auto', maxHeight: '200px' }}>{JSON.stringify(payload, null, 2)}</pre>
    );
  };

  const getFazendaName = (id) => {
    const idStr = String(id);
    const f = fazendas.find(fz => String(fz._id) === idStr);
    if (!f) return 'Sem fazenda';
    return f.nome && f.codigo ? `${f.nome} - ${f.codigo}` : (f.nome || f.codigo || id);
  };

  const solicitarVinculoSensores = async (cativeiro) => {
    // Garante sensores atualizados antes de calcular faltantes
    let sensoresAtuais = Array.isArray(cativeiro.sensores) && cativeiro.sensores.length > 0 ? cativeiro.sensores : [];
    try {
      if (sensoresAtuais.length === 0) {
        const token = getToken();
        const res = await axios.get(`${apiUrl}/cativeiros/${cativeiro._id}/sensores`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        const raw = Array.isArray(res.data) ? res.data : [];
        sensoresAtuais = raw.map(item => item?.id_sensor || item).filter(Boolean);
      }
    } catch {}

    const tiposAtuais = new Set((sensoresAtuais || []).map(s => getSensorType(s)).filter(Boolean));
    const faltaTemperatura = !tiposAtuais.has('temperatura');
    const faltaPh = !tiposAtuais.has('ph');
    const faltaAmonia = !tiposAtuais.has('amonia');

    if (!faltaTemperatura && !faltaPh && !faltaAmonia) {
      alert('Este cativeiro já possui sensores de temperatura, pH e amônia.');
      return;
    }

    setLinkForm({
      cativeiroId: cativeiro._id,
      temperatura: false,
      ph: false,
      amonia: false,
      allowed: { temperatura: faltaTemperatura, ph: faltaPh, amonia: faltaAmonia }
    });
    setShowLinkModal(true);
  };

  const abrirSwapModal = (cativeiroId) => {
    setSwapForm({ cativeiroId, temperatura: false, ph: false, amonia: false });
    setShowSwapModal(true);
  };

  const solicitarTrocaSensores = async () => {
    try {
      const { cativeiroId, temperatura, ph, amonia } = swapForm;
      if (!cativeiroId) { setShowSwapModal(false); return; }
      const tipos = [];
      if (temperatura) tipos.push('temperatura');
      if (ph) tipos.push('ph');
      if (amonia) tipos.push('amonia');
      if (tipos.length === 0) { alert('Selecione pelo menos um tipo para trocar.'); return; }
      const token = getToken();
      const headers = { Authorization: `Bearer ${token}` };
      await axios.post(`${apiUrl}/requests`, {
        action: 'editar_cativeiro_remove_sensor',
        payload: { cativeiroId, tipos },
        fazenda: null
      }, { headers });
      setShowSwapModal(false);
      alert('Solicitação de troca enviada para o Master.');
    } catch (e) {
      alert('Erro ao solicitar troca: ' + (e?.response?.data?.error || e.message));
    }
  };

  const updateCativeiroNome = async (id, nome) => {
    const token = getToken();
    await axios.patch(`${apiUrl}/cativeiros/${id}`, { nome }, { headers: { Authorization: `Bearer ${token}` } });
    await load();
  };

  const updateCativeiroTipoCamarao = async (id, id_tipo_camarao) => {
    const token = getToken();
    await axios.patch(`${apiUrl}/cativeiros/${id}`, { id_tipo_camarao }, { headers: { Authorization: `Bearer ${token}` } });
    await load();
  };

  const updateCativeiroCondicoesIdeais = async (id, condicoes_ideais) => {
    const token = getToken();
    const cativeiro = cativeiros.find(c => c._id === id);
    if (!cativeiro) return;

    // Para que o backend crie/atualize CondicoesIdeais, é necessário enviar id_tipo_camarao
    const idTipo = cativeiro.id_tipo_camarao?._id || cativeiro.id_tipo_camarao || '';
    const data = {
      id_tipo_camarao: idTipo,
      temp_media_diaria: condicoes_ideais?.temp_ideal,
      ph_medio_diario: condicoes_ideais?.ph_ideal,
      amonia_media_diaria: condicoes_ideais?.amonia_ideal
    };
    await axios.patch(`${apiUrl}/cativeiros/${id}`, data, { headers: { Authorization: `Bearer ${token}` } });
    await load();
  };

  const act = async (id, op) => {
    const token = getToken();
    await axios.post(`${apiUrl}/requests/${id}/${op}`, {}, { headers: { Authorization: `Bearer ${token}` } });
    await load();
  };

  const applyAndApprove = async (item) => {
    try {
      const token = getToken();
      const headers = { Authorization: `Bearer ${token}` };
      const { action, payload, _id } = item;
      if (action === 'editar_cativeiro' && payload?.cativeiroId) {
        const body = {};
        if (typeof payload.nome !== 'undefined') body.nome = payload.nome;
        if (typeof payload.id_tipo_camarao !== 'undefined') body.id_tipo_camarao = payload.id_tipo_camarao;
        // Suporta formatos alternativos dos campos das condições ideais
        if (typeof payload.temp_media_diaria !== 'undefined') body.temp_media_diaria = payload.temp_media_diaria;
        if (typeof payload.ph_medio_diario !== 'undefined') body.ph_medio_diario = payload.ph_medio_diario;
        if (typeof payload.amonia_media_diaria !== 'undefined') body.amonia_media_diaria = payload.amonia_media_diaria;
        if (typeof payload.temp_ideal !== 'undefined') body.temp_media_diaria = payload.temp_ideal;
        if (typeof payload.ph_ideal !== 'undefined') body.ph_medio_diario = payload.ph_ideal;
        if (typeof payload.amonia_ideal !== 'undefined') body.amonia_media_diaria = payload.amonia_ideal;
        if (payload.condicoes_ideais && typeof payload.condicoes_ideais === 'object') {
          const ci = payload.condicoes_ideais;
          if (typeof ci.temp_ideal !== 'undefined') body.temp_media_diaria = ci.temp_ideal;
          if (typeof ci.ph_ideal !== 'undefined') body.ph_medio_diario = ci.ph_ideal;
          if (typeof ci.amonia_ideal !== 'undefined') body.amonia_media_diaria = ci.amonia_ideal;
        }
        // Se alguma condição ideal foi informada e não veio id_tipo_camarao no payload,
        // enviamos o id_tipo_camarao atual do cativeiro para o backend criar/atualizar CondicoesIdeais
        const hasCondicoes = ['temp_media_diaria','ph_medio_diario','amonia_media_diaria'].some(k => typeof body[k] !== 'undefined');
        if (hasCondicoes && typeof body.id_tipo_camarao === 'undefined') {
          const cat = cativeiros.find(c => c._id === payload.cativeiroId);
          const tipoAtual = cat?.id_tipo_camarao?._id || cat?.id_tipo_camarao;
          if (tipoAtual) body.id_tipo_camarao = tipoAtual;
        }
        if (Object.keys(body).length === 0) {
          alert('Nada para aplicar neste request.');
          return;
        }
        await axios.patch(`${apiUrl}/cativeiros/${payload.cativeiroId}`, body, { headers });
      } else if (action === 'editar_sensor' && payload?.id && payload?.apelido) {
        await axios.patch(`${apiUrl}/sensores/${payload.id}`, { apelido: payload.apelido }, { headers });
      } else {
        alert('Este tipo de solicitação não é leve ou falta informação.');
        return;
      }
      // Recarrega dados do cativeiro para refletir alterações já aplicadas
      await load();
      await act(_id, 'approve');
    } catch (e) {
      alert('Falha ao aplicar alteração: ' + (e?.response?.data?.error || e.message));
    }
  };

  const solicitarCriacaoCativeiro = async () => {
    try {
      const token = getToken();
      const headers = { Authorization: `Bearer ${token}` };
      
      const payload = {
        fazendaId: newCativeiro.fazendaId,
        nome: newCativeiro.nome,
        id_tipo_camarao: newCativeiro.id_tipo_camarao,
        data_instalacao: newCativeiro.data_instalacao,
        temp_media_diaria: newCativeiro.temp_media_diaria,
        ph_medio_diario: newCativeiro.ph_medio_diario,
        amonia_media_diaria: newCativeiro.amonia_media_diaria,
        dieta_texto: newDietaForm.descricao || undefined
      };

      await axios.post(`${apiUrl}/requests`, {
        action: 'cadastrar_cativeiro',
        payload: payload,
        fazenda: newCativeiro.fazendaId
      }, { headers });

      alert('Solicitação de criação de cativeiro enviada para o Master!');
      setShowCreateModal(false);
      setNewCativeiro({
        fazendaId: '',
        nome: '',
        id_tipo_camarao: '',
        data_instalacao: '',
        temp_media_diaria: '',
        ph_medio_diario: '',
        amonia_media_diaria: ''
      });
      await load();
    } catch (e) {
      alert('Erro ao enviar solicitação: ' + (e?.response?.data?.error || e.message));
    }
  };

  const localRole = typeof window !== 'undefined' ? (JSON.parse(sessionStorage.getItem('usuarioCamarize') || localStorage.getItem('usuarioCamarize') || '{}')?.role) : undefined;
  const effectiveRole = user?.role || localRole;
  if (authLoading || loading) return <div style={{ padding: 20 }}>Carregando...</div>;
  if (!isAuthenticated) return <div style={{ padding: 20, color: 'red' }}>Sessão expirada. Faça login novamente.</div>;
  if (!effectiveRole) return <div style={{ padding: 20 }}>Carregando permissões...</div>;
  if (effectiveRole !== 'admin' && effectiveRole !== 'master') return <div style={{ padding: 20, color: 'red' }}>Acesso restrito ao Admin.</div>;
  if (error) return <div style={{ padding: 20, color: 'red' }}>{error}</div>;

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2>Painel do Admin</h2>
        <button
          onClick={() => {
            try {
              sessionStorage.removeItem('token');
              sessionStorage.removeItem('usuarioCamarize');
              localStorage.removeItem('token');
              localStorage.removeItem('usuarioCamarize');
            } catch {}
            window.location.href = '/login';
          }}
          style={{ border: '1px solid #eee', background: '#fff', borderRadius: 8, padding: '8px 12px', cursor: 'pointer' }}
          title="Sair"
        >
          Sair
        </button>
      </div>
      <div style={{ display: 'flex', gap: 8, margin: '12px 0' }}>
        <button onClick={() => setTab('requests')} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #ddd', background: tab==='requests'?'#eef':'#fff' }}>Requests</button>
        <button onClick={() => setTab('solicitacoes')} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #ddd', background: tab==='solicitacoes'?'#eef':'#fff' }}>Solicitações</button>
        <button onClick={() => setTab('cativeiros')} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #ddd', background: tab==='cativeiros'?'#eef':'#fff' }}>Cativeiros</button>
        <button onClick={() => { setTab('chat'); loadConversationsOnce(); }} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #ddd', background: tab==='chat'?'#eef':'#fff' }}>Chat</button>
      </div>

      {tab === 'requests' && (
        <section>
          <h3>Histórico de Requests dos Funcionários</h3>
          <div style={{
            display: 'flex', gap: 12, marginBottom: 16, padding: 12, background: '#f9fafb', borderRadius: 8, alignItems: 'center', flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontSize: '14px', fontWeight: '500' }}>Solicitante:</label>
              <input
                type="text"
                placeholder="Nome ou email..."
                value={requesterFilter}
                onChange={(e) => setRequesterFilter(e.target.value)}
                style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '14px', minWidth: '200px' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontSize: '14px', fontWeight: '500' }}>Data:</label>
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '14px' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontSize: '14px', fontWeight: '500' }}>Ação:</label>
              <input
                type="text"
                placeholder="Ex: editar_cativeiro..."
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '14px', minWidth: '200px' }}
              />
            </div>
            <button
              onClick={() => setDateFilter(new Date().toISOString().split('T')[0])}
              style={{ padding: '6px 12px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '14px' }}
            >
              Hoje
            </button>
            <button
              onClick={() => { setRequesterFilter(''); setDateFilter(''); setActionFilter(''); }}
              style={{ padding: '6px 12px', background: '#6b7280', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '14px' }}
            >
              Limpar Filtros
            </button>
            <div style={{ fontSize: '14px', color: '#6b7280' }}>
              {filteredRequests.length} de {allRequests.length} requests
            </div>
          </div>

          {filteredRequests.length === 0 && allRequests.length > 0 && (
            <div style={{ textAlign: 'center', padding: 20, color: '#6b7280' }}>Nenhum request encontrado com os filtros aplicados.</div>
          )}
          {filteredRequests.length === 0 && allRequests.length === 0 && (
            <div style={{ textAlign: 'center', padding: 20, color: '#6b7280' }}>Nenhum request encontrado.</div>
          )}

          {filteredRequests.map(item => (
            <div key={item._id} style={{ border: '1px solid #eee', padding: 12, marginBottom: 10, borderRadius: 6, background: item.status === 'aprovado' ? '#f0fdf4' : item.status === 'recusado' ? '#fef2f2' : '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div>
                  <strong>Solicitante:</strong> {(item.requesterUser?.nome || item.requester?.nome || 'N/A')} ({item.requesterUser?.email || item.requester?.email || 'N/A'})
                </div>
                <div style={{ padding: '4px 8px', borderRadius: 4, fontSize: '12px', background: item.status === 'aprovado' ? '#dcfce7' : item.status === 'recusado' ? '#fee2e2' : '#fef3c7', color: item.status === 'aprovado' ? '#166534' : item.status === 'recusado' ? '#991b1b' : '#92400e' }}>
                  {item.status === 'aprovado' ? '✅ Aprovado' : item.status === 'recusado' ? '❌ Recusado' : '⏳ Pendente'}
                </div>
              </div>
              <div style={{ marginBottom: 8 }}>
                <strong>Ação:</strong> {getActionLabel(item.action)}
              </div>
              <div style={{ marginBottom: 8 }}>
                <strong>Data:</strong> {new Date(item.createdAt).toLocaleString('pt-BR')}
              </div>
              {item.payload && (
                <div>
                  <strong>Detalhes:</strong>
                  {formatRequestDetails(item.action, item.payload)}
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      {tab === 'solicitacoes' && (
        <section>
          <h3>Solicitações leves dos funcionários</h3>
          {items.length === 0 && <div>Nenhuma solicitação pendente.</div>}
          {items.map(item => (
            <div key={item._id} style={{ border: '1px solid #eee', padding: 12, marginBottom: 10, borderRadius: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div><b>Solicitante:</b> {(item.requesterUser?.nome || item.requester?.nome || 'N/A')} ({item.requesterUser?.email || item.requester?.email || 'N/A'})</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>{new Date(item.createdAt).toLocaleString('pt-BR')}</div>
              </div>
              <div style={{ marginBottom: 8 }}><b>Ação:</b> {getActionLabel(item.action)}</div>
              {item.payload && (
                <div style={{ marginBottom: 12 }}>
                  <strong>Detalhes:</strong>
                  {formatRequestDetails(item.action, item.payload)}
                </div>
              )}
              <div>
                <button 
                  onClick={() => applyAndApprove(item)}
                  style={{ background: '#10b981', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 4, cursor: 'pointer', marginRight: 8 }}
                >
                  Aplicar e Aprovar
                </button>
                <button 
                  onClick={() => act(item._id, 'reject')}
                  style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 4, cursor: 'pointer' }}
                >
                  Recusar
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {tab === 'cativeiros' && (
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3>Fazendas e Cativeiros</h3>
            <button
              onClick={() => setShowCreateModal(true)}
              style={{
                background: '#3b82f6',
                color: '#fff',
                border: 'none',
                padding: '8px 16px',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Solicitar novo cativeiro
            </button>
          </div>
          {Object.entries(groupedByFazenda()).map(([fzId, cats]) => (
            <div key={fzId} style={{ border: '1px solid #eee', borderRadius: 8, marginBottom: 10 }}>
              <div
                onClick={() => setExpandedFazenda(prev => ({ ...prev, [fzId]: !prev[fzId] }))}
                style={{ padding: 10, cursor: 'pointer', background: '#f9fafb', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between' }}
              >
                <span>{getFazendaName(fzId)}</span>
                <span>{expandedFazenda[fzId] ? '▲' : '▼'}</span>
              </div>
              {expandedFazenda[fzId] && (
                <div style={{ padding: 10 }}>
                  {cats.length === 0 && <div style={{ color: '#888' }}>Nenhum cativeiro nesta fazenda.</div>}
                  {cats.map(cativeiro => (
                    <div key={cativeiro._id} style={{ border: '1px solid #eee', borderRadius: 6, marginBottom: 8, overflow: 'hidden' }}>
                      <div
                        onClick={() => {
                          const willExpand = !expandedCativeiro[cativeiro._id];
                          setExpandedCativeiro(prev => ({ ...prev, [cativeiro._id]: willExpand }));
                          if (willExpand) {
                            if (!(Array.isArray(cativeiro.sensores) && cativeiro.sensores.length)) {
                              loadSensorsForCativeiro(cativeiro._id);
                            }
                            if (!cativeiroDieta[cativeiro._id]) {
                              loadDietaAtual(cativeiro._id);
                            }
                          }
                        }}
                        style={{ padding: 8, cursor: 'pointer', background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      >
                        <span>{cativeiro.nome || cativeiro._id}</span>
                        <span>{expandedCativeiro[cativeiro._id] ? '▲' : '▼'}</span>
                      </div>
                      {expandedCativeiro[cativeiro._id] && (
                        <div style={{ padding: 10 }}>
                          <div style={{ marginBottom: 8 }}>
                            <strong>Tipo de Camarão:</strong>
                            <select
                              value={cativeiro.id_tipo_camarao?._id || cativeiro.id_tipo_camarao || ''}
                              onChange={(e) => {
                                const updatedCativeiros = cativeiros.map(cat =>
                                  cat._id === cativeiro._id ? { ...cat, id_tipo_camarao: e.target.value } : cat
                                );
                                setCativeiros(updatedCativeiros);
                              }}
                              style={{ marginLeft: 8, padding: '4px 8px', borderRadius: 4, border: '1px solid #ccc' }}
                            >
                              <option value="">Selecione um tipo</option>
                              {tiposCamarao.map(tipo => (
                                <option key={tipo._id} value={tipo._id}>{tipo.nome}</option>
                              ))}
                            </select>
                            <button 
                              onClick={() => updateCativeiroTipoCamarao(cativeiro._id, cativeiro.id_tipo_camarao)} 
                              style={{ marginLeft: 8, background: '#4CAF50', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: 4, cursor: 'pointer' }}
                            >
                              Salvar
                            </button>
                          </div>
                          <div style={{ marginBottom: 8 }}>
                            <strong>Data de Instalação:</strong> {new Date(cativeiro.data_instalacao).toLocaleDateString()}
                          </div>
                          <div style={{ marginBottom: 8 }}>
                            <strong>Dieta atual:</strong>
                            <div style={{ marginTop: 4, padding: 8, border: '1px dashed #e5e7eb', borderRadius: 6, background: '#fafafa' }}>
                              {cativeiroDieta[cativeiro._id] === undefined && (
                                <span style={{ color: '#6b7280' }}>Carregando...</span>
                              )}
                              {cativeiroDieta[cativeiro._id] === null && (
                                <span style={{ color: '#6b7280' }}>Nenhuma dieta ativa.</span>
                              )}
                              {cativeiroDieta[cativeiro._id] && (
                                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                                  <div><b>Descrição:</b> {cativeiroDieta[cativeiro._id].descricao || '—'}</div>
                                  <div><b>Qtd (g):</b> {typeof cativeiroDieta[cativeiro._id].quantidade !== 'undefined' ? cativeiroDieta[cativeiro._id].quantidade : '—'}</div>
                                </div>
                              )}
                            </div>
                          </div>
                          <div style={{ marginBottom: 8 }}>
                            <strong>Atualizar Dieta</strong>
                            <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                              <input value={newDietaForm.descricao} onChange={(e) => setNewDietaForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Descrição" style={{ flex: 1, minWidth: 220, padding: '6px 8px', border: '1px solid #ddd', borderRadius: 6 }} />
                              <input type="number" step="0.01" value={newDietaForm.quantidade} onChange={(e) => setNewDietaForm(f => ({ ...f, quantidade: e.target.value }))} placeholder="Quantidade (g)" style={{ width: 160, padding: '6px 8px', border: '1px solid #ddd', borderRadius: 6 }} />
                              <button onClick={() => upsertDietaForCativeiro(cativeiro._id)} style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}>Atualizar</button>
                            </div>
                          </div>
                          {/* Dieta removida do card: administrar via Dietas + DietasxCativeiros */}
                          <div style={{ marginBottom: 8 }}>
                            <strong>Condições Ideais:</strong>
                            <div style={{ marginTop: 4, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                              <div>
                                <label style={{ fontSize: '12px', color: '#666' }}>Temperatura (°C):</label>
                                <input
                                  type="number"
                                  step="0.1"
                                  value={cativeiro.condicoes_ideais?.temp_ideal || ''}
                                  onChange={(e) => {
                                    const updatedCativeiros = cativeiros.map(cat =>
                                      cat._id === cativeiro._id ? { 
                                        ...cat, 
                                        condicoes_ideais: { 
                                          ...cat.condicoes_ideais, 
                                          temp_ideal: parseFloat(e.target.value) || 0 
                                        } 
                                      } : cat
                                    );
                                    setCativeiros(updatedCativeiros);
                                  }}
                                  style={{ width: '80px', padding: '4px 6px', borderRadius: 4, border: '1px solid #ccc', marginLeft: 4 }}
                                />
                              </div>
                              <div>
                                <label style={{ fontSize: '12px', color: '#666' }}>pH:</label>
                                <input
                                  type="number"
                                  step="0.1"
                                  value={cativeiro.condicoes_ideais?.ph_ideal || ''}
                                  onChange={(e) => {
                                    const updatedCativeiros = cativeiros.map(cat =>
                                      cat._id === cativeiro._id ? { 
                                        ...cat, 
                                        condicoes_ideais: { 
                                          ...cat.condicoes_ideais, 
                                          ph_ideal: parseFloat(e.target.value) || 0 
                                        } 
                                      } : cat
                                    );
                                    setCativeiros(updatedCativeiros);
                                  }}
                                  style={{ width: '60px', padding: '4px 6px', borderRadius: 4, border: '1px solid #ccc', marginLeft: 4 }}
                                />
                              </div>
                              <div>
                                <label style={{ fontSize: '12px', color: '#666' }}>Amônia (mg/L):</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={cativeiro.condicoes_ideais?.amonia_ideal || ''}
                                  onChange={(e) => {
                                    const updatedCativeiros = cativeiros.map(cat =>
                                      cat._id === cativeiro._id ? { 
                                        ...cat, 
                                        condicoes_ideais: { 
                                          ...cat.condicoes_ideais, 
                                          amonia_ideal: parseFloat(e.target.value) || 0 
                                        } 
                                      } : cat
                                    );
                                    setCativeiros(updatedCativeiros);
                                  }}
                                  style={{ width: '80px', padding: '4px 6px', borderRadius: 4, border: '1px solid #ccc', marginLeft: 4 }}
                                />
                              </div>
                              <button 
                                onClick={() => updateCativeiroCondicoesIdeais(cativeiro._id, cativeiro.condicoes_ideais)} 
                                style={{ background: '#4CAF50', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: 4, cursor: 'pointer' }}
                              >
                                Salvar
                              </button>
                            </div>
                          </div>
                          <div style={{ marginTop: 10 }}>
                            <div style={{ fontWeight: 700, marginBottom: 6 }}>Sensores</div>
                            {Array.isArray(cativeiro.sensores) && cativeiro.sensores.length > 0 ? (
                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                {cativeiro.sensores.map(s => (
                                  <div key={s._id || s} style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    padding: '6px 10px',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: 999,
                                    background: '#f9fafb',
                                    fontSize: 12,
                                    color: '#374151'
                                  }}>
                                    <span style={{
                                      padding: '2px 6px',
                                      borderRadius: 6,
                                      background: '#eef2ff',
                                      color: '#3730a3',
                                      fontWeight: 600,
                                      textTransform: 'uppercase'
                                    }}>{getSensorType(s) || 'sensor'}</span>
                                    <span style={{ fontWeight: 600 }}>{s.apelido || '—'}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div style={{ color: '#6b7280' }}>Nenhum sensor associado.</div>
                            )}
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
                              {(() => {
                                const tiposAtuais = new Set((cativeiro.sensores || []).map(s => getSensorType(s)).filter(Boolean));
                                const allHave = tiposAtuais.has('temperatura') && tiposAtuais.has('ph') && tiposAtuais.has('amonia');
                                return (
                                  <button
                                    onClick={() => solicitarVinculoSensores(cativeiro)}
                                    disabled={allHave}
                                    title={allHave ? 'Já possui sensores de temperatura, pH e amônia' : 'Solicitar vínculo de sensores que faltam'}
                                    style={{ background: allHave ? '#9ca3af' : '#3b82f6', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: 4, cursor: allHave ? 'not-allowed' : 'pointer' }}
                                  >
                                    Solicitar vínculo
                                  </button>
                                );
                              })()}
                              <button
                                onClick={() => abrirSwapModal(cativeiro._id)}
                                style={{ background: '#111827', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: 4, cursor: 'pointer' }}
                              >
                                Solicitar troca
                              </button>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                            <input
                              type="text"
                              value={cativeiro.nome}
                              onChange={(e) => {
                                const updatedCativeiros = cativeiros.map(cat =>
                                  cat._id === cativeiro._id ? { ...cat, nome: e.target.value } : cat
                                );
                                setCativeiros(updatedCativeiros);
                              }}
                              style={{ flex: 1, padding: '6px 10px', borderRadius: 4, border: '1px solid #ccc' }}
                            />
                            <button onClick={() => updateCativeiroNome(cativeiro._id, cativeiro.nome)} style={{ background: '#4CAF50', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: 4, cursor: 'pointer' }}>Salvar</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      {tab === 'chat' && (
        <section>
          <h3>Chat com Masters</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 12, alignItems: 'stretch' }}>
            <div style={{ border: '1px solid #eee', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ padding: 8, background: '#f9fafb', borderBottom: '1px solid #eee', fontWeight: 600 }}>Conversas</div>
              <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 420, overflow: 'auto' }}>
                {chatConversations.length === 0 && <div style={{ color: '#888' }}>Nenhuma conversa.</div>}
                {chatConversations.map(c => (
                  <button key={c._id} onClick={() => openConversation(c._id)} style={{ textAlign: 'left', border: '1px solid #e5e7eb', background: chatSelectedId===c._id?'#eef':'#fff', borderRadius: 6, padding: '8px' }}>
                    <div style={{ fontWeight: 600 }}>{getConversationTitle(c)}</div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>{new Date(c.updatedAt || c.lastMessageAt).toLocaleString('pt-BR')}</div>
                  </button>
                ))}
              </div>
              <div style={{ padding: 8, borderTop: '1px solid #eee' }}>
                <label style={{ display: 'block', fontSize: 12, color: '#6b7280' }}>Iniciar com Master</label>
                <select onChange={(e) => { const val = e.target.value; if (val) { startConversationWithMaster(val); e.target.value=''; } }} style={{ width: '100%', padding: 6, border: '1px solid #ddd', borderRadius: 6 }}>
                  <option value="">Selecione um master...</option>
                  {(users || []).filter(u => u.role === 'master').map(u => (
                    <option key={u.id || u._id} value={u.id || u._id}>{u.nome || u.email}</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ border: '1px solid #eee', borderRadius: 8, display: 'flex', flexDirection: 'column', height: '65vh', overflow: 'hidden' }}>
              <div style={{ padding: 8, background: '#f9fafb', borderBottom: '1px solid #eee', fontWeight: 600 }}>Mensagens</div>
              <div style={{ flex: 1, padding: 10, display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto', overscrollBehavior: 'contain', scrollbarWidth: 'none' }}>
                {chatLoading && <div style={{ color: '#888' }}>Carregando...</div>}
                {!chatLoading && chatSelectedId && chatMessages.map(m => {
                  const isMine = String(m.senderId) === String(getMyId());
                  return (
                    <div key={m._id} style={{ alignSelf: isMine ? 'flex-end' : 'flex-start', maxWidth: '70%' }}>
                      <div style={{ fontSize: 11, color: '#6b7280', margin: isMine ? '0 4px 2px 0' : '0 0 2px 4px', textAlign: isMine ? 'right' : 'left' }}>
                        {getDisplayName(m.senderId)}
                      </div>
                      <div style={{ background: isMine ? '#dbeafe' : '#f3f4f6', color: '#111827', border: '1px solid #e5e7eb', padding: '8px 10px', borderRadius: 10, borderTopRightRadius: isMine ? 2 : 10, borderTopLeftRadius: isMine ? 10 : 2 }}>
                        <div style={{ fontSize: 14, whiteSpace: 'pre-wrap' }}>{m.text}</div>
                        <div style={{ fontSize: 10, color: '#6b7280', marginTop: 4, textAlign: isMine ? 'right' : 'left' }}>{new Date(m.createdAt).toLocaleTimeString('pt-BR')}</div>
                      </div>
                    </div>
                  );
                })}
                {!chatSelectedId && <div style={{ color: '#888' }}>Selecione uma conversa.</div>}
                <div ref={chatEndRef} />
              </div>
              <div style={{ padding: 8, borderTop: '1px solid #eee', display: 'flex', gap: 8 }}>
                <textarea
                  value={chatText}
                  onChange={(e) => setChatText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendChatMessage();
                    }
                  }}
                  placeholder="Digite sua mensagem..."
                  rows={2}
                  style={{ flex: 1, padding: 8, border: '1px solid #ddd', borderRadius: 6, resize: 'none' }}
                />
                <button onClick={sendChatMessage} disabled={!chatSelectedId || !chatText.trim()} style={{ padding: '8px 12px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, cursor: (!chatSelectedId || !chatText.trim()) ? 'not-allowed' : 'pointer' }}>Enviar</button>
              </div>
            </div>
          </div>
        </section>
      )}

      {showSwapModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{ background: '#fff', padding: 20, borderRadius: 8, width: '95%', maxWidth: 420 }}>
            <h3 style={{ marginTop: 0 }}>Solicitar troca de sensores</h3>
            <p style={{ marginTop: 0, color: '#555' }}>Selecione os tipos de sensores que deseja trocar neste cativeiro.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '12px 0' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={swapForm.temperatura} onChange={(e) => setSwapForm(f => ({ ...f, temperatura: e.target.checked }))} />
                Temperatura
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={swapForm.ph} onChange={(e) => setSwapForm(f => ({ ...f, ph: e.target.checked }))} />
                pH
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={swapForm.amonia} onChange={(e) => setSwapForm(f => ({ ...f, amonia: e.target.checked }))} />
                Amônia
              </label>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setShowSwapModal(false)} style={{ border: '1px solid #d1d5db', background: '#fff', borderRadius: 6, padding: '6px 10px', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={solicitarTrocaSensores} style={{ border: 'none', background: '#3b82f6', color: '#fff', borderRadius: 6, padding: '6px 10px', cursor: 'pointer' }}>Solicitar</button>
            </div>
          </div>
        </div>
      )}

      {showLinkModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{ background: '#fff', padding: 20, borderRadius: 8, width: '95%', maxWidth: 420 }}>
            <h3 style={{ marginTop: 0 }}>Solicitar vínculo de sensores</h3>
            <p style={{ marginTop: 0, color: '#555' }}>Selecione os tipos de sensores que deseja vincular neste cativeiro.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '12px 0' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: linkForm.allowed.temperatura ? 1 : 0.5, pointerEvents: linkForm.allowed.temperatura ? 'auto' : 'none' }} title={linkForm.allowed.temperatura ? '' : 'Já possui sensor de temperatura'}>
                <input type="checkbox" disabled={!linkForm.allowed.temperatura} checked={linkForm.temperatura} onChange={(e) => { if (!linkForm.allowed.temperatura) return; setLinkForm(f => ({ ...f, temperatura: e.target.checked })); }} />
                Temperatura
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: linkForm.allowed.ph ? 1 : 0.5, pointerEvents: linkForm.allowed.ph ? 'auto' : 'none' }} title={linkForm.allowed.ph ? '' : 'Já possui sensor de pH'}>
                <input type="checkbox" disabled={!linkForm.allowed.ph} checked={linkForm.ph} onChange={(e) => { if (!linkForm.allowed.ph) return; setLinkForm(f => ({ ...f, ph: e.target.checked })); }} />
                pH
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: linkForm.allowed.amonia ? 1 : 0.5, pointerEvents: linkForm.allowed.amonia ? 'auto' : 'none' }} title={linkForm.allowed.amonia ? '' : 'Já possui sensor de amônia'}>
                <input type="checkbox" disabled={!linkForm.allowed.amonia} checked={linkForm.amonia} onChange={(e) => { if (!linkForm.allowed.amonia) return; setLinkForm(f => ({ ...f, amonia: e.target.checked })); }} />
                Amônia
              </label>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setShowLinkModal(false)} style={{ border: '1px solid #d1d5db', background: '#fff', borderRadius: 6, padding: '6px 10px', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={async () => {
                try {
                  const token = getToken();
                  const headers = { Authorization: `Bearer ${token}` };
                  const tipos = [];
                  if (linkForm.allowed.temperatura && linkForm.temperatura) tipos.push('temperatura');
                  if (linkForm.allowed.ph && linkForm.ph) tipos.push('ph');
                  if (linkForm.allowed.amonia && linkForm.amonia) tipos.push('amonia');
                  if (tipos.length === 0) { alert('Selecione pelo menos um tipo para vincular.'); return; }
                  await axios.post(`${apiUrl}/requests`, {
                    action: 'editar_cativeiro_add_sensor',
                    payload: { cativeiroId: linkForm.cativeiroId, tipos },
                    fazenda: null
                  }, { headers });
                  setShowLinkModal(false);
                  alert('Solicitação de vínculo enviada para o Master.');
                } catch (e) {
                  alert('Erro ao solicitar vínculo: ' + (e?.response?.data?.error || e.message));
                }
              }} style={{ border: 'none', background: '#3b82f6', color: '#fff', borderRadius: 6, padding: '6px 10px', cursor: 'pointer' }}>Solicitar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para solicitar criação de cativeiro */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: '#fff',
            padding: 24,
            borderRadius: 8,
            width: '95%',
            maxWidth: 600,
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ marginBottom: 16 }}>Solicitar novo cativeiro</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: '14px', fontWeight: '500', color: '#374151' }}>Fazenda:</label>
                <select
                  value={newCativeiro.fazendaId}
                  onChange={(e) => setNewCativeiro(prev => ({ ...prev, fazendaId: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '14px' }}
                >
                  <option value="">Selecione uma fazenda</option>
                  {fazendas.map(fazenda => (
                    <option key={fazenda._id} value={fazenda._id}>
                      {fazenda.nome} - {fazenda.codigo}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: '14px', fontWeight: '500', color: '#374151' }}>Nome do cativeiro:</label>
                <input
                  type="text"
                  value={newCativeiro.nome}
                  onChange={(e) => setNewCativeiro(prev => ({ ...prev, nome: e.target.value }))}
                  placeholder="Ex: Cativeiro A"
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '14px' }}
                />
              </div>

              {/* Dieta removida da criação de cativeiro: usar /dietas e /dietas/assign */}

              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: '14px', fontWeight: '500', color: '#374151' }}>Tipo de camarão:</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select
                    value={newCativeiro.id_tipo_camarao}
                    onChange={(e) => setNewCativeiro(prev => ({ ...prev, id_tipo_camarao: e.target.value }))}
                    style={{ flex: 1, padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '14px' }}
                  >
                    <option value="">Selecione um tipo</option>
                    {tiposCamarao.map(tipo => (
                      <option key={tipo._id} value={tipo._id}>{tipo.nome}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => { setNewTipoNome(''); setShowNewTipoModal(true); }}
                    style={{
                      padding: '10px 12px',
                      background: '#10b981',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 6,
                      cursor: 'pointer',
                      fontSize: '14px',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    + Novo
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: '14px', fontWeight: '500', color: '#374151' }}>Data de instalação:</label>
                <input
                  type="date"
                  value={newCativeiro.data_instalacao}
                  onChange={(e) => setNewCativeiro(prev => ({ ...prev, data_instalacao: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '14px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: '14px', fontWeight: '500', color: '#374151' }}>Condições ideais:</label>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: '1', minWidth: '120px' }}>
                    <label style={{ display: 'block', marginBottom: 4, fontSize: '12px', color: '#6b7280' }}>Temperatura (°C):</label>
                    <input
                      type="number"
                      step="0.1"
                      value={newCativeiro.temp_media_diaria}
                      onChange={(e) => setNewCativeiro(prev => ({ ...prev, temp_media_diaria: e.target.value }))}
                      placeholder="26.0"
                      style={{ width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '14px' }}
                    />
                  </div>
                  <div style={{ flex: '1', minWidth: '100px' }}>
                    <label style={{ display: 'block', marginBottom: 4, fontSize: '12px', color: '#6b7280' }}>pH:</label>
                    <input
                      type="number"
                      step="0.1"
                      value={newCativeiro.ph_medio_diario}
                      onChange={(e) => setNewCativeiro(prev => ({ ...prev, ph_medio_diario: e.target.value }))}
                      placeholder="7.5"
                      style={{ width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '14px' }}
                    />
                  </div>
                  <div style={{ flex: '1', minWidth: '140px' }}>
                    <label style={{ display: 'block', marginBottom: 4, fontSize: '12px', color: '#6b7280' }}>Amônia (mg/L):</label>
                    <input
                      type="number"
                      step="0.01"
                      value={newCativeiro.amonia_media_diaria}
                      onChange={(e) => setNewCativeiro(prev => ({ ...prev, amonia_media_diaria: e.target.value }))}
                      placeholder="0.05"
                      style={{ width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '14px' }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 20, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{
                  padding: '8px 16px',
                  background: '#6b7280',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={solicitarCriacaoCativeiro}
                disabled={!newCativeiro.fazendaId || !newCativeiro.nome || !newCativeiro.id_tipo_camarao}
                style={{
                  padding: '8px 16px',
                  background: newCativeiro.fazendaId && newCativeiro.nome && newCativeiro.id_tipo_camarao ? '#3b82f6' : '#9ca3af',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: newCativeiro.fazendaId && newCativeiro.nome && newCativeiro.id_tipo_camarao ? 'pointer' : 'not-allowed'
                }}
              >
                Solicitar
              </button>
            </div>
          </div>
        </div>
      )}

      <Modal isOpen={showNewTipoModal} onClose={() => setShowNewTipoModal(false)} title="Novo tipo de camarão">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: '14px', fontWeight: '500', color: '#374151' }}>Nome</label>
            <input
              type="text"
              value={newTipoNome}
              onChange={(e) => setNewTipoNome(e.target.value)}
              placeholder="Ex: Rosa, preto"
              autoFocus
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '14px' }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button onClick={() => setShowNewTipoModal(false)} style={{ padding: '8px 16px', background: '#6b7280', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
            <button
              onClick={async () => {
                try {
                  const nome = (newTipoNome || '').trim();
                  if (!nome) return;
                  const token = getToken();
                  const headers = { Authorization: `Bearer ${token}` };
                  const response = await axios.post(`${apiUrl}/camaroes`, { nome }, { headers });
                  setShowNewTipoModal(false);
                  setNewTipoNome('');
                  setNewCativeiro(prev => ({ ...prev, id_tipo_camarao: response.data._id }));
                  await load();
                } catch (e) {
                  alert('Erro ao criar tipo de camarão: ' + (e?.response?.data?.error || e.message));
                }
              }}
              disabled={!newTipoNome.trim()}
              style={{ padding: '8px 16px', background: newTipoNome.trim() ? '#10b981' : '#9ca3af', color: '#fff', border: 'none', borderRadius: 6, cursor: newTipoNome.trim() ? 'pointer' : 'not-allowed' }}
            >
              Salvar
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

