import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  headers: async () => {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value:
              "default-src 'self' https:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://m.stripe.network https://js.stripe.com https://q.stripe.com https://gc.kis.v2.scr.kaspersky-labs.com; style-src 'self' 'unsafe-inline' https:; frame-src 'self' https://js.stripe.com https://m.stripe.network https://gc.kis.v2.scr.kaspersky-labs.com; connect-src 'self' http://localhost:* https:; img-src 'self' data: https:; font-src 'self' data: https:",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
