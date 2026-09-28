/** @type {import('next').NextConfig} */
const nextConfig = {
  // Usar output: 'export' apenas em produção para manter a funcionalidade de exportação estática
  ...(process.env.NODE_ENV === 'production' && { output: 'export' }),
  trailingSlash: false,
  images: {
    unoptimized: true
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    // SSE precisa de conexão direta (sem passar pelo proxy do Next.js que buferiza streaming)
    NEXT_PUBLIC_SSE_URL: process.env.NEXT_PUBLIC_SSE_URL,
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "BHRkSsllT2m1OmHkc6xsGdN7CpJFm0zHrfDuA4xh14kMt750uWzOsSNc5tI7wUS3Y_qYF6CjBBfyfIrlZgCY9cs"
  },
  // Configuração para melhorar o Fast Refresh
  experimental: {
    esmExternals: false
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:4000/:path*"
      }
    ];
  }
};

module.exports = nextConfig; 