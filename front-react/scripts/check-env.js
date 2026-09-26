#!/usr/bin/env node
if (process.env.VERCEL_ENV === 'production') {
  const required = ['NEXT_PUBLIC_API_URL', 'NEXT_PUBLIC_SSE_URL'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(
      `\n❌ Build de produção abortado: variáveis ausentes: ${missing.join(', ')}\n` +
      'Configure-as em Vercel → Settings → Environment Variables (ambiente Production).\n'
    );
    process.exit(1);
  }
}
