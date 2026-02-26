// public/config.js
window.APP_CONFIG = {
  appName: "TipiSwap",

  // ===== IoTeX Testnet =====
  chain: {
    chainIdHex: "0x1252", // 4690
    chainName: "IoTeX Testnet",
    rpcUrls: ["https://babel-api.testnet.iotex.io"],
    nativeCurrency: { name: "IoTeX", symbol: "IOTX", decimals: 18 },
    blockExplorerUrls: ["https://testnet.iotexscan.io"]
  },

  // ===== Contracts (deployed) =====
  contracts: {
    TOKENS: {
      TPI: "0xB21d98e7c364b7b947e9B02bB53a2d361557C1bC",
      TXI: "0x03ee39B1e6Fb726429350199bf6056664c6cE3Ee"
    },
    FAUCET: "0x1C87525CDB3027A24617496EF6d7447b95cE21da",
    POOLS: {
      TPI_TXI: "0xb06DF8063B6582918f5Bfe1dEBf6beA03F51c534"
    }
  },

  // ✅ UI labels (ONLY display names)
  labels: {
    TPI: "TPI",
    TXI: "TXI",
    TPI_TXI: "TPI/TXI"
  },

  // ===== ABI paths (served from public/) =====
  abi: {
    erc20: "/abi/erc20.json",
    faucet: "/abi/faucet.json",
    amm: "/abi/fxpool.json"
  },

  // ===== Function mapping =====
  fn: {
    // Faucet (DualFaucet)
    faucetClaimTPI: "claimTPI",
    faucetClaimTXI: "claimTXI",
    faucetCanClaim: "canClaim",

    // AMM (SimpleAMM)
    ammReserves: "reserves",
    ammGetAmountOut: "getAmountOut",
    ammSwap: "swap",
    ammAddLiquidity: "addLiquidity",
    ammRemoveLiquidity: "removeLiquidity",
    ammSharesOf: "sharesOf",
    ammTotalShares: "totalShares"
  },

  ui: {
    defaultFrom: "TPI",
    defaultTo: "TXI",
    slippageDefaultPct: 0.5,
    baseToken: "TPI"
  }
};