import { useRouter } from "next/router";
import styles from "./NavBottom.module.css";

export default function NavBottom({ homeRef, settingsRef, requestsRef, notificationsRef, profileRef }) {
  const router = useRouter();
  return (
    <nav className={styles.navBottom}>
      <button ref={homeRef} onClick={() => router.push('/home')}><img src="/images/home.svg" alt="Home" /></button>
      <button ref={settingsRef} onClick={() => router.push('/settings')}><img src="/images/settings.svg" alt="Settings" /></button>
      {/* <button ref={plusRef} onClick={() => router.push('/create-cativeiros')} className={styles.plusButton}>
        <img src="/images/plus.svg" alt="Adicionar" className={styles.plusIcon} />
      </button> */}
      <button ref={requestsRef} onClick={() => router.push('/requests')} title="Minhas Solicitações">
        <img src="/images/history.svg" alt="Minhas Solicitações" />
      </button>
      <button ref={notificationsRef} onClick={() => router.push('/notifications')}><img src="/images/bell.svg" alt="Notificações" /></button>
      <button ref={profileRef} onClick={() => router.push('/profile')}><img src="/images/user.svg" alt="Perfil" /></button>
    </nav>
  );
}
