import styles from "@/components/LoginContent/LoginContent.module.css";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import axios from "axios";

export default function AuthPage() {
  const router = useRouter();
  const { tipo } = router.query;
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [nome, setNome] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);

  // Se não tiver tipo, redireciona para register-type
  useEffect(() => {
    if (router.isReady && !tipo) {
      router.push("/register-type");
    }
  }, [router.isReady, tipo, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

      // Primeiro, tenta fazer login
      try {
        const loginResponse = await axios.post(`${apiUrl}/users/auth`, { email, senha });
        
        // Login bem-sucedido
        if (typeof window !== 'undefined') {
          sessionStorage.setItem("token", loginResponse.data.token);
          localStorage.setItem("token", loginResponse.data.token);
        }

        // Buscar o usuário autenticado
        const meRes = await axios.get(`${apiUrl}/users/me`, {
          headers: { Authorization: `Bearer ${loginResponse.data.token}` }
        });
        const usuario = meRes.data;
        
        if (typeof window !== 'undefined') {
          sessionStorage.setItem("usuarioCamarize", JSON.stringify(usuario));
          localStorage.setItem("usuarioCamarize", JSON.stringify(usuario));
        }

        // Verificar se o tipo do usuário bate com o tipo selecionado
        const userRole = usuario?.role || 'membro';
        const expectedRole = tipo === 'funcionario' ? 'membro' : 'admin';
        
        if (userRole !== expectedRole) {
          setError(`Este email está cadastrado como ${userRole === 'membro' ? 'funcionário' : 'proprietário'}. Por favor, selecione o tipo correto.`);
          setLoading(false);
          return;
        }

        // Redireciona conforme a role
        if (userRole === 'master') router.push('/master');
        else if (userRole === 'admin') router.push('/admin');
        else router.push('/home');
        return;
      } catch (loginError) {
        // Se login falhou, verifica se é porque o usuário não existe
        const loginErrorStatus = loginError?.response?.status;
        
        // Se for erro 404 (usuário não encontrado), vamos criar a conta
        if (loginErrorStatus === 404) {
          // Se não tiver nome preenchido e estiver tentando criar, pede nome
          if (!nome || !nome.trim()) {
            setIsRegistering(true);
            setError("Preencha seu nome para criar uma nova conta.");
            setLoading(false);
            return;
          }

          // Criar conta
          if (tipo === 'funcionario') {
            const registerResponse = await axios.post(`${apiUrl}/users/register/funcionario`, {
              nome: nome.trim(),
              email: email.trim(),
              senha: senha,
              foto_perfil: null
            });

            // Após criar, fazer login automático
            const loginRes = await axios.post(`${apiUrl}/users/auth`, { email, senha });
            
            if (typeof window !== 'undefined') {
              sessionStorage.setItem("token", loginRes.data.token);
              localStorage.setItem("token", loginRes.data.token);
            }

            const meRes = await axios.get(`${apiUrl}/users/me`, {
              headers: { Authorization: `Bearer ${loginRes.data.token}` }
            });
            const usuario = meRes.data;
            
            if (typeof window !== 'undefined') {
              sessionStorage.setItem("usuarioCamarize", JSON.stringify(usuario));
              localStorage.setItem("usuarioCamarize", JSON.stringify(usuario));
            }

            router.push('/home');
          } else if (tipo === 'proprietario') {
            // Para proprietário, ainda precisa criar solicitação
            // Por enquanto, vamos criar uma solicitação
            const registerResponse = await axios.post(`${apiUrl}/users/register/proprietario`, {
              nome: nome.trim(),
              email: email.trim(),
              senha: senha,
              foto_perfil: null,
              fazenda: {
                nome: '', // Será preenchido depois
                rua: '',
                bairro: '',
                cidade: '',
                numero: ''
              }
            });

            // Redireciona para página de sucesso
            router.push(`/register/sucesso?requestId=${registerResponse.data.requestId}&email=${encodeURIComponent(email)}`);
          }
        } else {
          // Outros erros de login (senha incorreta, etc)
          // Se o usuário preencheu nome, tenta criar conta mesmo assim
          if (nome && nome.trim()) {
            // Tentar criar conta
            try {
              if (tipo === 'funcionario') {
                const registerResponse = await axios.post(`${apiUrl}/users/register/funcionario`, {
                  nome: nome.trim(),
                  email: email.trim(),
                  senha: senha,
                  foto_perfil: null
                });

                // Após criar, fazer login automático
                const loginRes = await axios.post(`${apiUrl}/users/auth`, { email, senha });
                
                if (typeof window !== 'undefined') {
                  sessionStorage.setItem("token", loginRes.data.token);
                  localStorage.setItem("token", loginRes.data.token);
                }

                const meRes = await axios.get(`${apiUrl}/users/me`, {
                  headers: { Authorization: `Bearer ${loginRes.data.token}` }
                });
                const usuario = meRes.data;
                
                if (typeof window !== 'undefined') {
                  sessionStorage.setItem("usuarioCamarize", JSON.stringify(usuario));
                  localStorage.setItem("usuarioCamarize", JSON.stringify(usuario));
                }

                router.push('/home');
                return;
              } else if (tipo === 'proprietario') {
                const registerResponse = await axios.post(`${apiUrl}/users/register/proprietario`, {
                  nome: nome.trim(),
                  email: email.trim(),
                  senha: senha,
                  foto_perfil: null,
                  fazenda: {
                    nome: '',
                    rua: '',
                    bairro: '',
                    cidade: '',
                    numero: ''
                  }
                });

                router.push(`/register/sucesso?requestId=${registerResponse.data.requestId}&email=${encodeURIComponent(email)}`);
                return;
              }
            } catch (registerError) {
              // Se der erro ao criar (email já existe, etc)
              setError(registerError?.response?.data?.error || "Erro ao criar conta. Verifique os dados e tente novamente.");
              setLoading(false);
              return;
            }
          } else {
            setError("Email ou senha incorretos. Verifique suas credenciais ou preencha o nome para criar uma nova conta.");
            setLoading(false);
          }
        }
      }
    } catch (error) {
      console.error('Erro:', error);
      setError(error?.response?.data?.error || "Erro ao processar sua solicitação. Tente novamente.");
      setLoading(false);
    }
  };

  if (!tipo) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Carregando...</div>;
  }

  const tipoLabel = tipo === 'funcionario' ? 'Funcionário' : 'Proprietário';
  const tipoIcon = tipo === 'funcionario' ? '👷' : '🏢';
  const tipoGradient = tipo === 'funcionario' 
    ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
    : 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)';

  return (
    <div className={styles.loginMobileWrapper}>
      <form className={styles.loginForm} onSubmit={handleSubmit}>
        <div style={{ 
          textAlign: 'center', 
          marginBottom: '24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px'
        }}>
          <span style={{ fontSize: '48px' }}>{tipoIcon}</span>
          <h2 className={styles.loginTitle} style={{ marginBottom: '8px' }}>
            {isRegistering ? `Cadastre-se como ${tipoLabel}` : `Entre como ${tipoLabel}`}
          </h2>
          <p style={{ 
            color: '#6b7280', 
            fontSize: '14px',
            margin: 0
          }}>
            {isRegistering 
              ? 'Preencha seus dados para criar sua conta'
              : 'Digite seu email e senha. Se não tiver conta, preencha o nome para criar.'
            }
          </p>
        </div>

        {isRegistering && (
          <div className={styles.inputGroup}>
            <input
              type="text"
              name="nome"
              placeholder="Nome completo"
              className={styles.input}
              value={nome}
              onChange={e => setNome(e.target.value)}
              autoComplete="name"
              required
            />
          </div>
        )}

        <div className={styles.inputGroup}>
          <input
            type="email"
            name="email"
            placeholder="Email"
            className={styles.input}
            value={email}
            onChange={e => {
              setEmail(e.target.value);
              setError("");
            }}
            autoComplete="email"
            required
          />
        </div>

        <div className={styles.inputGroup}>
          <input
            type={showPassword ? "text" : "password"}
            name="password"
            placeholder="Senha"
            className={styles.input}
            value={senha}
            onChange={e => {
              setSenha(e.target.value);
              setError("");
            }}
            autoComplete={isRegistering ? "new-password" : "current-password"}
            required
          />
          <span
            className={styles.eyeIcon}
            onClick={() => setShowPassword((v) => !v)}
            tabIndex={0}
            role="button"
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
          >
            {showPassword ? (
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path d="M12 5C7 5 2.73 8.11 1 12c1.73 3.89 6 7 11 7s9.27-3.11 11-7c-1.73-3.89-6-7-11-7Zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10Z" fill="#888"/><circle cx="12" cy="12" r="2.5" fill="#888"/></svg>
            ) : (
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path d="M2 2l20 20M12 5c-5 0-9.27 3.11-11 7a12.35 12.35 0 0 0 5.29 5.29M17.94 17.94A11.94 11.94 0 0 0 23 12c-1.73-3.89-6-7-11-7a11.94 11.94 0 0 0-5.29 1.29" stroke="#888" strokeWidth="2"/><path d="M9.5 9.5a3 3 0 0 1 4.24 4.24" stroke="#888" strokeWidth="2"/></svg>
            )}
          </span>
        </div>

        {!isRegistering && (
          <div style={{ 
            marginBottom: '16px',
            padding: '12px',
            background: '#f0f9ff',
            border: '1px solid #bae6fd',
            borderRadius: '8px',
            fontSize: '13px',
            color: '#0369a1'
          }}>
            💡 <strong>Dica:</strong> Se você não tem conta, preencha o nome abaixo e clique novamente para criar.
          </div>
        )}

        {!isRegistering && (
          <div className={styles.inputGroup}>
            <input
              type="text"
              name="nome"
              placeholder="Nome completo (opcional - para criar conta)"
              className={styles.input}
              value={nome}
              onChange={e => setNome(e.target.value)}
              autoComplete="name"
            />
          </div>
        )}

        {error && <div className={styles.errorMsg}>{error}</div>}

        <button
          type="submit"
          className={styles.loginButton}
          disabled={loading || !email || !senha || (isRegistering && !nome)}
          style={{ 
            background: loading 
              ? "linear-gradient(90deg, #ccc 0%, #999 100%)" 
              : tipoGradient, 
            color: "#fff",
            cursor: (loading || !email || !senha || (isRegistering && !nome)) ? "not-allowed" : "pointer"
          }}
        >
          {loading 
            ? (isRegistering ? "Criando conta..." : "Entrando...") 
            : (isRegistering ? "Criar Conta" : "Entrar")
          }
        </button>

        <div className={styles.registerRow}>
          <span>Deseja escolher outro tipo?</span>
          <Link href="/register-type" className={styles.registerLink}>Voltar</Link>
        </div>
      </form>
      <div className={styles.logoWrapper}>
        <Image src="/images/logo.svg" alt="Camarize Logo" width={180} height={40} />
      </div>
    </div>
  );
}

