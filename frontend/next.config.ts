import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Достъп до dev сървъра от LAN (друго устройство отваря http://192.168.1.146:3000):
  // Next 15.2+ блокира cross-origin dev заявки по подразбиране — HMR websocket-ът
  // (ws://192.168.1.146:3000/_next/hmr) се отказва без този списък.
  allowedDevOrigins: ["192.168.1.146"],
};

export default nextConfig;
