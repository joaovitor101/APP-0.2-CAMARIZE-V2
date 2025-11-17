import { useRouter } from 'next/router';
import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import AuthError from "../components/AuthError";
import Loading from "../components/Loading";
import profileStyles from "../components/ProfileContent/ProfileContent.module.css";
import NavBottom from "@/components/NavBottom";

export default function RelatorioGeral() {
  const router = useRouter();
  const { periodo } = router.query;
  const [cativeiros, setCativeiros] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const relatorioRef = useRef();

  useEffect(() => {
    async function fetchCativeiros() {
      try {
        setLoading(true);
        setError(null);
        
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
        const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
        
        if (!token) {
          setError('Você precisa estar logado para acessar esta página');
          setLoading(false);
          return;
        }
        
        const res = await axios.get(`${apiUrl}/cativeiros`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        console.log('Cativeiros carregados:', res.data);
        setCativeiros(res.data);
      } catch (err) {
        console.error('Erro ao buscar cativeiros:', err);
        if (err.response?.status === 401) {
          setError('Sessão expirada. Faça login novamente para continuar.');
        } else {
          setError('Erro ao carregar os dados. Tente novamente.');
        }
        setCativeiros([]);
      } finally {
        setLoading(false);
      }
    }
    fetchCativeiros();
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const handleSavePDF = async () => {
    if (typeof window !== 'undefined') {
      try {
        // Usar uma abordagem mais simples e robusta
        const html2pdf = await import('html2pdf.js');
        const pdf = html2pdf.default || html2pdf;
        
        const opt = {
          margin: 1,
          filename: 'relatorio-geral.pdf',
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2 },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        
        pdf().set(opt).from(relatorioRef.current).save();
      } catch (error) {
        console.error('Erro ao gerar PDF:', error);
        // Fallback: tentar imprimir
        alert('Erro ao gerar PDF. Usando impressão como alternativa.');
        window.print();
      }
    }
  };

  // Se há erro, mostrar tela de erro
  if (error) {
    return (
      <>
        <AuthError error={error} onRetry={() => window.location.reload()} />
        <NavBottom />
      </>
    );
  }

  // Se está carregando, mostrar loading
  if (loading) {
    return (
      <>
        <Loading message="Carregando relatório..." />
        <NavBottom />
      </>
    );
  }

  return (
    <div style={{ minHeight: '100vh', overflowY: 'auto', paddingBottom: '100px' }}>
      <div style={{ maxWidth: 800, margin: '40px auto', background: '#fff', padding: 24, borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', position: 'relative' }}>
      <button className={profileStyles.backBtn} onClick={() => window.history.back()} style={{ position: 'absolute', top: 16, left: 16 }}>
        <span style={{ fontSize: 24, lineHeight: 1 }}>&larr;</span>
      </button>
      <div ref={relatorioRef}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 16 }}>
          <img src="/images/logo.svg" alt="Camarize Logo" style={{ height: 48, marginBottom: 8 }} />
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, textAlign: 'center' }}>RELATÓRIO GERAL DOS TANQUES</h2>
        </div>
        <h3 style={{ textAlign: 'center', margin: '24px 0 8px 0' }}>Período: <span style={{color:'#1976d2',textTransform:'capitalize'}}>{periodo || '...'}</span></h3>
        <div style={{ margin: '24px 0' }}>
          {cativeiros.length === 0 ? (
            <div style={{textAlign:'center',color:'#888'}}>Nenhum tanque encontrado.</div>
          ) : (
            cativeiros.map((cativeiro, idx) => (
              <div key={cativeiro._id} style={{border:'1px solid #eee',borderRadius:8,padding:16,marginBottom:16}}>
                <div style={{fontWeight:600,fontSize:16,marginBottom:4}}>{cativeiro.nome || `Tanque ${idx+1}`}</div>
                <div style={{color:'#555',marginBottom:8}}>{typeof cativeiro.id_tipo_camarao === 'object' && cativeiro.id_tipo_camarao?.nome ? cativeiro.id_tipo_camarao.nome : (cativeiro.id_tipo_camarao || 'Tipo não informado')}</div>
                <div style={{color:'#888',fontSize:14}}>Resumo do período selecionado...</div>
              </div>
            ))
          )}
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
        <button onClick={handlePrint} style={{ padding: '8px 18px', borderRadius: 6, border: 'none', background: '#1976d2', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
          Imprimir
        </button>
        <button onClick={handleSavePDF} style={{ padding: '8px 18px', borderRadius: 6, border: 'none', background: '#43a047', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
          Salvar como PDF
        </button>
      </div>
      <NavBottom />
    </div>
    </div>
  );
} 