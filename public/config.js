// public/config.js

const isLocalhost =
  location.hostname === "localhost" ||
  location.hostname === "127.0.0.1";

window.APP_CONFIG = {
  appName: "HashSwap",
  networkName: "Hedera Testnet",

  // Nếu chạy local → dùng backend
  // Nếu chạy Vercel → không gọi backend
  apiBase: isLocalhost ? "http://localhost:8787" : "",

  wcProjectId: "02d98efa25d59c26e9b8652393cc2465",

  wallet: {
    preferExtension: true,
    preferredExtensionId: null,
  },

  ui: {
    defaultFrom: "hUSD",
    defaultTo: "hEUR",
    slippageDefaultBps: 50,
  },
};