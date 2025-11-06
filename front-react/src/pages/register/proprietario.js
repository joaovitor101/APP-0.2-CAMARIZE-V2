import styles from "@/components/LoginContent/LoginContent.module.css";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState, useEffect } from "react";

export default function RegisterProprietarioPage() {
  const router = useRouter();
  const [userData, setUserData] = useState(null);
  const [fazenda, setFazenda] = useState({
    nome: "",
    rua: "",
    bairro: "",
    cidade: "",
    numero: ""
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const storedData = typeof window !== 'undefined' 
      ? sessionStorage.getItem('pendingRegistration') || localStorage.getItem('pendingRegistration')
      : null;
    
    if (storedData) {
      try {
        const parsed = JSON.parse(storedData);
        if (parsed.tipoUsuario !== 'proprietario') {
          router.push("/register-type");
          return;
        }
        setUserData(parsed);
      } catch (e) {
        router.push("/register");
      }
    } else {
      router.push("/register");
    }
  }, [router]);

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!userData) return;
    
    setError("");
    
    // Validar dados da fazenda
    if (!fazenda.nome || !fazenda.rua || !fazenda.bairro || !fazenda.cidade || !fazenda.numero) {
      setError("Todos os campos da fazenda são obrigatórios.");
      return;
    }

    setLoading(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      
      // Criar solicitação de cadastro de proprietário
      const response = await fetch(`${apiUrl}/users/register/proprietario`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: userData.nome,
          email: userData.email,
          senha: userData.senha,
          foto_perfil: null,
          fazenda: fazenda
        })
      });

      if (response.ok) {
        const data = await response.json();
        
        // Limpar dados temporários
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('pendingRegistration');
          localStorage.removeItem('pendingRegistration');
        }

        // Redireciona para página de sucesso/aguardando aprovação
        router.push(`/register/sucesso?requestId=${data.requestId}&email=${encodeURIComponent(userData.email)}`);
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Erro ao enviar solicitação de cadastro.");
      }
    } catch (error) {
      setError(`Erro de conexão: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!userData) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Carregando...</div>;
  }

  return (
    <div className={styles.loginMobileWrapper}>
      <form className={styles.loginForm} onSubmit={handleRegister} style={{ maxWidth: '500px' }}>
        <h2 className={styles.loginTitle}>Cadastro de Proprietário</h2>
        <p style={{ textAlign: 'center', marginBottom: '24px', color: '#666', fontSize: '14px' }}>
          Preencha seus dados e os dados da sua fazenda
        </p>

        {/* Dados do usuário (readonly) */}
        <div style={{ 
          padding: '16px', 
          background: '#f8f9fa', 
          borderRadius: '8px', 
          marginBottom: '20px',
          border: '1px solid #e9ecef'
        }}>
          <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: '#333' }}>Seus Dados</h3>
          <div style={{ marginBottom: '8px' }}>
            <strong>Nome:</strong> {userData.nome}
          </div>
          <div>
            <strong>Email:</strong> {userData.email}
          </div>
        </div>

        {/* Dados da fazenda */}
        <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: '#333' }}>Dados da Fazenda</h3>
        
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', fontSize: '14px' }}>Nome da Fazenda *</label>
          <input
            type="text"
            className={styles.input}
            value={fazenda.nome}
            onChange={e => setFazenda({ ...fazenda, nome: e.target.value })}
            placeholder="Nome da fazenda"
            required
          />
        </div>

        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', fontSize: '14px' }}>Rua *</label>
          <input
            type="text"
            className={styles.input}
            value={fazenda.rua}
            onChange={e => setFazenda({ ...fazenda, rua: e.target.value })}
            placeholder="Rua"
            required
          />
        </div>

        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', fontSize: '14px' }}>Bairro *</label>
          <input
            type="text"
            className={styles.input}
            value={fazenda.bairro}
            onChange={e => setFazenda({ ...fazenda, bairro: e.target.value })}
            placeholder="Bairro"
            required
          />
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <div style={{ flex: 2 }}>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', fontSize: '14px' }}>Cidade *</label>
            <input
              type="text"
              className={styles.input}
              value={fazenda.cidade}
              onChange={e => setFazenda({ ...fazenda, cidade: e.target.value })}
              placeholder="Cidade"
              required
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', fontSize: '14px' }}>Número *</label>
            <input
              type="text"
              className={styles.input}
              value={fazenda.numero}
              onChange={e => setFazenda({ ...fazenda, numero: e.target.value })}
              placeholder="Nº"
              required
            />
          </div>
        </div>

        {error && <div className={styles.errorMsg}>{error}</div>}

        <button
          type="submit"
          className={styles.loginButton}
          disabled={loading}
          style={{ background: "linear-gradient(90deg, #f093fb 0%, #f5576c 100%)", color: "#fff" }}
        >
          {loading ? "Enviando solicitação..." : "Enviar Solicitação"}
        </button>

        <div style={{ 
          marginTop: '16px', 
          padding: '12px', 
          background: '#fff3cd', 
          borderRadius: '8px', 
          border: '1px solid #ffc107',
          fontSize: '13px',
          color: '#856404'
        }}>
          ⚠️ <strong>Atenção:</strong> Sua solicitação será enviada para análise do Master. Você receberá um email quando seu cadastro for aprovado.
        </div>

        <div className={styles.registerRow}>
          <span>Voltar para seleção?</span>
          <Link href="/register-type" className={styles.registerLink}>Voltar</Link>
        </div>
      </form>
      <div className={styles.logoWrapper}>
        <Image src="/images/logo.svg" alt="Camarize Logo" width={180} height={40} />
      </div>
    </div>
  );
}

