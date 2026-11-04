import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 셀프호스팅(도커)용 standalone 출력. 모노레포라 추적 기준을 레포 루트로.
  output: 'standalone',
  outputFileTracingRoot: path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'),
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'w0nder.work',
      },
      {
        protocol: 'https',
        hostname: 'w0nder.land',
      },
    ],
  },
  async redirects() {
    return [
      {
        source: '/about',
        destination: '/',
        permanent: false, // 302 리다이렉트
      },
    ];
  },
};

export default nextConfig;
