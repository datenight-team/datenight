/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  // Allow access from local network IPs (e.g. when opening on another device)
  allowedDevOrigins: ['192.168.1.26'],
};

export default nextConfig;
