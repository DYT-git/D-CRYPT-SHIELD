import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow your phone to access the development server
  allowedDevOrigins: ["10.96.118.246", "localhost", "127.0.0.1"],
};

export default nextConfig;
