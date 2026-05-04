import type { NextConfig } from "next";

const allowedDevOriginsFromEnv = process.env.NEXT_ALLOWED_DEV_ORIGINS
  ? process.env.NEXT_ALLOWED_DEV_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean)
  : [];

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "supervictorious-laurel-idyllically.ngrok-free.dev",
    ...allowedDevOriginsFromEnv,
  ],
};

export default nextConfig;
