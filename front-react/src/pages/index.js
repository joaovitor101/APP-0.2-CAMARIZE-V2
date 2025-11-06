import Head from "next/head";
import styles from "@/styles/StartScreen.module.css";
import Image from "next/image";
import { useRouter } from "next/router";
import { useEffect } from "react";

export default function StartScreen() {
  const router = useRouter();
  useEffect(() => {
    try {
      const raw = localStorage.getItem('usuarioCamarize');
      const user = raw ? JSON.parse(raw) : null;
      const role = user?.role || 'membro';
      if (role === 'master') router.replace('/master');
      else if (role === 'admin') router.replace('/admin');
      else {
        // mantém a tela inicial com botão conectar
      }
    } catch {}
  }, []);
  return (
    <>
      <Head>
        <title>Camarize - Início</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <main className={styles.startMain}>
        <div className={styles.logoBox}>
          <Image 
            src="/images/logo.svg" 
            alt="Logo" 
            width={360} 
            height={120} 
            sizes="(max-width: 600px) 80vw, 360px"
          />
        </div>
        <div className={styles.waveBg}></div>
        <button className={styles.startButton} onClick={() => router.push("/register-type")}>Conecte-se</button>
      </main>
    </>
  );
} 