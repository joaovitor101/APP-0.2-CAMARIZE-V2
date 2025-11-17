import { useEffect, useState } from 'react';
import Modal from '../../components/Modal';
import axios from 'axios';
import { useAuth } from '@/hooks/useAuth';
import NavBottom from '@/components/NavBottom';

export default function MyRequests() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [items, setItems] = useState([]);
  const [tiposCamarao, setTiposCamarao] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [swipeStartX, setSwipeStartX] = useState(null);
  const [swipeCurrentX, setSwipeCurrentX] = useState(null);
  const [swipedItemId, setSwipedItemId] = useState(null);
  const [openItemId, setOpenItemId] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  const getToken = () => (typeof window !== 'undefined' ? (sessionStorage.getItem('token') || localStorage.getItem('token')) : null);

  const load = async () => {
    try {
      setLoading(true);
      const token = getToken();
      const headers = { Authorization: `Bearer ${token}` };
      const [res, tipos] = await Promise.all([
        axios.get(`${apiUrl}/requests/mine`, { headers }),
        axios.get(`${apiUrl}/camaroes`, { headers }).catch(() => ({ data: [] }))
      ]);
      setItems(res.data || []);
      setTiposCamarao(tipos.data || []);
    } catch (e) {
      setError('Erro ao carregar suas solicitações');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && isAuthenticated) load();
  }, [authLoading, isAuthenticated]);

  const filtered = items.filter(item => {
    if (!dateFilter) return true;
    const [y, m, d] = dateFilter.split('-').map(Number);
    const fd = new Date(y, m - 1, d);
    const di = new Date(item.createdAt);
    return di.getFullYear() === fd.getFullYear() && di.getMonth() === fd.getMonth() && di.getDate() === fd.getDate();
  });

  const statusChipStyle = (status) => ({
    padding: '4px 8px',
    borderRadius: 999,
    fontSize: '12px',
    background: status === 'aprovado' ? '#dcfce7' : status === 'recusado' ? '#fee2e2' : '#fef3c7',
    color: status === 'aprovado' ? '#166534' : status === 'recusado' ? '#991b1b' : '#92400e'
  });

  const actionLabel = (action) => ({
    editar_cativeiro: 'Editar cativeiro',
    editar_sensor: 'Editar sensor',
    cadastrar_cativeiro: 'Cadastrar cativeiro',
    excluir_cativeiro: 'Excluir cativeiro',
    cadastrar_sensor: 'Cadastrar sensor',
    excluir_sensor: 'Excluir sensor',
    editar_cativeiro_add_sensor: 'Adicionar sensor ao cativeiro',
    editar_cativeiro_remove_sensor: 'Remover sensor do cativeiro'
  })[action] || action;

  const getTipoCamaraoNome = (id) => {
    const t = tiposCamarao.find(x => String(x._id) === String(id));
    return t ? t.nome : id;
  };

  const handleTouchStart = (id, e) => {
    if (e.touches && e.touches.length > 0) {
      setSwipeStartX(e.touches[0].clientX);
      setSwipeCurrentX(e.touches[0].clientX);
      setSwipedItemId(id);
    }
  };

  const handleTouchMove = (e) => {
    if (swipeStartX === null) return;
    if (e.touches && e.touches.length > 0) {
      setSwipeCurrentX(e.touches[0].clientX);
    }
  };

  const handleTouchEnd = (id) => {
    if (swipeStartX === null || swipeCurrentX === null) {
      setSwipedItemId(null);
      setSwipeStartX(null);
      setSwipeCurrentX(null);
      return;
    }
    const deltaX = swipeCurrentX - swipeStartX; // negativo se arrastar para esquerda
    const threshold = -60;
    if (deltaX < threshold) {
      setOpenItemId(id);
    } else {
      setOpenItemId(null);
    }
    setSwipedItemId(null);
    setSwipeStartX(null);
    setSwipeCurrentX(null);
  };

  const handleDelete = (id) => {
    setItemToDelete(id);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      const token = getToken();
      const headers = { Authorization: `Bearer ${token}` };
      await axios.delete(`${apiUrl}/requests/${itemToDelete}`, { headers });
      setItems(prev => prev.filter(x => String(x._id) !== String(itemToDelete)));
      setOpenItemId(null);
    } catch (e) {
      alert('Falha ao excluir. Tente novamente.');
    } finally {
      setShowDeleteModal(false);
      setItemToDelete(null);
    }
  };

  const getTranslateXForItem = (id) => {
    if (id === swipedItemId && swipeStartX !== null && swipeCurrentX !== null) {
      const deltaX = Math.max(-100, Math.min(0, swipeCurrentX - swipeStartX));
      return deltaX;
    }
    if (id === openItemId) return -88; // aberto via botão de opções
    return 0;
  };

  const renderPayloadPretty = (item) => {
    const { action, payload = {} } = item;
    if (action === 'editar_cativeiro') {
      const fields = [];
      if (typeof payload.nome !== 'undefined') fields.push({ label: 'Nome do cativeiro', value: payload.nome });
      if (typeof payload.id_tipo_camarao !== 'undefined') fields.push({ label: 'Tipo de camarão', value: getTipoCamaraoNome(payload.id_tipo_camarao) });
      if (typeof payload.temp_media_diaria !== 'undefined') fields.push({ label: 'Temperatura ideal (°C)', value: payload.temp_media_diaria });
      if (typeof payload.ph_medio_diario !== 'undefined') fields.push({ label: 'pH ideal', value: payload.ph_medio_diario });
      if (typeof payload.amonia_media_diaria !== 'undefined') fields.push({ label: 'Amônia ideal (mg/L)', value: payload.amonia_media_diaria });
      if (fields.length === 0) return null;
      return (
        <ul style={{ margin: '6px 0 0 18px', padding: 0 }}>
          {fields.map((f, i) => (
            <li key={i}><strong>{f.label}:</strong> {String(f.value)}</li>
          ))}
        </ul>
      );
    }

    // Fallback genérico: lista chaves legíveis e esconde ids técnicos
    const hiddenKeys = new Set(['_id', 'id', 'cativeiroId', 'sensorId', 'fazendaId', 'fazenda']);
    const entries = Object.entries(payload).filter(([k]) => !hiddenKeys.has(k));
    if (entries.length === 0) return null;
    return (
      <ul style={{ margin: '6px 0 0 18px', padding: 0 }}>
        {entries.map(([k, v]) => (
          <li key={k}><strong>{k.replaceAll('_', ' ')}:</strong> {typeof v === 'object' ? JSON.stringify(v) : String(v)}</li>
        ))}
      </ul>
    );
  };

  if (authLoading || loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        paddingBottom: '100px'
      }}>
        <div style={{
          background: 'white',
          borderRadius: '20px',
          padding: '48px',
          textAlign: 'center',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          maxWidth: '400px',
          width: '100%'
        }}>
          <div style={{
            width: '60px',
            height: '60px',
            border: '5px solid #f3f3f3',
            borderTop: '5px solid #667eea',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 24px'
          }}></div>
          <div style={{
            fontSize: '24px',
            fontWeight: '600',
            color: '#333',
            marginBottom: '12px'
          }}>
            Carregando solicitações...
          </div>
          <div style={{
            fontSize: '15px',
            color: '#666',
            lineHeight: '1.5'
          }}>
            Estamos buscando suas solicitações
          </div>
          <style jsx>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
        <NavBottom />
      </div>
    );
  }
  if (!isAuthenticated) return (
    <div style={{ padding: 20, color: 'red', paddingBottom: '100px', minHeight: '100vh' }}>
      Sessão expirada. Faça login novamente.
      <NavBottom />
    </div>
  );
  if (error) return (
    <div style={{ padding: 20, color: 'red', paddingBottom: '100px', minHeight: '100vh' }}>
      {error}
      <NavBottom />
    </div>
  );

  return (
    <div style={{ padding: 20, paddingBottom: '100px' }}>
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <button 
          style={{ 
            position: 'absolute',
            left: 0,
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'none', 
            border: 'none', 
            fontSize: 24, 
            cursor: 'pointer',
            padding: '8px',
            borderRadius: '4px',
            transition: 'background-color 0.2s',
            zIndex: 1
          }} 
          onClick={() => window.history.back()}
          onMouseOver={(e) => {
            e.target.style.backgroundColor = 'rgba(0,0,0,0.05)';
          }}
          onMouseOut={(e) => {
            e.target.style.backgroundColor = 'transparent';
          }}
          title="Voltar"
        >
          &larr;
        </button>
        <h2 style={{ textAlign: 'center', margin: 0, fontWeight: 600, fontSize: '1.35rem', padding: '8px 0' }}>Minhas Solicitações</h2>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, padding: 12, background: '#f9fafb', borderRadius: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: '14px', fontWeight: '500' }}>Data:</label>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '14px' }}
          />
        </div>
        <button
          onClick={() => setDateFilter(new Date().toISOString().split('T')[0])}
          style={{ padding: '6px 12px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '14px' }}
        >
          Hoje
        </button>
        <button
          onClick={() => setDateFilter('')}
          style={{ padding: '6px 12px', background: '#6b7280', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '14px' }}
        >
          Limpar Filtros
        </button>
        <div style={{ fontSize: '14px', color: '#6b7280' }}>
          {filtered.length} de {items.length} solicitações
        </div>
      </div>

      {filtered.length === 0 && items.length > 0 && (
        <div style={{ textAlign: 'center', padding: 20, color: '#6b7280' }}>Nenhuma solicitação encontrada com os filtros aplicados.</div>
      )}
      {filtered.length === 0 && items.length === 0 && (
        <div style={{ textAlign: 'center', padding: 20, color: '#6b7280' }}>Você ainda não enviou solicitações.</div>
      )}

      {filtered.map(item => {
        const translateX = getTranslateXForItem(item._id);
        return (
          <div key={item._id} style={{ position: 'relative', marginBottom: 12 }}>
            <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, display: 'flex', alignItems: 'stretch', gap: 8, paddingRight: 8 }}>
              <button
                onClick={() => handleDelete(item._id)}
                style={{
                  background: '#ef4444', color: '#fff', border: 'none', borderRadius: 10, padding: '0 16px',
                  minWidth: 80, cursor: 'pointer'
                }}
                title="Excluir"
              >
                Excluir
              </button>
            </div>
            <div
              onClick={() => setOpenItemId(null)}
              style={{
                border: '1px solid #e5e7eb', padding: 14, borderRadius: 10, background: '#fff',
                transform: `translateX(${translateX}px)`, transition: swipedItemId ? 'none' : 'transform 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <img src="/images/history.svg" alt="Histórico" width="18" height="18" />
                  <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{actionLabel(item.action)}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); setOpenItemId(openItemId === item._id ? null : item._id); }}
                    title="Opções"
                    style={{
                      border: '1px solid #e5e7eb', background: '#f9fafb', color: '#374151',
                      borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontWeight: 600
                    }}
                  >
                    ⋯
                  </button>
                  <span style={statusChipStyle(item.status)}>
                    {item.status === 'aprovado' ? 'Aprovado' : item.status === 'recusado' ? 'Recusado' : 'Pendente'}
                  </span>
                </div>
              </div>
              <div style={{ marginTop: 6, fontSize: 13, color: '#6b7280' }}>
                {new Date(item.createdAt).toLocaleString('pt-BR')}
              </div>
              {item.payload && Object.keys(item.payload).length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>Alterações solicitadas:</div>
                  {renderPayloadPretty(item)}
                </div>
              )}
            </div>
          </div>
        );
      })}

      <Modal isOpen={showDeleteModal} onClose={() => { setShowDeleteModal(false); setItemToDelete(null); }} title="Excluir solicitação">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>Tem certeza que deseja excluir esta solicitação?</div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button
              onClick={() => { setShowDeleteModal(false); setItemToDelete(null); }}
              style={{ border: '1px solid #e5e7eb', background: '#fff', borderRadius: 8, padding: '8px 12px', cursor: 'pointer' }}
            >
              Cancelar
            </button>
            <button
              onClick={confirmDelete}
              style={{ border: 'none', background: '#ef4444', color: '#fff', borderRadius: 8, padding: '8px 12px', cursor: 'pointer' }}
            >
              Excluir
            </button>
          </div>
        </div>
      </Modal>
      <NavBottom />
    </div>
  );
}


