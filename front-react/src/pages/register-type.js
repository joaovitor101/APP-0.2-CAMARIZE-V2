import styles from "@/components/LoginContent/LoginContent.module.css";
import Image from "next/image";
import { useRouter } from "next/router";
import { useState, useEffect } from "react";

export default function RegisterTypePage() {
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (router.isReady) {
      setIsReady(true);
    }
  }, [router.isReady]);

  const handleSelectType = (tipo) => {
    console.log('Tipo selecionado:', tipo);
    if (!isReady) {
      console.log('Router não está pronto ainda, aguardando...');
      return;
    }
    
    // Usar window.location diretamente para garantir que funciona
    window.location.href = `/auth?tipo=${tipo}`;
  };

  return (
    <div className={styles.loginMobileWrapper} style={{ 
      background: '#ffffff',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '20px'
    }}>
      <div className={styles.loginForm} style={{ 
        maxWidth: '500px', 
        width: '100%',
        background: 'transparent',
        border: 'none',
        boxShadow: 'none',
        padding: '0'
      }}>
        {/* Título principal - Pergunta grande */}
        <h1 style={{ 
          fontSize: '36px',
          fontWeight: '700',
          color: '#1f2937',
          textAlign: 'center',
          marginBottom: '48px',
          letterSpacing: '-0.8px',
          lineHeight: '1.2'
        }}>
          Você é proprietário ou funcionário?
        </h1>

        {/* Cards de seleção */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '32px' }}>
          {/* Card Funcionário */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('Botão funcionário clicado');
              handleSelectType('funcionario');
            }}
            style={{
              width: '100%',
              padding: '28px 24px',
              borderRadius: '16px',
              border: 'none',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: '#ffffff',
              fontWeight: '600',
              fontSize: '18px',
              cursor: 'pointer',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
              boxShadow: '0 4px 14px rgba(102, 126, 234, 0.25)',
              position: 'relative',
              overflow: 'hidden',
              zIndex: 1,
              pointerEvents: 'auto'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 12px 28px rgba(102, 126, 234, 0.35)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 14px rgba(102, 126, 234, 0.25)';
            }}
          >
            <span style={{ 
              fontSize: '48px', 
              lineHeight: '1',
              filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))'
            }}>
              👷
            </span>
            <span style={{ 
              fontSize: '20px', 
              fontWeight: '700',
              letterSpacing: '-0.3px'
            }}>
              Funcionário
            </span>
            <span style={{ 
              fontSize: '14px', 
              opacity: 0.95, 
              fontWeight: '400',
              textAlign: 'center',
              lineHeight: '1.4'
            }}>
              Entre ou cadastre-se como funcionário
            </span>
          </button>

          {/* Card Proprietário */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('Botão proprietário clicado');
              handleSelectType('proprietario');
            }}
            style={{
              width: '100%',
              padding: '28px 24px',
              borderRadius: '16px',
              border: 'none',
              background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
              color: '#ffffff',
              fontWeight: '600',
              fontSize: '18px',
              cursor: 'pointer',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
              boxShadow: '0 4px 14px rgba(245, 87, 108, 0.25)',
              position: 'relative',
              overflow: 'hidden',
              zIndex: 1,
              pointerEvents: 'auto'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 12px 28px rgba(245, 87, 108, 0.35)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 14px rgba(245, 87, 108, 0.25)';
            }}
          >
            <span style={{ 
              fontSize: '48px', 
              lineHeight: '1',
              filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))'
            }}>
              🏢
            </span>
            <span style={{ 
              fontSize: '20px', 
              fontWeight: '700',
              letterSpacing: '-0.3px'
            }}>
              Proprietário
            </span>
            <span style={{ 
              fontSize: '14px', 
              opacity: 0.95, 
              fontWeight: '400',
              textAlign: 'center',
              lineHeight: '1.4'
            }}>
              Entre ou cadastre-se como proprietário
            </span>
          </button>
        </div>

      </div>
      
      {/* Logo */}
      <div style={{
        marginTop: '40px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        <Image 
          src="/images/logo.svg" 
          alt="Camarize Logo" 
          width={180} 
          height={40}
          style={{
            filter: 'opacity(0.9)'
          }}
        />
      </div>
    </div>
  );
}

