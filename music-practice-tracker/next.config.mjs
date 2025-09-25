/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Skip ESLint on builds (Vercel already type-checks/you can lint locally)
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
