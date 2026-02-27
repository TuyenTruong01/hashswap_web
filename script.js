// script.js (Vite module)
import { DAppConnector } from "@hashgraph/hedera-wallet-connect";
import { LedgerId } from "@hiero-ledger/sdk";
import { Transaction } from "@hashgraph/sdk";

/**
 * =========================
 * DOM helpers
 * =========================
 */
const $ = (sel) => document.querySelector(sel);

const el = {
  // top
  btnConnect: $("#btnConnectTop"),
  btnDisconnect: $("#btnDisconnect"),
  networkName: $("#networkName"),

  // sign toggle
  signModeToggle: $("#signModeToggle"),
  signModeLabel: $("#signModeLabel"),

  // header status
  walletStatus: $("#walletStatus"),
  balancesLine: $("#balancesLine"),

  // swap
  fromAmount: $("#fromAmount"),
  toAmount: $("#toAmount"),
  fromSel: $("#fromTokenSel"),
  toSel: $("#toTokenSel"),
  fromBal: $("#fromBal"),
  toBal: $("#toBal"),
  poolLine: $("#swapPoolLine"),
  rateLine: $("#rateLine"),
  slippageSel: $("#slippageSel"),
  btnSwap: $("#btnSwap"),
  btnFlip: $("#btnFlip"),
  swapMsg: $("#swapMsg"),

  // tabs/panels
  tabSwap: $("#tabSwap"),
  tabLiquidity: $("#tabLiquidity"),
  tabFaucet: $("#tabFaucet"),
  panelSwap: $("#panelSwap"),
  panelLiquidity: $("#panelLiquidity"),
  panelFaucet: $("#panelFaucet"),
  btnReset: $("#btnReset"),

  // liquidity
  liqAmountA: $("#liqAmountA"),
  liqAmountB: $("#liqAmountB"),
  liqTokenA: $("#liqTokenA"),
  liqTokenB: $("#liqTokenB"),
  liqRemovePct: $("#liqRemovePct"),
  btnAddLiquidity: $("#btnAddLiquidity"),
  btnRemoveLiquidity: $("#btnRemoveLiquidity"),
  liqPosLine: $("#liqPosLine"),
  liqEstLine: $("#liqEstLine"),
  liqMsg: $("#liqMsg"),

  // faucet
  faucetAccountId: $("#faucetAccountId"),
  btnFaucetCheck: $("#btnFaucetCheck"),
  btnFaucetClaim: $("#btnFaucetClaim"),
  faucetMsg: $("#faucetMsg"),
};

function getConfig() {
  const cfg = window.APP_CONFIG;
  if (!cfg) throw new Error("Missing APP_CONFIG. Check /public/config.js loaded before script.js");
  return cfg;
}

function isBackendEnabled() {
  const cfg = getConfig();
  return !!cfg.apiBase;
}

function fmt(num, digits = 6) {
  if (num === null || num === undefined) return "0";
  const n = Number(num);
  if (!Number.isFinite(n)) return "0";
  return n.toFixed(digits).replace(/\.?0+$/, "");
}

function setMsg(node, text, ok = true) {
  if (!node) return;
  node.textContent = text || "";
  node.style.color = ok ? "rgba(0,0,0,.70)" : "#b91c1c";
}

/**
 * =========================
 * base64 helpers (browser)
 * =========================
 */
function base64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

/**
 * =========================
 * Global app state
 * =========================
 */
let state = null; // from /api/state (or demo state)
let connectedAccountId = null; // "0.0.x"
let dAppConnector = null;

let lastQuote = null;

/**
 * =========================
 * Tabs
 * =========================
 */
function showPanel(name) {
  el.panelSwap.classList.toggle("hidden", name !== "swap");
  el.panelLiquidity.classList.toggle("hidden", name !== "liq");
  el.panelFaucet.classList.toggle("hidden", name !== "faucet");

  el.tabSwap.classList.toggle("tab--active", name === "swap");
  el.tabLiquidity.classList.toggle("tab--active", name === "liq");
  el.tabFaucet.classList.toggle("tab--active", name === "faucet");
}

/**
 * =========================
 * Backend API
 * =========================
 */
async function apiGet(path) {
  const { apiBase } = getConfig();

  // DEMO MODE: no backend
  if (!apiBase) {
    throw new Error("Backend disabled (demo mode).");
  }

  const r = await fetch(`${apiBase}${path}`);
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j?.ok === false) throw new Error(j?.error || `API ${path} failed: ${r.status}`);
  return j;
}

async function apiPost(path, body) {
  const { apiBase } = getConfig();

  // DEMO MODE: no backend
  if (!apiBase) {
    throw new Error("Backend disabled (demo mode).");
  }

  const r = await fetch(`${apiBase}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j?.ok === false) {
    throw new Error(j?.error || j?.message || `API ${path} failed: ${r.status}`);
  }
  return j;
}

/**
 * =========================
 * Mirror balance fetch
 * =========================
 */
async function fetchBalancesFromMirror(accountId) {
  if (!accountId || !state?.mirror) return {};

  const url = `${state.mirror}/api/v1/accounts/${accountId}/tokens?limit=100`;
  const r = await fetch(url);
  if (!r.ok) return {};

  const j = await r.json();
  const rows = j?.tokens || [];
  const byTokenId = new Map();
  for (const t of rows) byTokenId.set(t.token_id, t.balance);

  const out = {};
  for (const t of state.tokens || []) {
    const units = byTokenId.get(t.tokenId) ?? 0;
    const dec = Number(t.decimals ?? state.decimals ?? 6);
    out[t.symbol] = Number(units) / Math.pow(10, dec);
  }
  return out;
}

async function refreshBalances() {
  if (!connectedAccountId || !state) {
    el.balancesLine.textContent = "hUSD: 0 | hEUR: 0 | hVND: 0";
    el.fromBal.textContent = "0";
    el.toBal.textContent = "0";
    return;
  }

  // Demo mode => just show zeros
  if (!state?.mirror) {
    el.balancesLine.textContent = "hUSD: 0 | hEUR: 0 | hVND: 0";
    el.fromBal.textContent = "0";
    el.toBal.textContent = "0";
    return;
  }

  const bals = await fetchBalancesFromMirror(connectedAccountId);

  el.balancesLine.textContent =
    `hUSD: ${fmt(bals.hUSD || 0, 6)} | ` +
    `hEUR: ${fmt(bals.hEUR || 0, 6)} | ` +
    `hVND: ${fmt(bals.hVND || 0, 6)}`;

  const fromSym = el.fromSel.value;
  const toSym = el.toSel.value;

  el.fromBal.textContent = fmt(bals[fromSym] || 0, 6);
  el.toBal.textContent = fmt(bals[toSym] || 0, 6);
}

/**
 * =========================
 * UI init from /api/state
 * =========================
 */
function fillTokenSelects() {
  const tokens = state?.tokens || [];
  el.fromSel.innerHTML = "";
  el.toSel.innerHTML = "";

  for (const t of tokens) {
    const o1 = document.createElement("option");
    o1.value = t.symbol;
    o1.textContent = t.symbol;
    el.fromSel.appendChild(o1);

    const o2 = document.createElement("option");
    o2.value = t.symbol;
    o2.textContent = t.symbol;
    el.toSel.appendChild(o2);
  }

  const cfg = getConfig();
  el.fromSel.value = cfg.ui?.defaultFrom || (tokens[0]?.symbol ?? "hUSD");
  el.toSel.value = cfg.ui?.defaultTo || (tokens[1]?.symbol ?? "hEUR");
}

function syncWalletStatus() {
  if (connectedAccountId) {
    el.walletStatus.textContent = `Connected: ${connectedAccountId}`;
    el.btnDisconnect.style.display = "inline-flex";
    el.btnConnect.textContent = "Connected";
  } else {
    el.walletStatus.textContent = "Not connected";
    el.btnDisconnect.style.display = "none";
    el.btnConnect.textContent = "Connect";
  }
}

/**
 * =========================
 * Sign toggle
 * =========================
 */
function isWalletSignEnabled() {
  return !!el.signModeToggle?.checked;
}

function syncSignLabel() {
  if (!el.signModeLabel) return;
  el.signModeLabel.textContent = isWalletSignEnabled() ? "Wallet" : "Backend";
}

/**
 * =========================
 * Quote + Rate
 * =========================
 */
let quoteTimer = null;

function getSlippageBps() {
  const v = el.slippageSel.value;
  if (v === "auto") return 50;
  const n = Number(v);
  return Number.isFinite(n) ? n : 50;
}

async function doQuote() {
  if (!state) return;

  const amount = String(el.fromAmount.value || "").trim();
  const from = el.fromSel.value;
  const to = el.toSel.value;

  el.rateLine.textContent = "—";

  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) {
    el.toAmount.value = "";
    lastQuote = null;
    return;
  }

  // Demo mode: show 1:1 estimate, no backend calls
  if (!isBackendEnabled()) {
    lastQuote = {
      amountInTokens: n,
      amountOutTokens: n,
      poolId: "demo",
    };
    el.toAmount.value = fmt(n, 6);
    el.rateLine.textContent = `1 ${from} ≈ 1 ${to} (demo)`;
    el.poolLine.textContent = "Demo (no backend)";
    return;
  }

  try {
    const slippageBps = getSlippageBps();
    const q = await apiGet(
      `/api/quote?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&amount=${encodeURIComponent(
        n
      )}&slippageBps=${slippageBps}`
    );

    lastQuote = q;
    el.toAmount.value = fmt(q.amountOutTokens, 6);

    const rate = q.amountOutTokens / q.amountInTokens;
    el.rateLine.textContent = `1 ${from} ≈ ${fmt(rate, 6)} ${to}`;
    el.poolLine.textContent = q.poolId || state.pool?.id || "—";
  } catch (e) {
    lastQuote = null;
    el.toAmount.value = "";
    setMsg(el.swapMsg, `Quote error: ${e.message}`, false);
  }
}

function scheduleQuote() {
  clearTimeout(quoteTimer);
  quoteTimer = setTimeout(doQuote, 200);
}

/**
 * =========================
 * Wallet connect
 * =========================
 */
function makeMetadata() {
  const cfg = getConfig();
  return {
    name: cfg.appName || "HashSwap",
    description: "HashSwap demo: backend builds tx, wallet can sign and submit via backend",
    url: window.location.origin,
    icons: [`${window.location.origin}/assets/logo.png`],
  };
}

async function initWalletIfPossible() {
  const cfg = getConfig();
  if (!cfg.wcProjectId) return null;

  dAppConnector = new DAppConnector(makeMetadata(), LedgerId.TESTNET, cfg.wcProjectId);
  await dAppConnector.init({ logger: "error" });

  if (dAppConnector.signers?.length) {
    connectedAccountId = dAppConnector.signers[dAppConnector.signers.length - 1].getAccountId().toString();
  }
  return dAppConnector;
}

function findHashPackExtension(connector, cfg) {
  const exts = connector?.extensions || [];
  if (!exts.length) return null;

  if (cfg.wallet?.preferredExtensionId) {
    return exts.find((e) => e.id === cfg.wallet.preferredExtensionId) || null;
  }
  return exts.find((e) => (e.name || "").toLowerCase().includes("hashpack")) || null;
}

async function connectWallet() {
  const cfg = getConfig();

  if (!cfg.wcProjectId) {
    alert("Chưa có wcProjectId → bạn có thể nhập accountId thủ công ở Faucet tab.");
    showPanel("faucet");
    el.faucetAccountId.focus();
    return;
  }

  if (!dAppConnector) await initWalletIfPossible();
  if (!dAppConnector) return;

  try {
    const hashpackExt = findHashPackExtension(dAppConnector, cfg);
    if (cfg.wallet?.preferExtension && hashpackExt?.available) {
      await dAppConnector.connectExtension(hashpackExt.id);
    } else {
      await dAppConnector.openModal();
    }

    if (dAppConnector.signers?.length) {
      connectedAccountId = dAppConnector.signers[dAppConnector.signers.length - 1].getAccountId().toString();
    }

    el.faucetAccountId.value = connectedAccountId || "";
    syncWalletStatus();
    await refreshBalances();
    await doQuote();
    await refreshLiquidityPosition();
  } catch {
    alert("Connect fail / cancelled.");
  }
}

async function disconnectAll() {
  try {
    if (dAppConnector) await dAppConnector.disconnectAll();
  } catch {}
  connectedAccountId = null;
  syncWalletStatus();
  await refreshBalances();
  await refreshLiquidityPosition();
}

/**
 * =========================
 * Wallet sign + submit
 * =========================
 */
async function walletSignAndSubmit(pendingId, txBytesBase64) {
  if (!dAppConnector?.signers?.length) throw new Error("Wallet not connected");
  const signer = dAppConnector.signers[dAppConnector.signers.length - 1];

  const txBytes = base64ToBytes(txBytesBase64);
  const tx = Transaction.fromBytes(txBytes);

  const signedTx = await signer.signTransaction(tx);
  const signedTxBase64 = bytesToBase64(signedTx.toBytes());

  const out = await apiPost("/api/tx/submit", {
    pendingId,
    signedTxBase64,
  });

  return out;
}

/**
 * =========================
 * Swap
 * =========================
 */
async function doSwap() {
  try {
    setMsg(el.swapMsg, "");

    if (!isBackendEnabled()) {
      throw new Error("Demo mode: backend disabled.");
    }

    if (!connectedAccountId) {
      throw new Error("Chưa có accountId. Hãy Connect ví hoặc nhập accountId ở Faucet.");
    }

    const amount = Number(el.fromAmount.value);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Amount không hợp lệ.");

    const from = el.fromSel.value;
    const to = el.toSel.value;
    const slippageBps = getSlippageBps();

    el.btnSwap.disabled = true;

    const walletSignEnabled = isWalletSignEnabled();
    let txId = "";

    if (walletSignEnabled) {
      const poolKey = state?.pool?.poolKey || "hUSD-hEUR";

      const build = await apiPost("/api/tx/build/swap", {
        poolKey,
        accountId: connectedAccountId,
        from,
        to,
        amount,
        slippageBps,
      });

      const submitted = await walletSignAndSubmit(build.pendingId, build.txBytesBase64);
      txId = submitted.txId || "";

      setMsg(el.swapMsg, `✅ Swap (wallet-sign) OK. Tx: ${txId}`);
    } else {
      const res = await apiPost("/api/swap", {
        accountId: connectedAccountId,
        from,
        to,
        amount,
        slippageBps,
      });

      txId = res.txId || res.transactionId || "";
      setMsg(el.swapMsg, `✅ Swap (backend-sign) OK. Tx: ${txId}`);
    }

    await new Promise((r) => setTimeout(r, 1200));
    await refreshBalances();
    await doQuote();
    await refreshLiquidityPosition();
  } catch (e) {
    setMsg(el.swapMsg, `❌ Swap failed: ${e.message}`, false);
  } finally {
    el.btnSwap.disabled = false;
  }
}

/**
 * =========================
 * Liquidity UI helpers
 * =========================
 */
function getDefaultPoolKey() {
  return state?.pool?.poolKey || state?.pools?.[0]?.poolKey || "hUSD-hEUR";
}

async function refreshLiquidityPosition() {
  try {
    if (!connectedAccountId || !state) {
      el.liqPosLine.textContent = "—";
      el.liqEstLine.textContent = "—";
      return;
    }

    // Demo mode: no backend
    if (!isBackendEnabled()) {
      el.liqPosLine.textContent = "Demo (no backend)";
      el.liqEstLine.textContent = "—";
      return;
    }

    const poolKey = getDefaultPoolKey();
    const j = await apiGet(
      `/api/liquidity/position?accountId=${encodeURIComponent(connectedAccountId)}&poolKey=${encodeURIComponent(poolKey)}`
    );

    const symA = state.pool?.tokenA?.symbol || "tokenA";
    const symB = state.pool?.tokenB?.symbol || "tokenB";

    el.liqPosLine.textContent = `${fmt(j.depositedA, 6)} ${symA} | ${fmt(j.depositedB, 6)} ${symB}`;
    el.liqEstLine.textContent = `${fmt(j.estimateRemoveAll.amountA, 6)} ${symA} | ${fmt(
      j.estimateRemoveAll.amountB,
      6
    )} ${symB}`;
  } catch {
    // silent
  }
}

function calcLiquidityB(amountA) {
  if (!state?.reserves) return 0;
  const { reserveA, reserveB } = state.reserves;
  if (!reserveA || !reserveB) return 0;
  const price = reserveB / reserveA;
  return amountA * price;
}

/**
 * Liquidity: Add (wallet-sign)
 */
async function doAddLiquidity() {
  try {
    setMsg(el.liqMsg, "");

    if (!isBackendEnabled()) throw new Error("Demo mode: backend disabled.");
    if (!connectedAccountId) throw new Error("Connect wallet first");

    const amountA = Number(el.liqAmountA.value);
    if (!Number.isFinite(amountA) || amountA <= 0) throw new Error("Invalid amountA");

    const poolKey = getDefaultPoolKey();

    el.btnAddLiquidity.disabled = true;

    const build = await apiPost("/api/tx/build/liquidity/add", {
      poolKey,
      accountId: connectedAccountId,
      amountA,
    });

    const submitted = await walletSignAndSubmit(build.pendingId, build.txBytesBase64);
    setMsg(el.liqMsg, `✅ Liquidity added. Tx: ${submitted.txId || ""}`);

    await new Promise((r) => setTimeout(r, 1200));
    state = await apiGet("/api/state");
    await refreshBalances();
    await doQuote();
    await refreshLiquidityPosition();
  } catch (e) {
    setMsg(el.liqMsg, `❌ ${e.message}`, false);
  } finally {
    el.btnAddLiquidity.disabled = false;
  }
}

/**
 * Liquidity: Remove (wallet-sign)
 */
async function doRemoveLiquidity() {
  try {
    setMsg(el.liqMsg, "");

    if (!isBackendEnabled()) throw new Error("Demo mode: backend disabled.");
    if (!connectedAccountId) throw new Error("Connect wallet first");

    const percent = Number(el.liqRemovePct.value);
    if (!Number.isFinite(percent) || percent <= 0 || percent > 100) throw new Error("Invalid percent (1..100)");

    const poolKey = getDefaultPoolKey();

    el.btnRemoveLiquidity.disabled = true;

    const build = await apiPost("/api/tx/build/liquidity/remove", {
      poolKey,
      accountId: connectedAccountId,
      percent,
    });

    const submitted = await walletSignAndSubmit(build.pendingId, build.txBytesBase64);
    setMsg(el.liqMsg, `✅ Liquidity removed. Tx: ${submitted.txId || ""}`);

    await new Promise((r) => setTimeout(r, 1200));
    state = await apiGet("/api/state");
    await refreshBalances();
    await doQuote();
    await refreshLiquidityPosition();
  } catch (e) {
    setMsg(el.liqMsg, `❌ ${e.message}`, false);
  } finally {
    el.btnRemoveLiquidity.disabled = false;
  }
}

/**
 * =========================
 * Faucet
 * =========================
 */
async function faucetCheck() {
  try {
    setMsg(el.faucetMsg, "");

    if (!isBackendEnabled()) throw new Error("Demo mode: backend disabled.");

    const accountId = String(el.faucetAccountId.value || "").trim();
    if (!accountId) throw new Error("Nhập Account ID.");
    const j = await apiGet(`/api/faucet/status?accountId=${encodeURIComponent(accountId)}`);
    setMsg(el.faucetMsg, JSON.stringify(j, null, 2));
  } catch (e) {
    setMsg(el.faucetMsg, `❌ ${e.message}`, false);
  }
}

async function faucetClaim() {
  try {
    setMsg(el.faucetMsg, "");

    if (!isBackendEnabled()) throw new Error("Demo mode: backend disabled.");

    const accountId = String(el.faucetAccountId.value || "").trim();
    if (!accountId) throw new Error("Nhập Account ID.");

    const j = await apiPost("/api/faucet/claim", { accountId });
    setMsg(el.faucetMsg, `✅ Claimed. Tx: ${j.txId || j.transactionId || ""}`);

    if (accountId === connectedAccountId) {
      await new Promise((r) => setTimeout(r, 1200));
      await refreshBalances();
    }
  } catch (e) {
    setMsg(el.faucetMsg, `❌ ${e.message}`, false);
  }
}

/**
 * =========================
 * Main
 * =========================
 */
async function main() {
  const cfg = getConfig();
  const backendEnabled = !!cfg.apiBase;

  if (el.networkName) el.networkName.textContent = cfg.networkName || "Hedera Testnet";

  if (backendEnabled) {
    // load state from backend
    state = await apiGet("/api/state");
    fillTokenSelects();

    el.poolLine.textContent = state.pool?.id || "—";
    if (el.liqTokenA) el.liqTokenA.textContent = state.pool?.tokenA?.symbol || "tokenA";
    if (el.liqTokenB) el.liqTokenB.textContent = state.pool?.tokenB?.symbol || "tokenB";
  } else {
    // DEMO MODE state (minimal UI only)
    state = {
      tokens: [
        { symbol: "hUSD", tokenId: "", decimals: 6 },
        { symbol: "hEUR", tokenId: "", decimals: 6 },
        { symbol: "hVND", tokenId: "", decimals: 6 },
      ],
      pool: { id: "demo", poolKey: "hUSD-hEUR", tokenA: { symbol: "hUSD" }, tokenB: { symbol: "hEUR" } },
      reserves: { reserveA: 1, reserveB: 1 },
      mirror: "", // no mirror in demo
      decimals: 6,
    };

    fillTokenSelects();
    el.poolLine.textContent = "Demo (no backend)";
    if (el.liqTokenA) el.liqTokenA.textContent = "hUSD";
    if (el.liqTokenB) el.liqTokenB.textContent = "hEUR";

    // Disable actions that require backend
    if (el.btnSwap) el.btnSwap.disabled = true;
    if (el.btnAddLiquidity) el.btnAddLiquidity.disabled = true;
    if (el.btnRemoveLiquidity) el.btnRemoveLiquidity.disabled = true;
    if (el.btnFaucetCheck) el.btnFaucetCheck.disabled = true;
    if (el.btnFaucetClaim) el.btnFaucetClaim.disabled = true;

    setMsg(el.swapMsg, "Demo mode: backend disabled", false);
    setMsg(el.liqMsg, "Demo mode: backend disabled", false);
    setMsg(el.faucetMsg, "Demo mode: backend disabled", false);
  }

  // init wallet (optional)
  await initWalletIfPossible();

  if (connectedAccountId) el.faucetAccountId.value = connectedAccountId;

  // init sign toggle
  if (el.signModeToggle) {
    el.signModeToggle.checked = false; // default Backend
    syncSignLabel();
    el.signModeToggle.addEventListener("change", () => syncSignLabel());
  }

  syncWalletStatus();
  await refreshBalances();
  await doQuote();
  await refreshLiquidityPosition();

  // handlers
  el.tabSwap.addEventListener("click", () => showPanel("swap"));
  el.tabLiquidity.addEventListener("click", () => showPanel("liq"));
  el.tabFaucet.addEventListener("click", () => showPanel("faucet"));

  el.btnConnect.addEventListener("click", connectWallet);
  el.btnDisconnect.addEventListener("click", disconnectAll);

  el.fromAmount.addEventListener("input", scheduleQuote);
  el.fromSel.addEventListener("change", async () => {
    await refreshBalances();
    await doQuote();
  });
  el.toSel.addEventListener("change", async () => {
    await refreshBalances();
    await doQuote();
  });
  el.slippageSel.addEventListener("change", doQuote);

  el.btnFlip.addEventListener("click", async () => {
    const a = el.fromSel.value;
    el.fromSel.value = el.toSel.value;
    el.toSel.value = a;
    await refreshBalances();
    await doQuote();
  });

  el.btnSwap.addEventListener("click", doSwap);

  // liquidity auto-fill B when input A
  el.liqAmountA.addEventListener("input", () => {
    const v = Number(el.liqAmountA.value);
    if (!Number.isFinite(v)) return;
    el.liqAmountB.value = fmt(calcLiquidityB(v), 6);
  });

  el.btnAddLiquidity.addEventListener("click", doAddLiquidity);
  el.btnRemoveLiquidity.addEventListener("click", doRemoveLiquidity);

  el.btnFaucetCheck.addEventListener("click", faucetCheck);
  el.btnFaucetClaim.addEventListener("click", faucetClaim);

  el.btnReset.addEventListener("click", async () => {
    el.fromAmount.value = "";
    el.toAmount.value = "";
    setMsg(el.swapMsg, "");
    await doQuote();
  });

  window.__hashswap = {
    get state() {
      return state;
    },
    get accountId() {
      return connectedAccountId;
    },
    refreshBalances,
    doQuote,
    doSwap,
  };
}

main().catch((e) => {
  console.error(e);
  alert(e.message || String(e));
});