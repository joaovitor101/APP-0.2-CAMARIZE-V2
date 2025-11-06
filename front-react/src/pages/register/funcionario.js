import styles from "@/components/LoginContent/LoginContent.module.css";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState, useEffect } from "react";

export default function RegisterFuncionarioPage() {
  const router = useRouter();
  const [userData, setUserData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const storedData = typeof window !== 'undefined' 
      ? sessionStorage.getItem('pendingRegistration') || localStorage.getItem('pendingRegistration')
      : null;
    
    if (storedData) {
      try {
        const parsed = JSON.parse(storedData);
        if (parsed.tipoUsuario !== 'funcionario') {
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
    setLoading(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      
      // Cadastrar funcionário diretamente (sem solicitação, sem fazenda associada)
      const response = await fetch(`${apiUrl}/users/register/funcionario`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: userData.nome,
          email: userData.email,
          senha: userData.senha,
          foto_perfil: null
          // Não envia fazendaId - será associado depois pelo admin via solicitação
        })
      });

      if (response.ok) {
        // Login automático após cadastro
        const loginRes = await fetch(`${apiUrl}/users/auth`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: userData.email, senha: userData.senha })
        });

        if (loginRes.ok) {
          const loginData = await loginRes.json();
          if (typeof window !== 'undefined') {
            localStorage.setItem("token", loginData.token);
            sessionStorage.setItem("token", loginData.token);
            
            // Buscar o usuário pelo id do token
            const decoded = JSON.parse(atob(loginData.token.split('.')[1]));
            const userId = decoded.id;
            const userRes = await fetch(`${apiUrl}/users/${userId}`);
            const usuario = await userRes.json();
            localStorage.setItem("usuarioCamarize", JSON.stringify(usuario));
            sessionStorage.setItem("usuarioCamarize", JSON.stringify(usuario));
          }

          // Limpar dados temporários
          if (typeof window !== 'undefined') {
            sessionStorage.removeItem('pendingRegistration');
            localStorage.removeItem('pendingRegistration');
          }

          // Redireciona para home
          router.push("/home");
        } else {
          setError("Erro ao fazer login automático após cadastro.");
        }
      } else {
        const errorData = await response.text();
        setError(`Erro ao cadastrar: ${errorData}`);
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
      <form className={styles.loginForm} onSubmit={handleRegister}>
        <h2 className={styles.loginTitle}>Cadastro de Funcionário</h2>
        <p style={{ textAlign: 'center', marginBottom: '24px', color: '#666', fontSize: '14px' }}>
          Revise seus dados e confirme o cadastro
        </p>

        <div style={{ 
          padding: '16px', 
          background: '#f8f9fa', 
          borderRadius: '8px', 
          marginBottom: '20px',
          border: '1px solid #e9ecef'
        }}>
          <div style={{ marginBottom: '12px' }}>
            <strong>Nome:</strong> {userData.nome}
          </div>
          <div style={{ marginBottom: '12px' }}>
            <strong>Email:</strong> {userData.email}
          </div>
          <div style={{ marginBottom: '12px' }}>
            <strong>Tipo:</strong> Funcionário
          </div>
        </div>


        {error && <div className={styles.errorMsg}>{error}</div>}

        <button
          type="submit"
          className={styles.loginButton}
          disabled={loading}
          style={{ 
            background: loading 
              ? "linear-gradient(90deg, #ccc 0%, #999 100%)" 
              : "linear-gradient(90deg, #667eea 0%, #764ba2 100%)", 
            color: "#fff",
            cursor: loading ? "not-allowed" : "pointer"
          }}
        >
          {loading ? "Cadastrando..." : "Confirmar Cadastro"}
        </button>

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

