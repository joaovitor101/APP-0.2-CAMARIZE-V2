import { useEffect, useState, useRef } from 'react';
import Modal from '../../components/Modal';
import axios from 'axios';
import { useAuth } from '@/hooks/useAuth';

export default function MasterPanel() {
  const { isAuthenticated, loading: authLoading, user } = useAuth();
  const [items, setItems] = useState([]);
  const [allRequests, setAllRequests] = useState([]);
  const [filteredRequests, setFilteredRequests] = useState([]);
  const [users, setUsers] = useState([]);
  const [fazendas, setFazendas] = useState([]);
  const [cativeiros, setCativeiros] = useState([]);
  const [tiposCamarao, setTiposCamarao] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dietas, setDietas] = useState([]);
  const [dietaForm, setDietaForm] = useState({ descricao: '', quantidade: '' });
  const [editingDietaId, setEditingDietaId] = useState('');
  const [editingDieta, setEditingDieta] = useState({ descricao: '', quantidade: '' });
  const [cativeiroDieta, setCativeiroDieta] = useState({}); // cId -> { dietaId, descricao, quantidade }
  const [dietaEditsByCat, setDietaEditsByCat] = useState({}); // cId -> { descricao, quantidade }
  const [assignForm, setAssignForm] = useState({ cativeiroId: '', dietaId: '' });
  const [error, setError] = useState('');
  const [requesterFilter, setRequesterFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [tab, setTab] = useState('requests'); // requests | solicitacoes | usuarios | cativeiros | sensores | dietas
  const [chatConversations, setChatConversations] = useState([]);
  const [chatSelectedId, setChatSelectedId] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [chatText, setChatText] = useState('');
  const chatEndRef = useRef(null);
  const [showChatMenu, setShowChatMenu] = useState(false);
  const getMyId = () => {
    const fromUser = user?.id || user?._id;
    const stored = (typeof window !== 'undefined') ? (JSON.parse(sessionStorage.getItem('usuarioCamarize') || localStorage.getItem('usuarioCamarize') || '{}')) : {};
    const fromStorage = stored?.id || stored?._id;
    return String(fromUser || fromStorage || '');
  };

  const getDisplayName = (senderId) => {
    const me = getMyId();
    if (String(senderId) === String(me)) return 'Você (Master)';
    const u = (users || []).find(x => String(x.id || x._id) === String(senderId));
    // Se não achou no users (pois users contém admins), rotula como Admin por padrão
    return u?.nome || u?.email || 'Admin';
  };

  const getConversationTitle = (conv) => {
    const me = getMyId();
    const otherId = (Array.isArray(conv?.participants) ? conv.participants : []).find(p => String(p) !== String(me));
    const u = (users || []).find(x => String(x.id || x._id) === String(otherId));
    return u?.nome || u?.email || 'Admin';
  };
  const [sensores, setSensores] = useState([]);
  const [showCreateSensor, setShowCreateSensor] = useState(false);
  const [sensorForm, setSensorForm] = useState({ id_tipo_sensor: 'temperatura', apelido: '', fotoFile: null });
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkForm, setLinkForm] = useState({ sensorId: '', cativeiroId: '', currentSensorIds: [] });
  const [expandedFazenda, setExpandedFazenda] = useState({}); // id -> bool
  const [expandedCativeiro, setExpandedCativeiro] = useState({}); // id -> bool
  const [cativeirosByFazenda, setCativeirosByFazenda] = useState({}); // fazendaId -> [cativeiros]
  const [loadingFazenda, setLoadingFazenda] = useState({}); // fazendaId -> bool

  // Modal de criação de cativeiro
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    fazendaId: '',
    nome: '',
    id_tipo_camarao: '',
    data_instalacao: '',
    temp_media_diaria: '',
    ph_medio_diario: '',
    amonia_media_diaria: '',
    fotoFile: null,
    dietaAtivar: false,
    dietaDescricao: '',
    dietaQuantidade: ''
  });

  // Modal de edição de cativeiro
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    id: '',
    fazendaId: '',
    nome: '',
    id_tipo_camarao: '',
    data_instalacao: '',
    temp_media_diaria: '',
    ph_medio_diario: '',
    amonia_media_diaria: '',
    fotoFile: null
  });

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  const getToken = () => (typeof window !== 'undefined' ? (sessionStorage.getItem('token') || localStorage.getItem('token')) : null);

  const load = async () => {
    try {
      setLoading(true);
      const token = getToken();
      const headers = { Authorization: `Bearer ${token}` };
      const [reqs, us, fzs, cats, tipos, sens, dts] = await Promise.all([
        axios.get(`${apiUrl}/requests`, { headers }), // Requests pendentes para aprovar/recusar
        axios.get(`${apiUrl}/users`, { headers }),
        axios.get(`${apiUrl}/fazendas`, { headers }),
        axios.get(`${apiUrl}/cativeiros`, { headers }),
        axios.get(`${apiUrl}/camaroes`, { headers }),
        axios.get(`${apiUrl}/sensores`, { headers }),
        axios.get(`${apiUrl}/dietas`, { headers }).catch(() => ({ data: [] })),
      ]);
      setItems(reqs.data);
      setUsers(us.data);
      setFazendas(fzs.data);
      setCativeiros(cats.data);
      setTiposCamarao(tipos.data);
      setSensores(sens.data);
      setDietas(dts.data || []);
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
      const response = await axios.get(`${apiUrl}/requests/all`, { headers });
      console.log('Requests carregados do backend:', response.data);
      return response.data;
    } catch (e) {
      console.error('Erro ao carregar todos os requests:', e);
      return [];
    }
  };

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      load();
    }
  }, [authLoading, isAuthenticated]);

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
    return () => { if (timer) clearInterval(timer); setShowChatMenu(false); };
  }, [tab, chatSelectedId]);

  const openConversation = async (convId) => {
    try {
      setChatSelectedId(convId);
      const token = getToken();
      const headers = { Authorization: `Bearer ${token}` };
      const msgs = await axios.get(`${apiUrl}/chat/conversations/${convId}/messages`, { headers });
      setChatMessages(msgs.data || []);
    } catch {}
  };

  const startConversationWithAdmin = async (adminId) => {
    try {
      const token = getToken();
      const headers = { Authorization: `Bearer ${token}` };
      let me = (user?.id) || (JSON.parse(sessionStorage.getItem('usuarioCamarize') || localStorage.getItem('usuarioCamarize') || '{}')?.id);
      if (!me) {
        const meRes = await axios.get(`${apiUrl}/users/me`, { headers });
        me = meRes.data?._id || meRes.data?.id;
      }
      if (!me || !adminId) throw new Error('IDs inválidos');
      const res = await axios.post(`${apiUrl}/chat/conversations`, { adminId, masterId: me }, { headers });
      const convs = await axios.get(`${apiUrl}/chat/conversations/mine`, { headers });
      setChatConversations(convs.data || []);
      setTab('chat');
      if (res?.data?._id) openConversation(res.data._id);
    } catch (e) {
      const msg = e?.response?.data?.error || e.message || 'Falha desconhecida';
      alert('Não foi possível iniciar a conversa: ' + msg);
    }
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
    if (tab === 'requests' && isAuthenticated) {
      loadAllRequests().then(setAllRequests);
    }
  }, [tab, isAuthenticated]);

  // Aplicar filtros quando allRequests ou filtros mudarem
  useEffect(() => {
    let filtered = [...allRequests];

    // Filtro por solicitante
    if (requesterFilter) {
      filtered = filtered.filter(item => 
        item.requesterUser?.nome?.toLowerCase().includes(requesterFilter.toLowerCase()) ||
        item.requesterUser?.email?.toLowerCase().includes(requesterFilter.toLowerCase())
      );
    }

    // Filtro por data
    if (dateFilter) {
      // Criar data local para evitar problemas de fuso horário
      const [year, month, day] = dateFilter.split('-').map(Number);
      const filterDate = new Date(year, month - 1, day); // month - 1 porque JS usa 0-11
      const filterYear = filterDate.getFullYear();
      const filterMonth = filterDate.getMonth();
      const filterDay = filterDate.getDate();
      
      console.log('Filtrando por data:', { 
        filterDate, 
        filterYear, 
        filterMonth, 
        filterDay,
        filterDateString: filterDate.toISOString().split('T')[0]
      });
      
      filtered = filtered.filter(item => {
        const itemDate = new Date(item.createdAt);
        const itemYear = itemDate.getFullYear();
        const itemMonth = itemDate.getMonth();
        const itemDay = itemDate.getDate();
        
        const matches = itemYear === filterYear && itemMonth === filterMonth && itemDay === filterDay;
        
        console.log('Verificando request:', {
          createdAt: item.createdAt,
          itemDate: itemDate.toISOString(),
          itemYear,
          itemMonth,
          itemDay,
          filterYear,
          filterMonth,
          filterDay,
          matches,
          action: item.action
        });
        
        return matches;
      });
    }

    // Filtro por ação (nome técnico e label amigável)
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

  const act = async (id, op) => {
    const token = getToken();
    const response = await axios.post(`${apiUrl}/requests/${id}/${op}`, {}, { headers: { Authorization: `Bearer ${token}` } });
    console.log('Request atualizado:', response.data);
    await load();
    // Recarregar requests completos se estivermos na aba requests
    if (tab === 'requests') {
      const updatedRequests = await loadAllRequests();
      console.log('Requests recarregados:', updatedRequests);
      setAllRequests(updatedRequests);
    }
  };

  const clearFilters = () => {
    setRequesterFilter('');
    setDateFilter('');
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
    if (action === 'cadastrar_cativeiro') {
      const fazenda = fazendas.find(f => f._id === payload.fazendaId);
      const tipoCamarao = tiposCamarao.find(t => t._id === payload.id_tipo_camarao);
      
      return (
        <div style={{ 
          background: '#f8fafc', 
          padding: 12, 
          borderRadius: 6, 
          marginTop: 8,
          border: '1px solid #e2e8f0'
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <strong>Nome:</strong> {payload.nome || 'N/A'}
            </div>
            <div>
              <strong>Fazenda:</strong> {fazenda ? `${fazenda.nome} - ${fazenda.codigo}` : payload.fazendaId || 'N/A'}
            </div>
            <div>
              <strong>Tipo de Camarão:</strong> {tipoCamarao ? tipoCamarao.nome : payload.id_tipo_camarao || 'N/A'}
            </div>
            <div>
              <strong>Data de Instalação:</strong> {payload.data_instalacao ? new Date(payload.data_instalacao).toLocaleDateString('pt-BR') : 'N/A'}
            </div>
            <div>
              <strong>Temp Ideal:</strong> {payload.temp_media_diaria ? `${payload.temp_media_diaria}°C` : 'N/A'}
            </div>
            <div>
              <strong>pH Ideal:</strong> {payload.ph_medio_diario || 'N/A'}
            </div>
            <div>
              <strong>Amônia Ideal:</strong> {payload.amonia_media_diaria ? `${payload.amonia_media_diaria} mg/L` : 'N/A'}
            </div>
          </div>
        </div>
      );
    } else if (action === 'editar_cativeiro') {
      const tipoCamarao = payload.id_tipo_camarao ? (tiposCamarao.find(t => t._id === payload.id_tipo_camarao) || null) : null;
      return (
        <div style={{ 
          background: '#f8fafc', 
          padding: 12, 
          borderRadius: 6, 
          marginTop: 8,
          border: '1px solid #e2e8f0'
        }}>
          <div><strong>Cativeiro ID:</strong> {payload.cativeiroId || 'N/A'}</div>
          {typeof payload.nome !== 'undefined' && (
            <div><strong>Novo Nome:</strong> {payload.nome || 'N/A'}</div>
          )}
          {typeof payload.id_tipo_camarao !== 'undefined' && (
            <div><strong>Novo Tipo de Camarão:</strong> {tipoCamarao ? tipoCamarao.nome : payload.id_tipo_camarao || 'N/A'}</div>
          )}
        </div>
      );
    } else if (action === 'editar_sensor') {
      return (
        <div style={{ 
          background: '#f8fafc', 
          padding: 12, 
          borderRadius: 6, 
          marginTop: 8,
          border: '1px solid #e2e8f0'
        }}>
          <div><strong>Sensor ID:</strong> {payload.id || 'N/A'}</div>
          <div><strong>Novo Apelido:</strong> {payload.apelido || 'N/A'}</div>
        </div>
      );
    } else {
      // Fallback para outras ações
      return (
        <pre style={{ 
          background: '#f9fafb', 
          padding: 8, 
          borderRadius: 4, 
          fontSize: '12px',
          marginTop: 4,
          overflow: 'auto',
          maxHeight: '200px'
        }}>
          {JSON.stringify(payload, null, 2)}
        </pre>
      );
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

  const changeRole = async (id, role) => {
    const token = getToken();
    await axios.patch(`${apiUrl}/users/${id}/role`, { role }, { headers: { Authorization: `Bearer ${token}` } });
    await load();
  };

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

  const ensureCativeirosForFazenda = async (fzId) => {
    // No-op: usamos os cativeiros já carregados em memória
    return;
  };

  const loadSensorsForCativeiro = async (cativeiroId) => {
    try {
      const token = getToken();
      const res = await axios.get(`${apiUrl}/cativeiros/${cativeiroId}/sensores`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const raw = Array.isArray(res.data) ? res.data : [];
      const sensores = raw.map(item => item?.id_sensor || item).filter(Boolean);
      setCativeiros(prev => prev.map(c => c._id === cativeiroId ? { ...c, sensores } : c));
    } catch (e) {
      // mantém estado atual; não quebra UI
    }
  };

  const loadDietaAtual = async (cativeiroId) => {
    try {
      const res = await axios.get(`${apiUrl}/dietas/atual/${cativeiroId}`);
      const data = res?.data || null;
      setCativeiroDieta(prev => ({ ...prev, [cativeiroId]: data }));
      if (data) {
        setDietaEditsByCat(prev => ({ ...prev, [cativeiroId]: { descricao: data.descricao || '', quantidade: data.quantidade || '' } }));
      }
    } catch {
      setCativeiroDieta(prev => ({ ...prev, [cativeiroId]: null }));
    }
  };

  const upsertDietaForCativeiro = async (cativeiroId) => {
    try {
      const token = getToken();
      const headers = { Authorization: `Bearer ${token}` };
      const atual = cativeiroDieta[cativeiroId];
      const edits = dietaEditsByCat[cativeiroId] || { descricao: '', quantidade: '' };
      if (atual && atual.dietaId) {
        await axios.put(`${apiUrl}/dietas/${atual.dietaId}`, { descricao: edits.descricao, quantidade: edits.quantidade }, { headers });
      } else {
        const d = await axios.post(`${apiUrl}/dietas`, { descricao: edits.descricao, quantidade: edits.quantidade }, { headers });
        const dietaId = d?.data?._id;
        await axios.post(`${apiUrl}/dietas/assign/${cativeiroId}`, { dietaId, ativo: true }, { headers });
      }
      await loadDietaAtual(cativeiroId);
      alert('Dieta atualizada.');
    } catch (e) {
      alert('Erro ao atualizar dieta: ' + (e?.response?.data?.error || e.message));
    }
  };

  const getFazendaName = (id) => {
    const idStr = String(id);
    const f = fazendas.find(fz => String(fz._id) === idStr);
    if (!f) return 'Sem fazenda';
    return f.nome && f.codigo ? `${f.nome} - ${f.codigo}` : (f.nome || f.codigo || id);
  };

  const updateCativeiroNome = async (id, nome) => {
    const token = getToken();
    await axios.patch(`${apiUrl}/cativeiros/${id}`, { nome }, { headers: { Authorization: `Bearer ${token}` } });
    await load();
  };

  const deleteCativeiro = async (id) => {
    const token = getToken();
    await axios.delete(`${apiUrl}/cativeiros/${id}`, { headers: { Authorization: `Bearer ${token}` } });
    await load();
  };

  const openCreateModal = (presetFazendaId, presetNome) => {
    const defaultFz = String(presetFazendaId || fazendas[0]?._id || '');
    const defaultTipo = (Array.isArray(tiposCamarao) && tiposCamarao.length > 0) ? String(tiposCamarao[0]._id) : '';
    setCreateForm({
      fazendaId: defaultFz,
      nome: (presetNome && presetNome.trim()) ? presetNome.trim() : '',
      id_tipo_camarao: defaultTipo,
      data_instalacao: new Date().toISOString().slice(0,10),
      temp_media_diaria: '',
      ph_medio_diario: '',
      amonia_media_diaria: '',
      fotoFile: null
    });
    setShowCreateModal(true);
  };

  const createCativeiro = async (fazendaId, nome) => {
    try {
      const token = getToken();
      const tipoDefault = (Array.isArray(tiposCamarao) && tiposCamarao.length > 0) ? tiposCamarao[0]._id : null;
      if (!tipoDefault) {
        alert('Não foi possível obter o tipo de camarão. Recarregue a página.');
        return;
      }
      const payload = {
        fazendaId,
        nome: nome && nome.trim() ? nome.trim() : 'Novo cativeiro',
        id_tipo_camarao: tipoDefault,
        data_instalacao: new Date().toISOString(),
        // Campos opcionais: o backend já trata valores ausentes
        temp_media_diaria: '',
        ph_medio_diario: '',
        amonia_media_diaria: ''
      };
      await axios.post(`${apiUrl}/cativeiros`, payload, { headers: { Authorization: `Bearer ${token}` } });
      await load();
      // manter a fazenda expandida e limpar input
      setExpandedFazenda(prev => ({ ...prev, [String(fazendaId)]: true }));
      const input = document.getElementById(`novo-c-${fazendaId}`);
      if (input) input.value = '';
    } catch (e) {
      console.error('Falha ao criar cativeiro:', e);
      alert('Erro ao criar cativeiro. Verifique os dados e tente novamente.');
    }
  };

  const submitCreateModal = async () => {
    try {
      const token = getToken();
      const form = new FormData();
      form.append('fazendaId', createForm.fazendaId);
      form.append('nome', createForm.nome && createForm.nome.trim() ? createForm.nome.trim() : 'Novo cativeiro');
      form.append('id_tipo_camarao', createForm.id_tipo_camarao);
      form.append('data_instalacao', new Date(createForm.data_instalacao).toISOString());
      if (createForm.temp_media_diaria) form.append('temp_media_diaria', createForm.temp_media_diaria);
      if (createForm.ph_medio_diario) form.append('ph_medio_diario', createForm.ph_medio_diario);
      if (createForm.amonia_media_diaria) form.append('amonia_media_diaria', createForm.amonia_media_diaria);
      if (createForm.fotoFile) form.append('foto_cativeiro', createForm.fotoFile);
      if (createForm.dietaAtivar && (createForm.dietaDescricao || createForm.dietaQuantidade)) {
        // master pode mandar dieta_texto para criar e atribuir imediatamente
        form.append('dieta_texto', `${createForm.dietaDescricao} (${createForm.dietaQuantidade} g)`);
      }

      await axios.post(`${apiUrl}/cativeiros`, form, { headers: { Authorization: `Bearer ${token}` } });
      setShowCreateModal(false);
      await load();
      setExpandedFazenda(prev => ({ ...prev, [String(createForm.fazendaId)]: true }));
    } catch (e) {
      console.error('Falha ao criar cativeiro:', e);
      alert('Erro ao criar cativeiro. Verifique os dados e tente novamente.');
    }
  };

  const localRole = typeof window !== 'undefined' ? (JSON.parse(sessionStorage.getItem('usuarioCamarize') || localStorage.getItem('usuarioCamarize') || '{}')?.role) : undefined;
  const effectiveRole = user?.role || localRole;
  if (authLoading || loading) return <div style={{ padding: 20 }}>Carregando...</div>;
  if (!isAuthenticated) return <div style={{ padding: 20, color: 'red' }}>Sessão expirada. Faça login novamente.</div>;
  if (!effectiveRole) return <div style={{ padding: 20 }}>Carregando permissões...</div>;
  if (effectiveRole !== 'master') return <div style={{ padding: 20, color: 'red' }}>Acesso restrito ao Master.</div>;
  if (error) return <div style={{ padding: 20, color: 'red' }}>{error}</div>;

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2>Painel Master</h2>
        <button
          onClick={() => {
            try {
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
        <button onClick={() => setTab('usuarios')} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #ddd', background: tab==='usuarios'?'#eef':'#fff' }}>Usuários</button>
        <button onClick={() => setTab('cativeiros')} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #ddd', background: tab==='cativeiros'?'#eef':'#fff' }}>Cativeiros</button>
        <button onClick={() => setTab('sensores')} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #ddd', background: tab==='sensores'?'#eef':'#fff' }}>Sensores</button>
        <button onClick={() => setTab('dietas')} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #ddd', background: tab==='dietas'?'#eef':'#fff' }}>Dietas</button>
        <button onClick={() => setTab('chat')} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #ddd', background: tab==='chat'?'#eef':'#fff' }}>Chat</button>
      </div>

      {tab === 'requests' && (
        <section>
          <h3>Histórico de Requests dos Admins</h3>
          
          {/* Filtros */}
          <div style={{ 
            display: 'flex', 
            gap: 12, 
            marginBottom: 16, 
            padding: 12, 
            background: '#f9fafb', 
            borderRadius: 8,
            alignItems: 'center',
            flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontSize: '14px', fontWeight: '500' }}>Solicitante:</label>
              <input
                type="text"
                placeholder="Nome ou email..."
                value={requesterFilter}
                onChange={(e) => setRequesterFilter(e.target.value)}
                style={{ 
                  padding: '6px 10px', 
                  border: '1px solid #d1d5db', 
                  borderRadius: 6, 
                  fontSize: '14px',
                  minWidth: '200px'
                }}
              />
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontSize: '14px', fontWeight: '500' }}>Data:</label>
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                style={{ 
                  padding: '6px 10px', 
                  border: '1px solid #d1d5db', 
                  borderRadius: 6, 
                  fontSize: '14px'
                }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontSize: '14px', fontWeight: '500' }}>Ação:</label>
              <input
                type="text"
                placeholder="Ex: editar_cativeiro..."
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                style={{ 
                  padding: '6px 10px', 
                  border: '1px solid #d1d5db', 
                  borderRadius: 6, 
                  fontSize: '14px',
                  minWidth: '200px'
                }}
              />
            </div>
            
            <button
              onClick={() => {
                const today = new Date();
                const todayString = today.toISOString().split('T')[0];
                console.log('Data de hoje:', { today, todayString, day: today.getDate(), month: today.getMonth() + 1, year: today.getFullYear() });
                setDateFilter(todayString);
              }}
              style={{
                padding: '6px 12px',
                background: '#3b82f6',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Hoje
            </button>
            
            <button
              onClick={() => { clearFilters(); setActionFilter(''); }}
              style={{
                padding: '6px 12px',
                background: '#6b7280',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Limpar Filtros
            </button>
            
            <div style={{ fontSize: '14px', color: '#6b7280' }}>
              {filteredRequests.length} de {allRequests.length} requests
            </div>
          </div>

          {filteredRequests.length === 0 && allRequests.length > 0 && (
            <div style={{ textAlign: 'center', padding: 20, color: '#6b7280' }}>
              Nenhum request encontrado com os filtros aplicados.
            </div>
          )}
          
          {filteredRequests.length === 0 && allRequests.length === 0 && (
            <div style={{ textAlign: 'center', padding: 20, color: '#6b7280' }}>
              Nenhum request encontrado.
            </div>
          )}
          
          {filteredRequests.map(item => (
              <div key={item._id} style={{ 
                border: '1px solid #eee', 
                padding: 12, 
                marginBottom: 10,
                borderRadius: 6,
                background: item.status === 'approved' ? '#f0f9ff' : item.status === 'rejected' ? '#fef2f2' : '#fff'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div>
                    <strong>Solicitante:</strong> {item.requesterUser?.nome || 'N/A'} ({item.requesterUser?.email || 'N/A'})
                  </div>
                  <div style={{ 
                    padding: '4px 8px', 
                    borderRadius: 4, 
                    fontSize: '12px',
                    background: item.status === 'aprovado' ? '#dcfce7' : item.status === 'recusado' ? '#fee2e2' : '#fef3c7',
                    color: item.status === 'aprovado' ? '#166534' : item.status === 'recusado' ? '#991b1b' : '#92400e'
                  }}>
                    {item.status === 'aprovado' ? '✅ Aprovado' : 
                     item.status === 'recusado' ? '❌ Recusado' : 
                     '⏳ Pendente'}
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
                {item.status === 'pendente' && (
                  <div style={{ marginTop: 8 }}>
                    <button 
                      onClick={() => act(item._id, 'approve')}
                      style={{ 
                        background: '#10b981', 
                        color: '#fff', 
                        border: 'none', 
                        padding: '6px 12px', 
                        borderRadius: 4, 
                        cursor: 'pointer',
                        marginRight: 8
                      }}
                    >
                      Aprovar
                    </button>
                    <button 
                      onClick={() => act(item._id, 'reject')}
                      style={{ 
                        background: '#ef4444', 
                        color: '#fff', 
                        border: 'none', 
                        padding: '6px 12px', 
                        borderRadius: 4, 
                        cursor: 'pointer'
                      }}
                    >
                      Recusar
                    </button>
                  </div>
                )}
              </div>
            ))}
        </section>
      )}

      {tab === 'solicitacoes' && (
        <section>
          <h3>Solicitações pesadas (Admins)</h3>
          {items.length === 0 && <div>Nenhuma solicitação pendente.</div>}
          {items.map(item => (
            <div key={item._id} style={{ border: '1px solid #eee', padding: 12, marginBottom: 10, borderRadius: 6 }}>
              <div style={{ marginBottom: 8 }}>
                <div><b>Ação:</b> {item.action}</div>
                <div><b>Tipo:</b> {item.type}</div>
                <div><b>Data:</b> {new Date(item.createdAt).toLocaleString('pt-BR')}</div>
              </div>
              {item.payload && Object.keys(item.payload).length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <strong>Detalhes:</strong>
                  {formatRequestDetails(item.action, item.payload)}
                </div>
              )}
              <div>
                <button 
                  onClick={() => act(item._id, 'approve')}
                  style={{ 
                    background: '#10b981', 
                    color: '#fff', 
                    border: 'none', 
                    padding: '6px 12px', 
                    borderRadius: 4, 
                    cursor: 'pointer',
                    marginRight: 8
                  }}
                >
                  Aprovar
                </button>
                <button 
                  onClick={() => act(item._id, 'reject')}
                  style={{ 
                    background: '#ef4444', 
                    color: '#fff', 
                    border: 'none', 
                    padding: '6px 12px', 
                    borderRadius: 4, 
                    cursor: 'pointer'
                  }}
                >
                  Recusar
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {tab === 'usuarios' && (
        <section>
          <h3>Usuários</h3>
          {users.map(u => (
            <div key={u.id} style={{ border: '1px solid #eee', padding: 12, marginBottom: 10 }}>
              <div><b>{u.nome}</b> — {u.email} — Role atual: {u.role}</div>
              <select value={u.role} onChange={(e) => changeRole(u.id, e.target.value)}>
                <option value="membro">membro</option>
                <option value="admin">admin</option>
                <option value="master">master</option>
              </select>
            </div>
          ))}
        </section>
      )}

      {tab === 'cativeiros' && (
        <section>
          <h3>Fazendas e Cativeiros</h3>
          {/* Criar cativeiro (abre modal) */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '12px 0' }}>
            <button onClick={() => openCreateModal()} style={{ border: '1px solid #eee', background: '#fff', borderRadius: 6, padding: '6px 10px', cursor: 'pointer' }}>Criar cativeiro</button>
          </div>
          {(() => {
            const grouped = groupedByFazenda();
            const hasAny = Object.values(grouped).some(arr => Array.isArray(arr) && arr.length > 0);
            if (!hasAny && Array.isArray(cativeiros) && cativeiros.length > 0) {
              // Fallback: renderizar lista simples como em /home
              return (
                <div style={{ border: '1px solid #eee', borderRadius: 8, padding: 10 }}>
                  {cativeiros.map(c => (
                    <div key={c._id} style={{ border: '1px solid #f3f4f6', borderRadius: 6, padding: 10, marginBottom: 8 }}>
                      <div style={{ fontWeight: 600 }}>{c.nome || c._id}</div>
                      <div style={{ color: '#6b7280', fontSize: 13 }}>{c.id_tipo_camarao?.nome || c.id_tipo_camarao || '—'}</div>
                    </div>
                  ))}
                </div>
              );
            }
            return Object.entries(grouped).map(([fzId, cats]) => (
            <div key={fzId} style={{ border: '1px solid #eee', borderRadius: 8, marginBottom: 10 }}>
              <div
                onClick={() => {
                  const willExpand = !expandedFazenda[fzId];
                  setExpandedFazenda(prev => ({ ...prev, [fzId]: willExpand }));
                  if (willExpand) ensureCativeirosForFazenda(fzId);
                }}
                style={{ padding: 10, cursor: 'pointer', background: '#f9fafb', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between' }}
              >
                <span>{getFazendaName(fzId)}</span>
                <span>{expandedFazenda[fzId] ? '▲' : '▼'}</span>
              </div>
              {expandedFazenda[fzId] && (
                <div style={{ padding: 10 }}>
                  {(((Array.isArray(cativeirosByFazenda[fzId]) && cativeirosByFazenda[fzId].length > 0) ? cativeirosByFazenda[fzId] : cats) || []).map(c => (
                    <div key={c._id} style={{ border: '1px solid #eee', borderRadius: 6, marginBottom: 8 }}>
                      <div
                        onClick={() => {
                          const will = !expandedCativeiro[c._id];
                          setExpandedCativeiro(prev => ({ ...prev, [c._id]: will }));
                          if (will) {
                            if (!(Array.isArray(c.sensores) && c.sensores.length)) {
                              loadSensorsForCativeiro(c._id);
                            }
                            if (!cativeiroDieta[c._id]) {
                              loadDietaAtual(c._id);
                            }
                          }
                        }}
                        style={{ padding: 8, cursor: 'pointer', background: '#fff', display: 'flex', justifyContent: 'space-between' }}
                      >
                        <span>{c.nome || c._id}</span>
                        <span>{expandedCativeiro[c._id] ? '▲' : '▼'}</span>
                      </div>
                      {expandedCativeiro[c._id] && (
                        <div style={{ padding: 10 }}>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                            <div style={{ flex: 1 }} />
                            <button onClick={() => {
                              setEditForm({
                                id: c._id,
                                fazendaId: String(c.fazenda?._id || c.fazenda || ''),
                                nome: c.nome || '',
                                id_tipo_camarao: String(c.id_tipo_camarao?._id || c.id_tipo_camarao || ''),
                                data_instalacao: c.data_instalacao ? new Date(c.data_instalacao).toISOString().slice(0,10) : new Date().toISOString().slice(0,10),
                                temp_media_diaria: c.condicoes_ideais?.temp_ideal || c.temp_media_diaria || '',
                                ph_medio_diario: c.condicoes_ideais?.ph_ideal || c.ph_medio_diario || '',
                                amonia_media_diaria: c.condicoes_ideais?.amonia_ideal || c.amonia_media_diaria || '',
                                fotoFile: null
                              });
                              setShowEditModal(true);
                            }} style={{ border: '1px solid #ddd', background: '#f9fafb', borderRadius: 6, padding: '6px 10px', cursor: 'pointer' }}>Alterar</button>
                            <button onClick={() => deleteCativeiro(c._id)} style={{ border: '1px solid #fca5a5', background: '#fee2e2', borderRadius: 6, padding: '6px 10px', cursor: 'pointer' }}>Excluir</button>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            <div><b>Tipo de camarão:</b> {c.id_tipo_camarao?.nome || c.id_tipo_camarao || '—'}</div>
                            <div><b>Data instalação:</b> {c.data_instalacao ? new Date(c.data_instalacao).toLocaleDateString('pt-BR') : '—'}</div>
                            <div><b>Temp ideal:</b> {c.condicoes_ideais?.temp_ideal || c.temp_media_diaria || '—'}</div>
                            <div><b>pH ideal:</b> {c.condicoes_ideais?.ph_ideal || c.ph_medio_diario || '—'}</div>
                            <div><b>Amônia ideal:</b> {c.condicoes_ideais?.amonia_ideal || c.amonia_media_diaria || '—'}</div>
                          </div>
                          <div style={{ marginTop: 10 }}>
                            <div style={{ fontWeight: 700, marginBottom: 6 }}>Sensores</div>
                            {Array.isArray(c.sensores) && c.sensores.length > 0 ? (
                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                {c.sensores.map(s => (
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
                                    }}>{(s.id_tipo_sensor || 'sensor')}</span>
                                    <span style={{ fontWeight: 600 }}>{s.apelido || '—'}</span>
                                    <button onClick={async () => {
                                      try {
                                        const token = getToken();
                                        await axios.delete(`${apiUrl}/sensoresxCativeiros`, {
                                          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                                          data: { id_sensor: s._id || s.id, id_cativeiro: c._id }
                                        });
                                        // Atualiza estado local removendo o sensor
                                        setCativeiros(prev => prev.map(cat => cat._id === c._id ? { ...cat, sensores: (cat.sensores || []).filter(x => (x._id || x.id) !== (s._id || s.id)) } : cat));
                                      } catch (e) {
                                        alert('Erro ao desvincular sensor: ' + (e?.response?.data?.message || e.message));
                                      }
                                    }} style={{ marginLeft: 6, border: '1px solid #fca5a5', background: '#fee2e2', color: '#991b1b', borderRadius: 999, padding: '2px 6px', cursor: 'pointer' }}>Desvincular</button>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div style={{ color: '#6b7280' }}>Nenhum sensor relacionado</div>
                            )}
                          </div>
                          <div style={{ marginTop: 12 }}>
                            <div style={{ fontWeight: 700, marginBottom: 6 }}>Dieta</div>
                            <div style={{ marginBottom: 6, padding: 8, border: '1px dashed #e5e7eb', borderRadius: 6, background: '#fafafa' }}>
                              {cativeiroDieta[c._id] === undefined && <span style={{ color: '#6b7280' }}>Carregando...</span>}
                              {cativeiroDieta[c._id] === null && <span style={{ color: '#6b7280' }}>Nenhuma dieta ativa.</span>}
                              {cativeiroDieta[c._id] && (
                                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                                  <div><b>Descrição:</b> {cativeiroDieta[c._id].descricao || '—'}</div>
                                  <div><b>Qtd (g):</b> {typeof cativeiroDieta[c._id].quantidade !== 'undefined' ? cativeiroDieta[c._id].quantidade : '—'}</div>
                                </div>
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                              <input
                                value={(dietaEditsByCat[c._id]?.descricao) || ''}
                                onChange={(e) => setDietaEditsByCat(prev => ({ ...prev, [c._id]: { ...(prev[c._id] || {}), descricao: e.target.value } }))}
                                placeholder="Descrição"
                                style={{ flex: 1, minWidth: 220, padding: '6px 8px', border: '1px solid #ddd', borderRadius: 6 }}
                              />
                              <input
                                type="number" step="0.01"
                                value={(dietaEditsByCat[c._id]?.quantidade) || ''}
                                onChange={(e) => setDietaEditsByCat(prev => ({ ...prev, [c._id]: { ...(prev[c._id] || {}), quantidade: e.target.value } }))}
                                placeholder="Quantidade (g)"
                                style={{ width: 160, padding: '6px 8px', border: '1px solid #ddd', borderRadius: 6 }}
                              />
                              <button onClick={() => upsertDietaForCativeiro(c._id)} style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}>Atualizar</button>
                              <button onClick={() => loadDietaAtual(c._id)} style={{ background: '#6b7280', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}>Recarregar</button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {loadingFazenda[fzId] && <div style={{ fontSize: 12, color: '#666' }}>Carregando cativeiros...</div>}
                </div>
              )}
            </div>
            ));
          })()}
        </section>
      )}

      {tab === 'sensores' && (
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3>Gerenciar Sensores</h3>
            <button onClick={() => setShowCreateSensor(true)} style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 6, cursor: 'pointer', fontSize: '14px' }}>Novo sensor</button>
          </div>
          {sensores.length === 0 && <div style={{ color: '#888' }}>Nenhum sensor cadastrado.</div>}
          {sensores.map(s => (
            <div key={s._id} style={{ border: '1px solid #eee', borderRadius: 8, padding: 12, marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div><b>Tipo:</b> {s.id_tipo_sensor}</div>
                  <div><b>Apelido:</b> {s.apelido || '—'}</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setSensorForm({ id: s._id, id_tipo_sensor: s.id_tipo_sensor, apelido: s.apelido || '', fotoFile: null }) || setShowCreateSensor(true)} style={{ border: '1px solid #ddd', background: '#fff', borderRadius: 6, padding: '6px 10px', cursor: 'pointer' }}>Editar</button>
                  <button onClick={() => {
                    setLinkForm({ sensorId: s._id, cativeiroId: '', currentSensorIds: [] });
                    setShowLinkModal(true);
                  }} style={{ border: '1px solid #ddd', background: '#fff', borderRadius: 6, padding: '6px 10px', cursor: 'pointer' }}>Relacionar</button>
                </div>
              </div>
            </div>
          ))}
        </section>
      )}

      {tab === 'dietas' && (
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3>Gerenciar Dietas</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={dietaForm.descricao} onChange={(e) => setDietaForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Descrição" style={{ padding: '6px 8px', border: '1px solid #ddd', borderRadius: 6, minWidth: 240 }} />
              <input type="number" step="0.01" value={dietaForm.quantidade} onChange={(e) => setDietaForm(f => ({ ...f, quantidade: e.target.value }))} placeholder="Quantidade (g)" style={{ width: 160, padding: '6px 8px', border: '1px solid #ddd', borderRadius: 6 }} />
              <button onClick={async () => {
                try {
                  const token = getToken();
                  const headers = { Authorization: `Bearer ${token}` };
                  await axios.post(`${apiUrl}/dietas`, { descricao: dietaForm.descricao, quantidade: dietaForm.quantidade }, { headers });
                  setDietaForm({ descricao: '', quantidade: '' });
                  await load();
                } catch (e) {
                  alert('Erro ao salvar dieta: ' + (e?.response?.data?.error || e.message));
                }
              }} style={{ background: '#10b981', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}>Criar</button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <h4>Lista de Dietas</h4>
              {dietas.length === 0 && <div style={{ color: '#888' }}>Nenhuma dieta cadastrada.</div>}
              {dietas.map(d => (
                <div key={d._id} style={{ border: '1px solid #eee', borderRadius: 8, padding: 10, marginBottom: 8 }}>
                  {editingDietaId === d._id ? (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1 }}>
                        <input value={editingDieta.descricao} onChange={(e) => setEditingDieta(v => ({ ...v, descricao: e.target.value }))} placeholder="Descrição" style={{ flex: 1, padding: '6px 8px', border: '1px solid #ddd', borderRadius: 6 }} />
                        <input type="number" step="0.01" value={editingDieta.quantidade} onChange={(e) => setEditingDieta(v => ({ ...v, quantidade: e.target.value }))} placeholder="Quantidade (g)" style={{ width: 160, padding: '6px 8px', border: '1px solid #ddd', borderRadius: 6 }} />
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={async () => {
                          try {
                            const token = getToken();
                            const headers = { Authorization: `Bearer ${token}` };
                            await axios.put(`${apiUrl}/dietas/${editingDietaId}`, { descricao: editingDieta.descricao, quantidade: editingDieta.quantidade }, { headers });
                            setEditingDietaId('');
                            setEditingDieta({ descricao: '', quantidade: '' });
                            await load();
                          } catch (e) {
                            alert('Erro ao salvar edição: ' + (e?.response?.data?.error || e.message));
                          }
                        }} style={{ border: 'none', background: '#3b82f6', color: '#fff', borderRadius: 6, padding: '6px 10px', cursor: 'pointer' }}>Salvar</button>
                        <button onClick={() => { setEditingDietaId(''); setEditingDieta({ descricao: '', quantidade: '' }); }} style={{ border: '1px solid #ddd', background: '#fff', borderRadius: 6, padding: '6px 10px', cursor: 'pointer' }}>Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div><b>{d.descricao || '—'}</b> — {typeof d.quantidade !== 'undefined' ? `${d.quantidade} g` : '—'}</div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => { setEditingDietaId(d._id); setEditingDieta({ descricao: d.descricao || '', quantidade: d.quantidade || '' }); }} style={{ border: '1px solid #ddd', background: '#fff', borderRadius: 6, padding: '6px 10px', cursor: 'pointer' }}>Editar</button>
                        <button onClick={async () => {
                      try {
                        const token = getToken();
                        const headers = { Authorization: `Bearer ${token}` };
                        await axios.delete(`${apiUrl}/dietas/${d._id}`, { headers });
                        await load();
                      } catch (e) {
                        alert('Erro ao excluir: ' + (e?.response?.data?.error || e.message));
                      }
                        }} style={{ border: '1px solid #fca5a5', background: '#fee2e2', color: '#991b1b', borderRadius: 6, padding: '6px 10px', cursor: 'pointer' }}>Excluir</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div>
              <h4>Atribuir Dieta a Cativeiro</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
                <select value={assignForm.cativeiroId} onChange={(e) => setAssignForm(f => ({ ...f, cativeiroId: e.target.value }))} style={{ padding: 8, border: '1px solid #ddd', borderRadius: 6 }}>
                  <option value="">Selecione cativeiro</option>
                  {cativeiros.map(c => (
                    <option key={c._id} value={c._id}>{c.nome || c._id}</option>
                  ))}
                </select>
                <select value={assignForm.dietaId} onChange={(e) => setAssignForm(f => ({ ...f, dietaId: e.target.value }))} style={{ padding: 8, border: '1px solid #ddd', borderRadius: 6 }}>
                  <option value="">Selecione dieta</option>
                  {dietas.map(d => (
                    <option key={d._id} value={d._id}>{d.descricao || d._id}</option>
                  ))}
                </select>
                <button onClick={async () => {
                  try {
                    const token = getToken();
                    const headers = { Authorization: `Bearer ${token}` };
                    if (!assignForm.cativeiroId || !assignForm.dietaId) { alert('Selecione cativeiro e dieta.'); return; }
                    await axios.post(`${apiUrl}/dietas/assign/${assignForm.cativeiroId}`, { dietaId: assignForm.dietaId, ativo: true }, { headers });
                    alert('Dieta atribuída!');
                  } catch (e) {
                    alert('Erro ao atribuir: ' + (e?.response?.data?.error || e.message));
                  }
                }} style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: 6, cursor: 'pointer' }}>Atribuir</button>
              </div>
            </div>
          </div>
        </section>
      )}

      {tab === 'chat' && (
        <section>
          <h3>Chat com Admins</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 12 }}>
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
                <label style={{ display: 'block', fontSize: 12, color: '#6b7280' }}>Iniciar com Admin</label>
                <select onChange={(e) => { const val = e.target.value; if (val) { startConversationWithAdmin(val); e.target.value=''; } }} style={{ width: '100%', padding: 6, border: '1px solid #ddd', borderRadius: 6 }}>
                  <option value="">Selecione um admin...</option>
                  {(users || []).filter(u => u.role === 'admin').map(u => (
                    <option key={u.id || u._id} value={u.id || u._id}>{u.nome || u.email}</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ border: '1px solid #eee', borderRadius: 8, display: 'flex', flexDirection: 'column', height: '65vh', overflow: 'hidden' }}>
              <div style={{ padding: 8, background: '#f9fafb', borderBottom: '1px solid #eee', fontWeight: 600, display: 'flex', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>Mensagens</div>
                {chatSelectedId && (
                  <div style={{ position: 'relative' }}>
                    <button
                      aria-label="Ações do chat"
                      title="Mais ações"
                      onClick={() => setShowChatMenu(v => !v)}
                      style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 4 }}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="5" r="1.5" fill="#111827" />
                        <circle cx="12" cy="12" r="1.5" fill="#111827" />
                        <circle cx="12" cy="19" r="1.5" fill="#111827" />
                      </svg>
                    </button>
                    {showChatMenu && (
                      <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 6, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.08)', minWidth: 180, zIndex: 10 }}>
                        <button
                          onClick={async () => {
                            try {
                              setShowChatMenu(false);
                              if (!confirm('Apagar toda a conversa? Esta ação não pode ser desfeita.')) return;
                              const token = getToken();
                              const headers = { Authorization: `Bearer ${token}` };
                              await axios.delete(`${apiUrl}/chat/conversations/${chatSelectedId}`, { headers });
                              // Remove da lista local e limpa mensagens
                              setChatConversations(prev => prev.filter(c => c._id !== chatSelectedId));
                              setChatSelectedId('');
                              setChatMessages([]);
                            } catch (e) {
                              alert('Erro ao apagar conversa: ' + (e?.response?.data?.error || e.message));
                            }
                          }}
                          style={{ display: 'block', width: '100%', padding: '10px 12px', background: 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer' }}
                        >
                          Apagar conversa
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div style={{ flex: 1, padding: 10, display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto', overscrollBehavior: 'contain', scrollbarWidth: 'none' }}>
                {chatSelectedId && chatMessages.map(m => {
                  const isMine = String(m.senderId) === String(getMyId());
                  return (
                    <div key={m._id} style={{ alignSelf: isMine ? 'flex-end' : 'flex-start', maxWidth: '70%' }}>
                      <div style={{ fontSize: 11, color: '#6b7280', margin: isMine ? '0 4px 2px 0' : '0 0 2px 4px', textAlign: isMine ? 'right' : 'left' }}>
                        {getDisplayName(m.senderId)}
                      </div>
                      <div style={{ background: isMine ? '#d1fae5' : '#f3f4f6', color: '#111827', border: '1px solid #e5e7eb', padding: '8px 10px', borderRadius: 10, borderTopRightRadius: isMine ? 2 : 10, borderTopLeftRadius: isMine ? 10 : 2 }}>
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
                <button onClick={sendChatMessage} disabled={!chatSelectedId || !chatText.trim()} style={{ padding: 8, background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, cursor: (!chatSelectedId || !chatText.trim()) ? 'not-allowed' : 'pointer' }}>Enviar</button>
              </div>
            </div>
          </div>
        </section>
      )}

      {showCreateSensor && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', padding: 20, borderRadius: 8, width: '95%', maxWidth: 480 }}>
            <h3 style={{ marginTop: 0 }}>{sensorForm?.id ? 'Editar sensor' : 'Novo sensor'}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Tipo de sensor</label>
                <select value={sensorForm.id_tipo_sensor} onChange={(e) => setSensorForm(f => ({ ...f, id_tipo_sensor: e.target.value }))} style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 6 }}>
                  <option value="temperatura">temperatura</option>
                  <option value="ph">ph</option>
                  <option value="amonia">amonia</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Apelido</label>
                <input value={sensorForm.apelido} onChange={(e) => setSensorForm(f => ({ ...f, apelido: e.target.value }))} placeholder="ex: Sensor A" style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 6 }} />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Imagem (opcional)</label>
                <input type="file" accept="image/*" onChange={(e) => setSensorForm(f => ({ ...f, fotoFile: e.target.files?.[0] || null }))} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              <button onClick={() => setShowCreateSensor(false)} style={{ border: '1px solid #d1d5db', background: '#fff', borderRadius: 6, padding: '6px 10px', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={async () => {
                try {
                  const token = getToken();
                  if (sensorForm?.id) {
                    const form = new FormData();
                    form.append('id_tipo_sensor', sensorForm.id_tipo_sensor);
                    form.append('apelido', sensorForm.apelido || '');
                    if (sensorForm.fotoFile) form.append('foto_sensor', sensorForm.fotoFile);
                    await axios.put(`${apiUrl}/sensores/${sensorForm.id}`, form, { headers: { Authorization: `Bearer ${token}` } });
                  } else {
                    const form = new FormData();
                    form.append('id_tipo_sensor', sensorForm.id_tipo_sensor);
                    form.append('apelido', sensorForm.apelido || '');
                    if (sensorForm.fotoFile) form.append('foto_sensor', sensorForm.fotoFile);
                    await axios.post(`${apiUrl}/sensores`, form, { headers: { Authorization: `Bearer ${token}` } });
                  }
                  setShowCreateSensor(false);
                  await load();
                  setTab('sensores');
                } catch (e) {
                  alert('Erro ao salvar sensor: ' + (e?.response?.data?.error || e.message));
                }
              }} style={{ border: 'none', background: '#10b981', color: '#fff', borderRadius: 6, padding: '8px 12px', cursor: 'pointer' }}>{sensorForm?.id ? 'Salvar' : 'Criar'}</button>
            </div>
          </div>
        </div>
      )}

      {showLinkModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', padding: 20, borderRadius: 8, width: '95%', maxWidth: 480 }}>
            <h3 style={{ marginTop: 0 }}>Relacionar sensor a cativeiro</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Cativeiro</label>
                <select value={linkForm.cativeiroId} onChange={(e) => setLinkForm(f => ({ ...f, cativeiroId: e.target.value }))} style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 6 }}>
                  <option value="">Selecione</option>
                  {cativeiros.map(c => (
                    <option key={c._id} value={c._id}>{c.nome || c._id}</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              <button onClick={() => setShowLinkModal(false)} style={{ border: '1px solid #d1d5db', background: '#fff', borderRadius: 6, padding: '6px 10px', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={async () => {
                try {
                  const token = getToken();
                  const cId = linkForm.cativeiroId;
                  // Master aplica diretamente a relação criando SensoresxCativeiros
                  await axios.post(`${apiUrl}/sensoresxCativeiros`, { id_sensor: linkForm.sensorId, id_cativeiro: cId }, { headers: { Authorization: `Bearer ${token}` } });
                  setShowLinkModal(false);
                  // Recarrega listas básicas
                  await load();
                  // Abre a aba de cativeiros
                  setTab('cativeiros');
                  // Expande automaticamente o cativeiro e carrega seus sensores
                  setExpandedCativeiro(prev => ({ ...prev, [String(cId)]: true }));
                  try {
                    const cat = (Array.isArray(cativeiros) ? cativeiros : []).find(x => String(x._id) === String(cId));
                    const fzId = String(cat?.fazenda?._id || cat?.fazenda || '');
                    if (fzId) {
                      setExpandedFazenda(prev => ({ ...prev, [fzId]: true }));
                    }
                  } catch {}
                  await loadSensorsForCativeiro(cId);
                } catch (e) {
                  alert('Erro ao relacionar: ' + (e?.response?.data?.error || e.message));
                }
              }} style={{ border: 'none', background: '#3b82f6', color: '#fff', borderRadius: 6, padding: '8px 12px', cursor: 'pointer' }}>Relacionar</button>
            </div>
          </div>
        </div>
      )}
      {/* Modal de criação de cativeiro */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Criar cativeiro">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ gridColumn: 'span 2' }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Fazenda</label>
            <select value={createForm.fazendaId} onChange={(e) => setCreateForm(f => ({ ...f, fazendaId: e.target.value }))} style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 6 }}>
              {fazendas.map(f => (
                <option key={f._id} value={f._id}>{getFazendaName(f._id)}</option>
              ))}
            </select>
          </div>
          <div style={{ gridColumn: 'span 2' }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Nome</label>
            <input value={createForm.nome} onChange={(e) => setCreateForm(f => ({ ...f, nome: e.target.value }))} placeholder="Nome do cativeiro" style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 6 }} />
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Tipo de camarão</label>
            <select value={createForm.id_tipo_camarao} onChange={(e) => setCreateForm(f => ({ ...f, id_tipo_camarao: e.target.value }))} style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 6 }}>
              {tiposCamarao.map(t => (
                <option key={t._id} value={t._id}>{t.nome}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Data de instalação</label>
            <input type="date" value={createForm.data_instalacao} onChange={(e) => setCreateForm(f => ({ ...f, data_instalacao: e.target.value }))} style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 6 }} />
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Temp ideal (°C)</label>
            <input value={createForm.temp_media_diaria} onChange={(e) => setCreateForm(f => ({ ...f, temp_media_diaria: e.target.value }))} placeholder="ex: 26" style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 6 }} />
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>pH ideal</label>
            <input value={createForm.ph_medio_diario} onChange={(e) => setCreateForm(f => ({ ...f, ph_medio_diario: e.target.value }))} placeholder="ex: 7.5" style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 6 }} />
          </div>
          <div style={{ gridColumn: 'span 2' }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Amônia ideal (mg/L)</label>
            <input value={createForm.amonia_media_diaria} onChange={(e) => setCreateForm(f => ({ ...f, amonia_media_diaria: e.target.value }))} placeholder="ex: 0.05" style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 6 }} />
          </div>
          <div style={{ gridColumn: 'span 2' }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Imagem do cativeiro</label>
            <input type="file" accept="image/*" onChange={(e) => setCreateForm(f => ({ ...f, fotoFile: e.target.files?.[0] || null }))} style={{ width: '100%' }} />
          </div>
          <div style={{ gridColumn: 'span 2', borderTop: '1px solid #eee', paddingTop: 8 }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Dieta (opcional)</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="checkbox" checked={createForm.dietaAtivar} onChange={(e) => setCreateForm(f => ({ ...f, dietaAtivar: e.target.checked }))} />
                Ativar dieta na criação
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', opacity: createForm.dietaAtivar ? 1 : 0.6 }}>
              <input disabled={!createForm.dietaAtivar} value={createForm.dietaDescricao} onChange={(e) => setCreateForm(f => ({ ...f, dietaDescricao: e.target.value }))} placeholder="Descrição" style={{ flex: 1, padding: 8, border: '1px solid #ddd', borderRadius: 6 }} />
              <input disabled={!createForm.dietaAtivar} type="number" step="0.01" value={createForm.dietaQuantidade} onChange={(e) => setCreateForm(f => ({ ...f, dietaQuantidade: e.target.value }))} placeholder="Quantidade (g)" style={{ width: 160, padding: 8, border: '1px solid #ddd', borderRadius: 6 }} />
            </div>
          </div>
          <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <button onClick={() => setShowCreateModal(false)} style={{ border: '1px solid #e5e7eb', background: '#fff', borderRadius: 8, padding: '8px 12px', cursor: 'pointer' }}>Cancelar</button>
            <button onClick={submitCreateModal} style={{ border: 'none', background: '#10b981', color: '#fff', borderRadius: 8, padding: '8px 12px', cursor: 'pointer' }}>Criar</button>
          </div>
        </div>
      </Modal>
      {/* Modal de edição de cativeiro */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Editar cativeiro">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ gridColumn: 'span 2' }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Nome</label>
            <input value={editForm.nome} onChange={(e) => setEditForm(f => ({ ...f, nome: e.target.value }))} placeholder="Nome do cativeiro" style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 6 }} />
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Tipo de camarão</label>
            <select value={editForm.id_tipo_camarao} onChange={(e) => setEditForm(f => ({ ...f, id_tipo_camarao: e.target.value }))} style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 6 }}>
              {tiposCamarao.map(t => (
                <option key={t._id} value={t._id}>{t.nome}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Data de instalação</label>
            <input type="date" value={editForm.data_instalacao} onChange={(e) => setEditForm(f => ({ ...f, data_instalacao: e.target.value }))} style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 6 }} />
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Temp ideal (°C)</label>
            <input value={editForm.temp_media_diaria} onChange={(e) => setEditForm(f => ({ ...f, temp_media_diaria: e.target.value }))} placeholder="ex: 26" style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 6 }} />
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>pH ideal</label>
            <input value={editForm.ph_medio_diario} onChange={(e) => setEditForm(f => ({ ...f, ph_medio_diario: e.target.value }))} placeholder="ex: 7.5" style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 6 }} />
          </div>
          <div style={{ gridColumn: 'span 2' }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Amônia ideal (mg/L)</label>
            <input value={editForm.amonia_media_diaria} onChange={(e) => setEditForm(f => ({ ...f, amonia_media_diaria: e.target.value }))} placeholder="ex: 0.05" style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 6 }} />
          </div>
          <div style={{ gridColumn: 'span 2' }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Imagem do cativeiro (opcional)</label>
            <input type="file" accept="image/*" onChange={(e) => setEditForm(f => ({ ...f, fotoFile: e.target.files?.[0] || null }))} style={{ width: '100%' }} />
          </div>
          <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <button onClick={() => setShowEditModal(false)} style={{ border: '1px solid #e5e7eb', background: '#fff', borderRadius: 8, padding: '8px 12px', cursor: 'pointer' }}>Cancelar</button>
            <button onClick={async () => {
              try {
                const token = getToken();
                // Enviar dados básicos via PATCH
                await axios.patch(`${apiUrl}/cativeiros/${editForm.id}`, {
                  nome: editForm.nome,
                  id_tipo_camarao: editForm.id_tipo_camarao,
                  data_instalacao: new Date(editForm.data_instalacao).toISOString(),
                  temp_media_diaria: editForm.temp_media_diaria,
                  ph_medio_diario: editForm.ph_medio_diario,
                  amonia_media_diaria: editForm.amonia_media_diaria
                }, { headers: { Authorization: `Bearer ${token}` } });
                // Enviar imagem se houver
                if (editForm.fotoFile) {
                  const form = new FormData();
                  form.append('foto_cativeiro', editForm.fotoFile);
                  await axios.put(`${apiUrl}/cativeiros/${editForm.id}`, form, { headers: { Authorization: `Bearer ${token}` } });
                }
                setShowEditModal(false);
                await load();
              } catch (e) {
                console.error('Falha ao editar cativeiro:', e);
                alert('Erro ao editar cativeiro.');
              }
            }} style={{ border: 'none', background: '#3b82f6', color: '#fff', borderRadius: 8, padding: '8px 12px', cursor: 'pointer' }}>Salvar</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

