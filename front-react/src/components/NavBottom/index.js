import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import styles from "./NavBottom.module.css";

export default function NavBottom({ homeRef, settingsRef, requestsRef, notificationsRef, profileRef }) {
  const router = useRouter();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 600);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <nav 
      className={styles.navBottom}
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        width: '100vw',
        background: '#fff',
        borderTop: '1px solid #eee',
        justifyContent: 'space-around',
        alignItems: 'center',
        height: '56px',
        zIndex: 100,
        display: isMobile ? 'flex' : 'none'
      }}
    >
      <button 
        ref={homeRef} 
        onClick={() => router.push('/home')}
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
      >
        <img src="/images/home.svg" alt="Home" style={{ width: '32px', height: '32px' }} />
      </button>
      <button 
        ref={settingsRef} 
        onClick={() => router.push('/settings')}
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
      >
        <img src="/images/settings.svg" alt="Settings" style={{ width: '32px', height: '32px' }} />
      </button>
      {/* <button ref={plusRef} onClick={() => router.push('/create-cativeiros')} className={styles.plusButton}>
        <img src="/images/plus.svg" alt="Adicionar" className={styles.plusIcon} />
      </button> */}
      <button 
        ref={requestsRef} 
        onClick={() => router.push('/requests')} 
        title="Minhas Solicitações"
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
      >
        <img src="/images/history.svg" alt="Minhas Solicitações" style={{ width: '32px', height: '32px' }} />
      </button>
      <button 
        ref={notificationsRef} 
        onClick={() => router.push('/notifications')}
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
      >
        <img src="/images/bell.svg" alt="Notificações" style={{ width: '32px', height: '32px' }} />
      </button>
      <button 
        ref={profileRef} 
        onClick={() => router.push('/profile')}
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
      >
        <img src="/images/user.svg" alt="Perfil" style={{ width: '32px', height: '32px' }} />
      </button>
    </nav>
  );
}
