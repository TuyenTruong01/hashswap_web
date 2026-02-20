// public/config.js
window.APP_CONFIG = {
  appName: "TempoSwap",

  // ===== Tempo Moderato Testnet =====
  chain: {
    chainIdHex: "0xa5bf", // 42431
    chainName: "Tempo Moderato",
    rpcUrls: ["https://rpc.moderato.tempo.xyz"],
    // Tempo uses fee tokens; still keep a placeholder nativeCurrency for wallet UI compatibility
    nativeCurrency: { name: "Tempo", symbol: "TEMPO", decimals: 18 },
    // If you have an explorer URL, put it here; otherwise keep empty array
    blockExplorerUrls: []
  },

  // ===== Contracts (deployed) =====
  contracts: {
    TOKENS: {
      PATHUSD:  "0x63b76b6d0244fd5DcC76BF3a42403b216639F6B7",
      ALPHAUSD: "0xD14AB69ed05C960dc0496b4d32CF4c974fF16264",
      BETAUSD:  "0x51EcC9913A0fB21C9Daa433e8C14c9f0118567Fe",
      THETAUSD: "0x7003e64ecaCdaff1fE990466A1C372C4593Fe7d6"
    },
    FAUCET: "0x58611f480c4070Ff30f6C2c535D689E2A081Fc63",
    POOLS: {
      PATH_ALPHA: "0xbbB2Ff14F4a2d3E80088D4dbfE4C2dC5204Deb52",
      PATH_BETA:  "0x9f646af18368aE46893f33FDBb0Df6E64ed7D0C4",
      PATH_THETA: "0x47c3A88FDa64c81A7bBf493Efbb97324014FB838"
    }
  },

  // ✅ UI labels (ONLY display names, onchain contracts unchanged)
  labels: {
    // token key -> display label
    PATHUSD: "USDC",
    ALPHAUSD: "USDT",
    BETAUSD: "BICI",
    THETAUSD: "HOUSE",

    // optional pool labels
    PATH_ALPHA: "USDC/USDT",
    PATH_BETA: "USDC/BICI",
    PATH_THETA: "USDC/HOUSE"
  },

  // ===== ABI paths (served from Vite public/) =====
  abi: {
    erc20: "/abi/erc20.json",
    faucet: "/abi/faucet.json",
    amm: "/abi/fxpool.json"
  },

  // ===== Function mapping =====
  fn: {
    // Faucet (MultiFaucet)
    faucetClaimPath: "claimPath",
    faucetClaimAlpha: "claimAlpha",
    faucetClaimBeta: "claimBeta",
    faucetClaimTheta: "claimTheta",
    faucetCanClaim: "canClaim",

    // AMM (SimpleAMM Option B)
    ammReserves: "reserves",
    ammGetAmountOut: "getAmountOut",
    ammSwap: "swap",
    ammAddLiquidity: "addLiquidity",
    ammRemoveLiquidity: "removeLiquidity",
    ammSharesOf: "sharesOf",
    ammTotalShares: "totalShares"
  },

  ui: {
    // swap defaults (still using onchain token keys)
    defaultFrom: "PATHUSD",
    defaultTo: "ALPHAUSD",
    slippageDefaultPct: 0.5,

    // routing: only PATH as base (still onchain key)
    baseToken: "PATHUSD"
  }
};