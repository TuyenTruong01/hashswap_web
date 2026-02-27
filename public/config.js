// public/config.js
window.APP_CONFIG = {
  appName: "HashSwap",
  networkName: "Hedera Testnet",

  // Backend API (hashswap_code/server.js)
  apiBase: "http://localhost:8787",

  // WalletConnect/Reown Project ID (nếu muốn connect ví)
  // Nếu chưa có, để "" và bạn nhập accountId thủ công ở Faucet tab.
  wcProjectId: "02d98efa25d59c26e9b8652393cc2465",

  // Prefer extension-first (HashPack)
  wallet: {
    preferExtension: true,
    preferredExtensionId: null,
  },

  // UI defaults
  ui: {
    defaultFrom: "hUSD",
    defaultTo: "hEUR",
    slippageDefaultBps: 50, // 0.50%
  },
};