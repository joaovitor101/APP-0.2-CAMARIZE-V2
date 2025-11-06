import { useEffect, useState } from 'react';
import SensorList from '../components/SensorList';
import axios from 'axios';
import { useRouter } from 'next/router';
import Notification from '../components/Notification';
import AuthError from '../components/AuthError';
import Loading from '../components/Loading';
import NavBottom from '../components/NavBottom';
import styles from './sensores.module.css';
import RequestButton from '../components/RequestButton';

export default function SensoresPage() {
  const [sensores, setSensores] = useState([]);
  const [sensoresFiltrados, setSensoresFiltrados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [sensorToDelete, setSensorToDelete] = useState(null);
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success', actionLabel: null, onAction: null });
  const [pendingDeletion, setPendingDeletion] = useState({});
  const [filtroAtivo, setFiltroAtivo] = useState('');
  const [showFiltroModal, setShowFiltroModal] = useState(false);
  const [ordenacaoAtiva, setOrdenacaoAtiva] = useState(false);
  const router = useRouter();
  const usuarioRaw = typeof window !== 'undefined' ? (sessionStorage.getItem('usuarioCamarize') || localStorage.getItem('usuarioCamarize')) : null;
  const role = usuarioRaw ? (JSON.parse(usuarioRaw)?.role || 'membro') : 'membro';

  const showNotification = (message, type = 'success', actionLabel = null, onAction = null) => {
    setNotification({ show: true, message, type, actionLabel, onAction });
  };

  const hideNotification = () => {
    setNotification({ show: false, message: '', type: 'success' });
  };

  // Função para extrair o número do código do sensor
  const extrairNumeroCodigo = (codigo) => {
    const match = codigo.match(/#(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  };

  // Função de merge sort para ordenar sensores por código decrescente
  const mergeSort = (array) => {
    if (array.length <= 1) {
      return array;
    }

    const meio = Math.floor(array.length / 2);
    const esquerda = mergeSort(array.slice(0, meio));
    const direita = mergeSort(array.slice(meio));

    return merge(esquerda, direita);
  };

  const merge = (esquerda, direita) => {
    const resultado = [];
    let i = 0;
    let j = 0;

    while (i < esquerda.length && j < direita.length) {
      // Usar o índice original na lista completa para determinar o código
      const indexEsquerda = sensores.findIndex(s => s._id === esquerda[i]._id);
      const indexDireita = sensores.findIndex(s => s._id === direita[j]._id);
      
      const numEsquerda = indexEsquerda + 1; // +1 porque os códigos começam em #001
      const numDireita = indexDireita + 1;
      
      // Ordenação decrescente (maior para menor)
      if (numEsquerda >= numDireita) {
        resultado.push(esquerda[i]);
        i++;
      } else {
        resultado.push(direita[j]);
        j++;
      }
    }

    // Adicionar elementos restantes
    while (i < esquerda.length) {
      resultado.push(esquerda[i]);
      i++;
    }
    while (j < direita.length) {
      resultado.push(direita[j]);
      j++;
    }

    return resultado;
  };

  const handleOrdenar = () => {
    if (ordenacaoAtiva) {
      // Se já está ordenado, voltar à ordem original
      const sensoresOriginais = sensores.filter(sensor => 
        filtroAtivo === '' || 
        sensor.id_tipo_sensor?.toLowerCase().includes(filtroAtivo.toLowerCase()) ||
        sensor.apelido?.toLowerCase().includes(filtroAtivo.toLowerCase())
      );
      setSensoresFiltrados(sensoresOriginais);
      setOrdenacaoAtiva(false);
    } else {
      // Aplicar merge sort
      const ordenados = mergeSort([...sensoresFiltrados]);
      setSensoresFiltrados(ordenados);
      setOrdenacaoAtiva(true);
    }
  };

  // Aplicar filtro quando sensores ou filtroAtivo mudarem
  useEffect(() => {
    if (filtroAtivo === '') {
      setSensoresFiltrados(sensores);
    } else {
      const filtrados = sensores.filter(sensor => 
        sensor.id_tipo_sensor?.toLowerCase().includes(filtroAtivo.toLowerCase()) ||
        sensor.apelido?.toLowerCase().includes(filtroAtivo.toLowerCase())
      );
      setSensoresFiltrados(filtrados);
    }
    // Resetar ordenação quando filtro mudar
    setOrdenacaoAtiva(false);
  }, [sensores, filtroAtivo]);

  useEffect(() => {
    async function fetchSensoresDoUsuario() {
      try {
        setLoading(true);
        setError(null);
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
        const token = typeof window !== "undefined" ? (sessionStorage.getItem('token') || localStorage.getItem("token")) : null;

        if (!token) {
          setError('Você precisa estar logado para acessar esta página');
          setLoading(false);
          return;
        }

        // 1) Buscar cativeiros do usuário
        const cativeirosRes = await axios.get(`${apiUrl}/cativeiros`, { headers: { Authorization: `Bearer ${token}` } });
        const cativeiros = Array.isArray(cativeirosRes.data) ? cativeirosRes.data : [];

        // 2) Para cada cativeiro, buscar sensores relacionados
        const sensoresLists = await Promise.all(
          cativeiros.map(async (c) => {
            try {
              const rel = await axios.get(`${apiUrl}/cativeiros/${c._id}/sensores`, { headers: { Authorization: `Bearer ${token}` } });
              const list = Array.isArray(rel.data) ? rel.data : [];
              // normalizar estrutura: alguns retornos podem vir com populate
              return list.map(r => {
                const s = r.id_sensor || r;
                // Se não houver sensor, pular
                if (!s || !s._id) {
                  return null;
                }
                // Extrair o tipo de sensor corretamente
                let tipoSensor = 'sensor';
                if (s.id_tipo_sensor) {
                  // Se for objeto populado com descricao
                  if (typeof s.id_tipo_sensor === 'object' && s.id_tipo_sensor !== null && s.id_tipo_sensor.descricao) {
                    tipoSensor = s.id_tipo_sensor.descricao;
                  } 
                  // Se for string (descricao direta)
                  else if (typeof s.id_tipo_sensor === 'string') {
                    tipoSensor = s.id_tipo_sensor;
                  }
                  // Se for apenas ID, tentar usar heurística do apelido
                  else if (s.apelido) {
                    const apelidoLower = String(s.apelido).toLowerCase();
                    if (apelidoLower.includes('temp')) tipoSensor = 'temperatura';
                    else if (apelidoLower.includes('ph')) tipoSensor = 'pH';
                    else if (apelidoLower.includes('amonia') || apelidoLower.includes('nh3')) tipoSensor = 'amônia';
                  }
                }
                // Fallback: heurística pelo apelido se id_tipo_sensor não existir
                else if (s.apelido) {
                  const apelidoLower = String(s.apelido).toLowerCase();
                  if (apelidoLower.includes('temp')) tipoSensor = 'temperatura';
                  else if (apelidoLower.includes('ph')) tipoSensor = 'pH';
                  else if (apelidoLower.includes('amonia') || apelidoLower.includes('nh3')) tipoSensor = 'amônia';
                }
                return {
                  _id: s._id || s.id || `${c._id}-${Math.random()}`,
                  id_tipo_sensor: tipoSensor,
                  apelido: s.apelido || '',
                  cativeiroId: c._id,
                  cativeiroNome: c.nome || c._id
                };
              }).filter(Boolean); // Remove nulls
            } catch (err) {
              console.error(`Erro ao buscar sensores do cativeiro ${c._id}:`, err);
              return [];
            }
          })
        );

        // 3) Achatar e deduplicar por _id
        const merged = [].concat(...sensoresLists);
        const uniqueById = Array.from(new Map(merged.map(s => [String(s._id), s])).values());

        setSensores(uniqueById);
        setSensoresFiltrados(uniqueById);
      } catch (err) {
        console.error('Erro ao buscar sensores do usuário:', err);
        if (err.response?.status === 401) {
          setError('Sessão expirada. Faça login novamente para continuar.');
        } else {
          setError('Erro ao carregar os sensores. Tente novamente.');
        }
        setSensores([]);
        setSensoresFiltrados([]);
      } finally {
        setLoading(false);
      }
    }
    fetchSensoresDoUsuario();
  }, []);

  const handleEditSensor = (sensorId) => {
    router.push(`/edit-sensor?id=${sensorId}`);
  };

  const handleDeleteSensor = (sensorId) => {
    setSensorToDelete(sensorId);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!sensorToDelete) return;
    // Padrão "desfazer": agenda deleção, permite desfazer no toast, só executa após timeout
    setShowDeleteModal(false);
    const id = sensorToDelete;
    setSensorToDelete(null);

    const timeoutId = setTimeout(() => {}, 3000); // placeholder; o onTimeout do toast executa a deleção
    setPendingDeletion(prev => ({ ...prev, [id]: { timeoutId } }));
    showNotification('Sensor marcado para exclusão', 'warning', 'Desfazer', () => {
      const pending = pendingDeletion[id] || { timeoutId };
      clearTimeout(pending.timeoutId);
      setPendingDeletion((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
      showNotification('Exclusão desfeita.', 'success');
    });
  };

  // Se há erro, mostrar tela de erro
  if (error) {
    return <AuthError error={error} onRetry={() => window.location.reload()} />;
  }

  // Se está carregando, mostrar loading
  if (loading) {
    return <Loading message="Carregando sensores..." />;
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ 
        width: '100%', 
        maxWidth: 600, 
        padding: '16px', 
        margin: '0 auto', 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column',
        boxSizing: 'border-box'
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          position: 'relative',
          marginBottom: 16,
          minHeight: '48px'
        }}>
          <button 
            style={{ 
              background: 'none', 
              border: 'none', 
              fontSize: 24, 
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '4px',
              transition: 'background-color 0.2s',
              position: 'absolute',
              left: 0,
              zIndex: 2
            }} 
            onClick={() => {
              if (window.history.length > 1) {
                window.history.back();
              } else {
                router.push('/home');
              }
            }}
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
          <h2 style={{ 
            width: '100%', 
            textAlign: 'center', 
            margin: 0, 
            fontWeight: 600,
            fontSize: '1.25rem'
          }}>
            Sistema
          </h2>
        </div>
        <div className={styles.headerContainer}>
          <span className={styles.headerTitle}>Sensores</span>
          <div style={{ flex: 1 }} />
          <div className={styles.headerActions}>
            <button 
              className={`${styles.headerButton} ${ordenacaoAtiva ? styles.activeButton : ''}`} 
              title={ordenacaoAtiva ? "Desordenar" : "Ordenar por código decrescente"}
              onClick={handleOrdenar}
            >
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
                <path d="M3 18h6M3 6h18M3 12h12" stroke={ordenacaoAtiva ? "#3b82f6" : "#222"} strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
            <button 
              className={`${styles.headerButton} ${styles.filterButton}`}
              title={filtroAtivo ? `Filtro ativo: ${filtroAtivo}` : "Filtrar"} 
              onClick={() => setShowFiltroModal(true)}
            >
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
                <path d="M3 4a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v2a1 1 0 0 1-.293.707l-6.414 6.414A1 1 0 0 0 13 13.414V19a1 1 0 0 1-1.447.894l-4-2A1 1 0 0 1 7 17v-3.586a1 1 0 0 0-.293-.707L3.293 6.707A1 1 0 0 1 3 6V4Z" stroke={filtroAtivo ? "#3b82f6" : "#222"} strokeWidth="2" strokeLinecap="round"/>
              </svg>
              {filtroAtivo && <div className={styles.filterIndicator} />}
            </button>
            {role !== 'membro' && (
              <button 
                className={styles.headerButton}
                title="Cadastrar Sensor" 
                onClick={() => router.push('/create-sensores')}
              >
                <svg width="24" height="24" fill="none" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3" stroke="#222" strokeWidth="2"/><path d="M12 8v8M8 12h8" stroke="#222" strokeWidth="2"/></svg>
              </button>
            )}
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%' }}>
          <SensorList 
            sensores={sensoresFiltrados} 
            onEdit={undefined}
            onDelete={undefined}
            useOriginalIndex={ordenacaoAtiva}
            originalSensores={sensores}
          />
        </div>
      </div>
      <div style={{ width: '100%', display: 'flex', justifyContent: 'center', margin: '32px 0 16px 0' }}>
        <img src="/images/logo.svg" alt="Camarize Logo" style={{ width: 180, height: 40 }} />
      </div>
      
      {/* Modal de confirmação de exclusão - removido para funcionário */}

      {/* Componente de Notificação */}
      {notification.show && (
        <Notification
          isVisible={notification.show}
          message={notification.message}
          type={notification.type}
          onClose={hideNotification}
          actionLabel={notification.actionLabel}
          onAction={notification.onAction}
          showProgress={notification.message?.toLowerCase().includes('marcado para exclusão')}
          progressDuration={3000}
          duration={notification.message?.toLowerCase().includes('marcado para exclusão') ? 3000 : 3000}
          onTimeout={async () => {
            const ids = Object.keys(pendingDeletion);
            if (ids.length === 0) return;
            const idToDelete = ids[0];
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
            const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
            try {
              await axios.delete(`${apiUrl}/sensores/${idToDelete}`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
              });
              setPendingDeletion((prev) => {
                const copy = { ...prev };
                delete copy[idToDelete];
                return copy;
              });
              const res = await axios.get(`${apiUrl}/sensores`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
              });
              setSensores(res.data);
              setSensoresFiltrados(res.data);
              showNotification('Sensor excluído com sucesso!', 'success');
            } catch (err) {
              console.error('Erro ao deletar sensor:', err);
              setPendingDeletion((prev) => {
                const copy = { ...prev };
                delete copy[idToDelete];
                return copy;
              });
              const apiMsg = err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Erro ao excluir sensor';
              showNotification(apiMsg, 'error');
            }
          }}
        />
      )}

      {/* Modal de Filtro */}
      {showFiltroModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: '#fff',
            padding: '32px 24px',
            borderRadius: '16px',
            minWidth: '320px',
            maxWidth: '90vw',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            alignItems: 'center',
            textAlign: 'center',
            border: '1px solid #e5e7eb'
          }}>
            {/* Título */}
            <div style={{
              fontWeight: '700',
              fontSize: '20px',
              color: '#1f2937',
              lineHeight: '1.2'
            }}>
              Filtrar Sensores
            </div>
            
            {/* Campo de busca */}
            <div style={{ width: '100%' }}>
              <input
                type="text"
                placeholder="Digite o nome do sensor..."
                value={filtroAtivo}
                onChange={(e) => setFiltroAtivo(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
            </div>

            {/* Filtros rápidos */}
            <div style={{ width: '100%' }}>
              <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '12px' }}>
                Filtros rápidos:
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setFiltroAtivo('Temperatura')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '20px',
                    border: '1px solid #d1d5db',
                    background: filtroAtivo === 'Temperatura' ? '#3b82f6' : '#fff',
                    color: filtroAtivo === 'Temperatura' ? '#fff' : '#374151',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: '500'
                  }}
                >
                  Temperatura
                </button>
                <button
                  onClick={() => setFiltroAtivo('pH')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '20px',
                    border: '1px solid #d1d5db',
                    background: filtroAtivo === 'pH' ? '#3b82f6' : '#fff',
                    color: filtroAtivo === 'pH' ? '#fff' : '#374151',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: '500'
                  }}
                >
                  pH
                </button>
                <button
                  onClick={() => setFiltroAtivo('Amônia')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '20px',
                    border: '1px solid #d1d5db',
                    background: filtroAtivo === 'Amônia' ? '#3b82f6' : '#fff',
                    color: filtroAtivo === 'Amônia' ? '#fff' : '#374151',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: '500'
                  }}
                >
                  Amônia
                </button>
              </div>
            </div>

            {/* Contador de resultados */}
            <div style={{ fontSize: '14px', color: '#6b7280' }}>
              {filtroAtivo ? `${sensoresFiltrados.length} de ${sensores.length} sensores encontrados` : `${sensores.length} sensores no total`}
            </div>
            
            {/* Botões */}
            <div style={{
              display: 'flex',
              gap: '12px',
              width: '100%',
              marginTop: '8px'
            }}>
              <button 
                onClick={() => {
                  setFiltroAtivo('');
                  setShowFiltroModal(false);
                }}
                style={{
                  flex: 1,
                  padding: '12px 20px',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                  background: '#fff',
                  color: '#374151',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontSize: '14px',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => {
                  e.target.style.background = '#f9fafb';
                  e.target.style.borderColor = '#9ca3af';
                }}
                onMouseOut={(e) => {
                  e.target.style.background = '#fff';
                  e.target.style.borderColor = '#d1d5db';
                }}
              >
                Limpar
              </button>
              <button 
                onClick={() => setShowFiltroModal(false)}
                style={{
                  flex: 1,
                  padding: '12px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#3b82f6',
                  color: '#fff',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontSize: '14px',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => {
                  e.target.style.background = '#2563eb';
                }}
                onMouseOut={(e) => {
                  e.target.style.background = '#3b82f6';
                }}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NavBottom */}
      <NavBottom />
    </div>
  );
} 