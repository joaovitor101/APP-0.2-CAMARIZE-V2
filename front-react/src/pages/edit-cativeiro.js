import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/router";
import styles from "@/components/CreateContent/CreateContent.module.css";
import axios from "axios";
import RequestButton from "@/components/RequestButton";
import SelectTipoCamarao from "@/components/SelectTipoCamarao";
import Notification from "@/components/Notification";
import NavBottom from "@/components/NavBottom";

export default function EditCativeiroPage() {
  const router = useRouter();
  const { id } = router.query;
  const [cativeiro, setCativeiro] = useState(null);
  const [fazendas, setFazendas] = useState([]);
  const [tiposCamarao, setTiposCamarao] = useState([]);
  const [fazendaSelecionada, setFazendaSelecionada] = useState("");
  const [tipoCamarao, setTipoCamarao] = useState(null);
  const [dataInstalacao, setDataInstalacao] = useState("");
  const [nomeCativeiro, setNomeCativeiro] = useState("");
  const [arquivo, setArquivo] = useState(null);
  const [sensores, setSensores] = useState(["", "", ""]);
  const [sensoresDisponiveis, setSensoresDisponiveis] = useState([]);
  const [tempMedia, setTempMedia] = useState("");
  const [phMedio, setPhMedio] = useState("");
  const [amoniaMedia, setAmoniaMedia] = useState("");
  const [loading, setLoading] = useState(true);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [currentImageUrl, setCurrentImageUrl] = useState(null);
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });
  const fileInputRef = useRef();

  const localUser = typeof window !== 'undefined' ? JSON.parse(sessionStorage.getItem('usuarioCamarize') || localStorage.getItem('usuarioCamarize') || '{}') : {};
  const effectiveRole = localUser?.role;
  const isMember = String(effectiveRole).toLowerCase() === 'membro';

  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
  };

  const hideNotification = () => {
    setNotification({ show: false, message: '', type: 'success' });
  };

  useEffect(() => {
    if (router.isReady && id && id !== 'undefined') {
      fetchCativeiro();
    }
  }, [id, router.isReady]);

  useEffect(() => {
    if (cativeiro && tiposCamarao.length > 0) {
      configureTipoCamarao();
    }
  }, [cativeiro, tiposCamarao]);

  useEffect(() => {
    if (cativeiro && tiposCamarao.length > 0 && fazendas.length > 0 && !loading) {
      setDataLoaded(true);
    }
  }, [cativeiro, tiposCamarao, fazendas, loading]);

  useEffect(() => {
    async function fetchFazendas() {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
        const token = typeof window !== 'undefined' ? (sessionStorage.getItem('token') || localStorage.getItem('token')) : null;
        const res = await axios.get(`${apiUrl}/fazendas`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        setFazendas(res.data);
      } catch (err) {
        console.error('Erro ao buscar fazendas:', err);
        setFazendas([]);
      }
    }
    async function fetchTiposCamarao() {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
        const res = await axios.get(`${apiUrl}/tipos-camarao`);
        setTiposCamarao(res.data);
      } catch (err) {
        setTiposCamarao([]);
      }
    }
    async function fetchSensores() {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        const res = await axios.get(`${apiUrl}/sensores`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        setSensoresDisponiveis(res.data);
      } catch (err) {
        setSensoresDisponiveis([]);
        showNotification('Erro ao carregar lista de sensores', 'error');
      }
    }
    fetchFazendas();
    fetchTiposCamarao();
    if (!isMember) fetchSensores();
  }, [isMember]);

  const fetchCativeiro = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      const token = typeof window !== 'undefined' ? (sessionStorage.getItem('token') || localStorage.getItem('token')) : null;
      const res = await axios.get(`${apiUrl}/cativeiros/${id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const cativeiroData = res.data;
      setCativeiro(cativeiroData);
      setNomeCativeiro(cativeiroData.nome || "");
      const fazendaId = (cativeiroData.fazenda?._id || cativeiroData.fazenda || "").toString();
      setFazendaSelecionada(fazendaId);
      setDataInstalacao(cativeiroData.data_instalacao ? new Date(cativeiroData.data_instalacao).toISOString().split('T')[0] : "");
      if (cativeiroData.condicoes_ideais) {
        setTempMedia(cativeiroData.condicoes_ideais.temp_ideal?.toString() || "");
        setPhMedio(cativeiroData.condicoes_ideais.ph_ideal?.toString() || "");
        setAmoniaMedia(cativeiroData.condicoes_ideais.amonia_ideal?.toString() || "");
      } else {
        setTempMedia(cativeiroData.temp_media_diaria || "");
        setPhMedio(cativeiroData.ph_medio_diario || "");
        setAmoniaMedia(cativeiroData.amonia_media_diaria || "");
      }
      if (!isMember && cativeiroData.sensores && cativeiroData.sensores.length > 0) {
        const sensoresIds = cativeiroData.sensores.map(sensor => sensor._id || sensor);
        const sensoresCompletos = ["", "", ""];
        sensoresIds.forEach((sensorId, index) => {
          if (index < 3) sensoresCompletos[index] = sensorId;
        });
        setSensores(sensoresCompletos);
      }
      if (cativeiroData.foto_cativeiro && cativeiroData.foto_cativeiro.data) {
        try {
          const base64String = arrayBufferToBase64(cativeiroData.foto_cativeiro.data);
          if (base64String && base64String.length > 0 && typeof base64String === 'string') {
            const imageUrl = `data:image/jpeg;base64,${base64String}`;
            // Validar se a URL é válida antes de definir
            try {
              // Testar se é uma URL válida (data URLs são válidas)
              if (imageUrl.startsWith('data:image/')) {
                setCurrentImageUrl(imageUrl);
              } else {
                console.warn('URL de imagem inválida gerada');
                setCurrentImageUrl(null);
              }
            } catch (urlError) {
              console.error('Erro ao validar URL da imagem:', urlError);
              setCurrentImageUrl(null);
            }
          } else {
            setCurrentImageUrl(null);
          }
        } catch (imgError) {
          console.error('Erro ao processar imagem do cativeiro:', imgError);
          setCurrentImageUrl(null);
        }
      } else {
        setCurrentImageUrl(null);
      }
      setLoading(false);
    } catch (err) {
      const apiMsg = err?.response?.data?.error || err?.response?.data?.message || 'Erro ao carregar dados do cativeiro';
      showNotification(apiMsg, 'error');
      router.push('/home');
    }
  };

  const arrayBufferToBase64 = (buffer) => {
    try {
      if (!buffer) return '';
      
      let binary = '';
      let imageData = buffer;
      
      // Se for um objeto com propriedade data
      if (buffer && typeof buffer === 'object' && buffer.data) {
        imageData = buffer.data;
      }
      
      // Se for array
      if (Array.isArray(imageData)) {
        for (let i = 0; i < imageData.length; i++) {
          binary += String.fromCharCode(imageData[i]);
        }
      } 
      // Se for ArrayBuffer ou Buffer
      else if (imageData instanceof ArrayBuffer) {
        const bytes = new Uint8Array(imageData);
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
      }
      // Se for Uint8Array
      else if (imageData instanceof Uint8Array) {
        for (let i = 0; i < imageData.length; i++) {
          binary += String.fromCharCode(imageData[i]);
        }
      }
      // Se for string (já é base64)
      else if (typeof imageData === 'string') {
        return imageData;
      }
      
      if (binary.length === 0) {
        console.warn('Buffer vazio ou formato não suportado');
        return '';
      }
      
      return typeof window !== 'undefined' ? window.btoa(binary) : Buffer.from(binary, 'binary').toString('base64');
    } catch (error) {
      console.error('Erro ao converter buffer para base64:', error);
      return '';
    }
  };

  const configureTipoCamarao = () => {
    if (cativeiro && tiposCamarao.length > 0 && cativeiro.id_tipo_camarao) {
      const tipoId = cativeiro.id_tipo_camarao._id || cativeiro.id_tipo_camarao;
      const tipo = tiposCamarao.find(t => t._id === tipoId);
      if (tipo) setTipoCamarao({ value: tipo._id, label: tipo.nome });
    }
  };

  const handleSensorChange = (idx, value) => {
    const novos = [...sensores];
    novos[idx] = value;
    setSensores(novos);
  };

  const adicionarCampoSensor = () => {
    if (sensores.length < 3) setSensores([...sensores, ""]);
  };

  const removerCampoSensor = (idx) => {
    if (sensores.length > 1) setSensores(sensores.filter((_, index) => index !== idx));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
    const formData = new FormData();
    formData.append("nome", nomeCativeiro);
    formData.append("fazendaId", fazendaSelecionada);
    formData.append("id_tipo_camarao", tipoCamarao?.value || "");
    formData.append("data_instalacao", dataInstalacao);
    if (arquivo) formData.append("foto_cativeiro", arquivo);
    formData.append("temp_media_diaria", tempMedia);
    formData.append("ph_medio_diario", phMedio);
    formData.append("amonia_media_diaria", amoniaMedia);

    if (!isMember) {
      const sensoresSelecionados = sensores.filter(sensor => sensor && sensor !== "");
      if (sensoresSelecionados.length > 0) {
        sensoresSelecionados.forEach((sensorId) => {
          formData.append("sensorIds", sensorId);
        });
      }
    }

    try {
      const token = typeof window !== "undefined" ? (sessionStorage.getItem('token') || localStorage.getItem('token')) : null;
      await axios.put(`${apiUrl}/cativeiros/${id}`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });

      const sensoresSelecionados = isMember ? [] : sensores.filter(sensor => sensor && sensor !== "");
      const message = sensoresSelecionados.length > 0
        ? `Cativeiro atualizado com sucesso! ${sensoresSelecionados.length} sensor(es) relacionado(s) automaticamente.`
        : "Cativeiro atualizado com sucesso!";

      showNotification(message);
      setTimeout(() => { router.push("/home"); }, 2000);
    } catch {
      showNotification("Erro ao atualizar cativeiro.", 'error');
    }
  };

  if (loading || !dataLoaded) {
    return (
      <div className={styles.createWrapper}>
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <p>Carregando dados do cativeiro...</p>
        </div>
        <NavBottom />
      </div>
    );
  }

  return (
    <div className={styles.createWrapper}>
      <button className={styles.backBtn} onClick={() => router.back()}>
        <span style={{ fontSize: 24, lineHeight: 1 }}>&larr;</span>
      </button>
      <form className={styles.formBox} onSubmit={handleSubmit}>
        <h2 className={styles.title}>Editar cativeiro</h2>
        <input
          className={styles.input}
          placeholder="Nome do cativeiro"
          type="text"
          value={nomeCativeiro}
          onChange={e => setNomeCativeiro(e.target.value)}
          required
        />
        <select
          className={`${styles.input} ${styles.inputSelect}`}
          value={fazendaSelecionada}
          onChange={e => setFazendaSelecionada(e.target.value)}
        >
          <option value="">Selecione o sítio</option>
          {fazendas.map(f => (
            <option key={f._id} value={f._id.toString()}>
              {f.nome} - {f.codigo}
            </option>
          ))}
        </select>
        <div className={styles.inputIconBox}>
          <input
            className={styles.input}
            placeholder="Data da instalação"
            type="date"
            value={dataInstalacao}
            onChange={e => setDataInstalacao(e.target.value)}
          />
        </div>
        <div style={{ width: '100%' }}>
          <SelectTipoCamarao
            value={tipoCamarao}
            onChange={option => setTipoCamarao(option)}
          />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <h4 style={{ margin: '0 0 8px 0', fontWeight: 600, fontSize: '1.08rem' }}>Condições Ideais</h4>
        </div>
        <div className={styles.mediaInputs}>
          <input className={styles.input} placeholder="Temperatura" type="number" step="0.1" min="0" value={tempMedia} onChange={e => setTempMedia(e.target.value)} />
          <input className={styles.input} placeholder="pH" type="number" step="0.1" min="0" max="14" value={phMedio} onChange={e => setPhMedio(e.target.value)} />
          <input className={styles.input} placeholder="Amônia" type="number" step="0.01" min="0" value={amoniaMedia} onChange={e => setAmoniaMedia(e.target.value)} />
        </div>
        <div className={styles.uploadBox}>
          <button type="button" className={styles.uploadBtn} onClick={() => fileInputRef.current.click()}>
            &#128206; Selecionar foto
          </button>
          <input type="file" ref={fileInputRef} style={{ display: "none" }} onChange={e => setArquivo(e.target.files[0])} />
          <span className={styles.uploadFileName}>
            {arquivo ? arquivo.name : (currentImageUrl ? "Foto atual" : "Nenhum arquivo inserido")}
          </span>
          {currentImageUrl && !arquivo && currentImageUrl.startsWith('data:image') && (
            <div style={{ marginTop: '8px' }}>
              <img 
                src={currentImageUrl} 
                alt="Foto atual do cativeiro" 
                style={{ maxWidth: '100px', maxHeight: '100px', borderRadius: '8px', border: '1px solid #ddd' }}
                onError={(e) => {
                  console.error('Erro ao carregar imagem:', e);
                  e.target.style.display = 'none';
                }}
              />
            </div>
          )}
        </div>
        {!isMember && (
          <>
            <hr className={styles.hr} />
            <h3 className={styles.subtitle}>Relacione os sensores</h3>
            <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '15px', gridColumn: '1 / -1' }}>
              Todos os sensores selecionados serão relacionados ao cativeiro automaticamente (máximo 3 sensores).
            </p>
            {sensores.map((sensor, idx) => (
              <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <select className={`${styles.input} ${styles.inputSelect}`} value={sensor} onChange={e => handleSensorChange(idx, e.target.value)} style={{ flex: 1 }}>
                  <option value="">Selecione</option>
                  {sensoresDisponiveis
                    .filter(s => sensor === s._id || !sensores.includes(s._id))
                    .map(s => (
                      <option key={s._id} value={s._id}>
                        {s.apelido ? `${s.apelido} (${s.id_tipo_sensor})` : s.id_tipo_sensor || s._id}
                      </option>
                    ))}
                </select>
                {sensores.length > 1 && (
                  <button type="button" onClick={() => removerCampoSensor(idx)} style={{ background: '#ff4444', color: 'white', border: 'none', borderRadius: '4px', padding: '8px 12px', cursor: 'pointer', fontSize: '14px' }}>✕</button>
                )}
              </div>
            ))}
            {sensores.length < 3 && (
              <RequestButton
                labelWhenAllowed="+ Adicionar Sensor"
                labelWhenRequest="Solicitar adicionar sensor"
                action="editar_cativeiro_add_sensor"
                payload={{ cativeiroId: id }}
                onSuccess={adicionarCampoSensor}
                style={{ background: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px', padding: '10px 16px', cursor: 'pointer', fontSize: '14px', marginTop: '8px' }}
              />
            )}
          </>
        )}
        <RequestButton
          type="submit"
          className={styles.cadastrarBtn}
          labelWhenAllowed="Atualizar"
          labelWhenRequest="Solicitar atualização"
          action="editar_cativeiro"
          buildPayload={() => {
            const payload = { cativeiroId: id };
            if (nomeCativeiro && nomeCativeiro !== (cativeiro?.nome || '')) payload.nome = nomeCativeiro;
            const originalTipoId = cativeiro?.id_tipo_camarao?._id || cativeiro?.id_tipo_camarao || null;
            const selectedTipoId = (typeof tipoCamarao === 'object') ? (tipoCamarao._id || tipoCamarao.value || '') : (tipoCamarao || '');
            if (selectedTipoId && selectedTipoId !== originalTipoId) payload.id_tipo_camarao = selectedTipoId;
            const originalTemp = (cativeiro?.condicoes_ideais?.temp_ideal ?? cativeiro?.temp_media_diaria ?? '').toString();
            const originalPh = (cativeiro?.condicoes_ideais?.ph_ideal ?? cativeiro?.ph_medio_diario ?? '').toString();
            const originalAmonia = (cativeiro?.condicoes_ideais?.amonia_ideal ?? cativeiro?.amonia_media_diaria ?? '').toString();
            if (tempMedia?.toString() && tempMedia.toString() !== originalTemp) payload.temp_media_diaria = tempMedia;
            if (phMedio?.toString() && phMedio.toString() !== originalPh) payload.ph_medio_diario = phMedio;
            if (amoniaMedia?.toString() && amoniaMedia.toString() !== originalAmonia) payload.amonia_media_diaria = amoniaMedia;
            return payload;
          }}
          onSuccess={handleSubmit}
        />
        
      </form>
      <div className={styles.logoBox}>
        <img src="/images/logo.svg" alt="Camarize Logo" />
      </div>
      <Notification isVisible={notification.show} message={notification.message} type={notification.type} onClose={hideNotification} />
      <NavBottom />
    </div>
  );
} 