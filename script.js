// ================================
// HashSwap Public SAFE Frontend
// Swap + Liquidity disabled
// Faucet still active
// ================================

const $ = (sel) => document.querySelector(sel);

const el = {
  btnConnect: $("#btnConnectTop"),
  btnDisconnect: $("#btnDisconnect"),
  walletStatus: $("#walletStatus"),

  tabSwap: $("#tabSwap"),
  tabLiquidity: $("#tabLiquidity"),
  tabFaucet: $("#tabFaucet"),

  panelSwap: $("#panelSwap"),
  panelLiquidity: $("#panelLiquidity"),
  panelFaucet: $("#panelFaucet"),

  // faucet
  faucetAccountId: $("#faucetAccountId"),
  btnFaucetCheck: $("#btnFaucetCheck"),
  btnFaucetClaim: $("#btnFaucetClaim"),
  faucetMsg: $("#faucetMsg"),

  balancesLine: $("#balancesLine"),
};

let state = null;
let connectedAccountId = null;

/**
 * =========================
 * Helpers
 * =========================
 */
function getConfig() {
  return window.APP_CONFIG;
}

function setMsg(node, text, ok = true) {
  if (!node) return;
  node.textContent = text || "";
  node.style.color = ok ? "#222" : "#b91c1c";
}

async function apiGet(path) {
  const { apiBase } = getConfig();
  const r = await fetch(`${apiBase}${path}`);
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j?.ok === false) throw new Error(j?.error || "API error");
  return j;
}

async function apiPost(path, body) {
  const { apiBase } = getConfig();
  const r = await fetch(`${apiBase}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j?.ok === false) throw new Error(j?.error || "API error");
  return j;
}

/**
 * =========================
 * Wallet Connect (basic)
 * =========================
 */
async function connectWallet() {
  // SAFE VERSION: chỉ cho nhập accountId thủ công
  alert("Public mode: Please paste your Hedera Account ID manually.");
  showPanel("faucet");
}

function disconnectWallet() {
  connectedAccountId = null;
  el.walletStatus.textContent = "Not connected";
}

/**
 * =========================
 * Faucet
 * =========================
 */
async function faucetCheck() {
  try {
    setMsg(el.faucetMsg, "");

    const accountId = el.faucetAccountId.value.trim();
    if (!accountId) throw new Error("Enter Account ID");

    const res = await apiGet(`/api/faucet/status?accountId=${accountId}`);

    setMsg(
      el.faucetMsg,
      JSON.stringify(res, null, 2),
      true
    );
  } catch (e) {
    setMsg(el.faucetMsg, e.message, false);
  }
}

async function faucetClaim() {
  try {
    setMsg(el.faucetMsg, "");

    const accountId = el.faucetAccountId.value.trim();
    if (!accountId) throw new Error("Enter Account ID");

    const res = await apiPost("/api/faucet/claim", { accountId });

    setMsg(
      el.faucetMsg,
      `Success. Tx: ${res.txId}`,
      true
    );
  } catch (e) {
    setMsg(el.faucetMsg, e.message, false);
  }
}

/**
 * =========================
 * Tabs
 * =========================
 */
function showPanel(name) {
  el.panelSwap.classList.toggle("hidden", name !== "swap");
  el.panelLiquidity.classList.toggle("hidden", name !== "liq");
  el.panelFaucet.classList.toggle("hidden", name !== "faucet");
}

/**
 * =========================
 * Disable Swap + Liquidity
 * =========================
 */
function disableSwapUI() {
  if (el.panelSwap) {
    el.panelSwap.innerHTML =
      "<div style='padding:20px'>Swap disabled in public mode.</div>";
  }
}

function disableLiquidityUI() {
  if (el.panelLiquidity) {
    el.panelLiquidity.innerHTML =
      "<div style='padding:20px'>Liquidity disabled in public mode.</div>";
  }
}

/**
 * =========================
 * Init
 * =========================
 */
async function main() {
  try {
    state = await apiGet("/api/state");

    el.walletStatus.textContent = "Public Mode";

    disableSwapUI();
    disableLiquidityUI();

    el.tabSwap.addEventListener("click", () => showPanel("swap"));
    el.tabLiquidity.addEventListener("click", () => showPanel("liq"));
    el.tabFaucet.addEventListener("click", () => showPanel("faucet"));

    el.btnConnect?.addEventListener("click", connectWallet);
    el.btnDisconnect?.addEventListener("click", disconnectWallet);

    el.btnFaucetCheck?.addEventListener("click", faucetCheck);
    el.btnFaucetClaim?.addEventListener("click", faucetClaim);

    showPanel("faucet");
  } catch (e) {
    alert("Init error: " + e.message);
  }
}

main();