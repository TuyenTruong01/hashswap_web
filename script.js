// script.js (Vite module)
import { ethers } from "ethers";

(function () {
  const CFG = window.APP_CONFIG;
  if (!CFG) {
    alert("Missing APP_CONFIG. Check /public/config.js loaded before script.js");
    return;
  }

  // ===== Label helpers (ONLY UI) =====
  const LABELS = CFG.labels || {};
  const labelOf = (sym) => LABELS[sym] || sym;
  const poolLabelOf = (poolKey) => LABELS[poolKey] || poolKey;

  // ===== DOM =====
  const networkNameEl = document.getElementById("networkName");
  const btnConnectTop = document.getElementById("btnConnectTop");
  const btnDisconnect = document.getElementById("btnDisconnect");
  const btnReset = document.getElementById("btnReset");

  const walletStatusEl = document.getElementById("walletStatus");
  const balancesLineEl = document.getElementById("balancesLine");

  const tabSwap = document.getElementById("tabSwap");
  const tabLiquidity = document.getElementById("tabLiquidity");
  const tabFaucet = document.getElementById("tabFaucet");

  const panelSwap = document.getElementById("panelSwap");
  const panelLiquidity = document.getElementById("panelLiquidity");
  const panelFaucet = document.getElementById("panelFaucet");

  // Swap DOM
  const fromAmountEl = document.getElementById("fromAmount");
  const toAmountEl = document.getElementById("toAmount");
  const fromBalEl = document.getElementById("fromBal");
  const toBalEl = document.getElementById("toBal");
  const rateLineEl = document.getElementById("rateLine");
  const swapPoolLineEl = document.getElementById("swapPoolLine");
  const slippageSel = document.getElementById("slippageSel");
  const btnFlip = document.getElementById("btnFlip");
  const btnSwap = document.getElementById("btnSwap");
  const swapMsg = document.getElementById("swapMsg");
  const fromTokenSel = document.getElementById("fromTokenSel");
  const toTokenSel = document.getElementById("toTokenSel");

  // Faucet DOM
  const btnClaimPATH = document.getElementById("btnClaimPATH");
  const btnClaimALPHA = document.getElementById("btnClaimALPHA");
  const btnClaimBETA = document.getElementById("btnClaimBETA");
  const btnClaimTHETA = document.getElementById("btnClaimTHETA");
  const faucetMsg = document.getElementById("faucetMsg");

  // Liquidity DOM
  const liqPoolSel = document.getElementById("liqPoolSel");
  const liqRatioEl = document.getElementById("liqRatio");
  const lpSharesLineEl = document.getElementById("lpSharesLine");
  const liqAAmountEl = document.getElementById("liqAAmount");
  const liqBAmountEl = document.getElementById("liqBAmount");
  const liqABalEl = document.getElementById("liqABal");
  const liqBBalEl = document.getElementById("liqBBal");
  const liqATagEl = document.getElementById("liqATag");
  const liqBTagEl = document.getElementById("liqBTag");
  const liqALabelEl = document.getElementById("liqALabel");
  const liqBLabelEl = document.getElementById("liqBLabel");
  const liqPreviewEl = document.getElementById("liqPreview");
  const btnAddLiquidity = document.getElementById("btnAddLiquidity");
  const liqRemoveSharesEl = document.getElementById("liqRemoveShares");
  const btnRemoveLiquidity = document.getElementById("btnRemoveLiquidity");
  const liqMsg = document.getElementById("liqMsg");

  // ===== State =====
  let provider = null;
  let signer = null;
  let account = null;

  let erc20Abi = null;
  let faucetAbi = null;
  let ammAbi = null;

  const TOKENS = CFG.contracts.TOKENS;
  const POOLS = CFG.contracts.POOLS;

  // token contracts
  const tokenCtrs = {}; // symbol -> Contract
  const tokenDec = {};  // symbol -> number

  // faucet
  let faucet = null;

  // current pool contract for swap/liquidity
  let activePoolKey = "PATH_ALPHA"; // PATH_ALPHA | PATH_BETA | PATH_THETA
  let amm = null;

  // swap tokens (onchain keys)
  let fromToken = CFG.ui.defaultFrom || "PATHUSD";
  let toToken = CFG.ui.defaultTo || "ALPHAUSD";

  // liquidity input sync
  let liqLastEdited = "A"; // "A" | "B"
  let liqIsSyncing = false;

  // ===== Helpers =====
  const setMsg = (el, text) => (el.textContent = text || "");
  const shortAddr = (a) => (a ? a.slice(0, 6) + "…" + a.slice(-4) : "");

  function trimNum(x) {
    const n = Number(x);
    if (!isFinite(n)) return "0";
    if (n === 0) return "0";
    if (Math.abs(n) < 0.0001) return n.toExponential(2);
    return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
  }

  async function fetchJson(path) {
    const r = await fetch(path, { cache: "no-store" });
    if (!r.ok) throw new Error(`Fetch failed ${path}: ${r.status}`);
    return await r.json();
  }

  async function ensureChain() {
    const eth = window.ethereum;
    if (!eth) throw new Error("No injected wallet found (window.ethereum missing).");

    const target = String(CFG.chain.chainIdHex || "").toLowerCase();
    if (!target) throw new Error("Missing CFG.chain.chainIdHex in public/config.js");

    const cur = String(await eth.request({ method: "eth_chainId" })).toLowerCase();
    if (cur === target) return;

    try {
      await eth.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: CFG.chain.chainIdHex }]
      });
    } catch (e) {
      if (e?.code === 4902 || String(e?.message || "").toLowerCase().includes("unrecognized")) {
        await eth.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: CFG.chain.chainIdHex,
            chainName: CFG.chain.chainName,
            rpcUrls: CFG.chain.rpcUrls,
            nativeCurrency: CFG.chain.nativeCurrency,
            blockExplorerUrls: CFG.chain.blockExplorerUrls
          }]
        });
      } else {
        throw e;
      }
    }
  }

  async function loadAbisOnce() {
    if (erc20Abi && faucetAbi && ammAbi) return;
    [erc20Abi, faucetAbi, ammAbi] = await Promise.all([
      fetchJson(CFG.abi.erc20),
      fetchJson(CFG.abi.faucet),
      fetchJson(CFG.abi.amm),
    ]);
  }

  function setConnectedUI(yes) {
    btnConnectTop.textContent = yes ? "Connected" : "Connect Wallet";
    if (btnDisconnect) btnDisconnect.style.display = yes ? "inline-flex" : "none";
  }

  function setTab(which) {
    const isSwap = which === "swap";
    const isLiq = which === "liq";
    const isFaucet = which === "faucet";

    tabSwap.classList.toggle("tab--active", isSwap);
    tabLiquidity.classList.toggle("tab--active", isLiq);
    tabFaucet.classList.toggle("tab--active", isFaucet);

    panelSwap.classList.toggle("hidden", !isSwap);
    panelLiquidity.classList.toggle("hidden", !isLiq);
    panelFaucet.classList.toggle("hidden", !isFaucet);

    setMsg(swapMsg, "");
    setMsg(liqMsg, "");
    setMsg(faucetMsg, "");
  }

  function resolvePoolForPair(a, b) {
    // Only support PATHUSD <-> (ALPHA/BETA/THETA)
    const base = CFG.ui.baseToken || "PATHUSD";
    if (a === base && b === "ALPHAUSD") return "PATH_ALPHA";
    if (a === "ALPHAUSD" && b === base) return "PATH_ALPHA";

    if (a === base && b === "BETAUSD") return "PATH_BETA";
    if (a === "BETAUSD" && b === base) return "PATH_BETA";

    if (a === base && b === "THETAUSD") return "PATH_THETA";
    if (a === "THETAUSD" && b === base) return "PATH_THETA";

    return null;
  }

  function getPoolAddress(poolKey) {
    if (poolKey === "PATH_ALPHA") return POOLS.PATH_ALPHA;
    if (poolKey === "PATH_BETA") return POOLS.PATH_BETA;
    if (poolKey === "PATH_THETA") return POOLS.PATH_THETA;
    return null;
  }

  function makeAmm(poolKey) {
    const addr = getPoolAddress(poolKey);
    if (!addr) return null;
    const conn = signer || provider;
    return new ethers.Contract(addr, ammAbi, conn);
  }

  function makeContracts() {
    if (!provider) return;

    const conn = signer || provider;

    // tokens
    for (const sym of Object.keys(TOKENS)) {
      tokenCtrs[sym] = new ethers.Contract(TOKENS[sym], erc20Abi, conn);
    }

    faucet = new ethers.Contract(CFG.contracts.FAUCET, faucetAbi, conn);

    // active amm
    amm = makeAmm(activePoolKey);
  }

  function getSlippagePct() {
    const v = slippageSel.value;
    if (v === "auto") return Number(CFG.ui.slippageDefaultPct || 0.5);
    return Number(v);
  }

  function setSwapSelects() {
    fromTokenSel.value = fromToken;
    toTokenSel.value = toToken;
  }

  function setSwapPoolLine() {
    const paddr = getPoolAddress(activePoolKey);
    swapPoolLineEl.textContent = paddr
      ? `${poolLabelOf(activePoolKey)} (${paddr.slice(0, 8)}…${paddr.slice(-4)})`
      : "—";
  }

  function enforceSwapPair() {
    const base = CFG.ui.baseToken || "PATHUSD";

    // disallow same token
    if (fromToken === toToken) {
      toToken = (fromToken === base) ? "ALPHAUSD" : base;
      setSwapSelects();
    }

    const poolKey = resolvePoolForPair(fromToken, toToken);
    if (!poolKey) {
      // force to base routing: if neither is base, set "to" = base
      if (fromToken !== base) {
        toToken = base;
      } else {
        toToken = "ALPHAUSD";
      }
      setSwapSelects();
    }

    activePoolKey = resolvePoolForPair(fromToken, toToken) || "PATH_ALPHA";
    amm = makeAmm(activePoolKey);

    setSwapPoolLine();
  }

  async function refreshBalances() {
    if (!provider || !account) {
      balancesLineEl.textContent = `${labelOf("PATHUSD")}: 0 | ${labelOf("ALPHAUSD")}: 0 | ${labelOf("BETAUSD")}: 0 | ${labelOf("THETAUSD")}: 0`;
      fromBalEl.textContent = "0";
      toBalEl.textContent = "0";
      liqABalEl.textContent = "0";
      liqBBalEl.textContent = "0";
      lpSharesLineEl.textContent = "—";
      return;
    }

    try {
      const syms = ["PATHUSD", "ALPHAUSD", "BETAUSD", "THETAUSD"];

      const bals = await Promise.all(
        syms.map((s) => tokenCtrs[s].balanceOf(account))
      );

      const fmt = {};
      for (let i = 0; i < syms.length; i++) {
        const s = syms[i];
        const d = tokenDec[s] ?? 6;
        fmt[s] = ethers.formatUnits(bals[i], d);
      }

      balancesLineEl.textContent =
        `${labelOf("PATHUSD")}: ${trimNum(fmt.PATHUSD)} | ${labelOf("ALPHAUSD")}: ${trimNum(fmt.ALPHAUSD)} | ${labelOf("BETAUSD")}: ${trimNum(fmt.BETAUSD)} | ${labelOf("THETAUSD")}: ${trimNum(fmt.THETAUSD)}`;

      fromBalEl.textContent = trimNum(fmt[fromToken] || "0");
      toBalEl.textContent = trimNum(fmt[toToken] || "0");

      // liquidity balance display depends on selected pool
      const liqPair = getLiquidityPair();
      liqABalEl.textContent = trimNum(fmt[liqPair.a] || "0");
      liqBBalEl.textContent = trimNum(fmt[liqPair.b] || "0");

      // lp shares (active pool in liquidity selector, not swap)
      const pool = makeAmm(liqPair.poolKey);
      if (pool) {
        const [myShares, totalShares] = await Promise.all([
          pool[CFG.fn.ammSharesOf](account),
          pool[CFG.fn.ammTotalShares](),
        ]);
        lpSharesLineEl.textContent = `${myShares.toString()} / ${totalShares.toString()}`;
      } else {
        lpSharesLineEl.textContent = "—";
      }
    } catch (_) {}
  }

  function getLiquidityPair() {
    // based on liqPoolSel
    const key = liqPoolSel.value || "PATH_ALPHA";
    if (key === "PATH_ALPHA") return { a: "PATHUSD", b: "ALPHAUSD", poolKey: "PATH_ALPHA" };
    if (key === "PATH_BETA") return { a: "PATHUSD", b: "BETAUSD", poolKey: "PATH_BETA" };
    return { a: "PATHUSD", b: "THETAUSD", poolKey: "PATH_THETA" };
  }

  function setLiquidityLabels() {
    const p = getLiquidityPair();
    liqALabelEl.textContent = `${labelOf(p.a)} amount`;
    liqBLabelEl.textContent = `${labelOf(p.b)} amount`;
    liqATagEl.textContent = labelOf(p.a);
    liqBTagEl.textContent = labelOf(p.b);
  }

  async function connect() {
    setMsg(swapMsg, "");
    setMsg(liqMsg, "");
    setMsg(faucetMsg, "");

    const eth = window.ethereum;
    if (!eth) {
      setMsg(swapMsg, "No wallet detected. Install MetaMask/Rabby/Bitget (enable ONE at a time).");
      return;
    }

    try {
      await loadAbisOnce();
      await ensureChain();

      provider = new ethers.BrowserProvider(eth);

      const accs = await eth.request({ method: "eth_requestAccounts" });
      account = accs?.[0] || null;

      signer = await provider.getSigner();
      makeContracts();

      // decimals
      const syms = ["PATHUSD", "ALPHAUSD", "BETAUSD", "THETAUSD"];
      const decs = await Promise.all(syms.map((s) => tokenCtrs[s].decimals()));
      for (let i = 0; i < syms.length; i++) tokenDec[syms[i]] = Number(decs[i]);

      networkNameEl.textContent = CFG.chain.chainName;
      walletStatusEl.textContent = `Connected: ${shortAddr(account)}`;
      setConnectedUI(true);

      // Set faucet button labels (UI only)
      if (btnClaimPATH) btnClaimPATH.textContent = `Claim 100 ${labelOf("PATHUSD")}`;
      if (btnClaimALPHA) btnClaimALPHA.textContent = `Claim 100 ${labelOf("ALPHAUSD")}`;
      if (btnClaimBETA) btnClaimBETA.textContent = `Claim 100 ${labelOf("BETAUSD")}`;
      if (btnClaimTHETA) btnClaimTHETA.textContent = `Claim 100 ${labelOf("THETAUSD")}`;

      enforceSwapPair();
      setLiquidityLabels();

      await refreshBalances();
      await updateQuote();
      await syncLiquidityInputs();
    } catch (e) {
      console.error(e);
      const msg = e?.shortMessage || e?.message || String(e);
      setMsg(swapMsg, `Connect failed: ${msg}`);
      setConnectedUI(false);
    }
  }

  function disconnect() {
    provider = null;
    signer = null;
    account = null;

    for (const k of Object.keys(tokenCtrs)) delete tokenCtrs[k];
    for (const k of Object.keys(tokenDec)) delete tokenDec[k];

    faucet = null;
    amm = null;

    walletStatusEl.textContent = "Not connected";
    balancesLineEl.textContent = `${labelOf("PATHUSD")}: 0 | ${labelOf("ALPHAUSD")}: 0 | ${labelOf("BETAUSD")}: 0 | ${labelOf("THETAUSD")}: 0`;
    fromBalEl.textContent = "0";
    toBalEl.textContent = "0";
    liqABalEl.textContent = "0";
    liqBBalEl.textContent = "0";
    lpSharesLineEl.textContent = "—";

    fromAmountEl.value = "";
    toAmountEl.value = "";
    rateLineEl.textContent = "—";
    swapPoolLineEl.textContent = "—";

    liqAAmountEl.value = "";
    liqBAmountEl.value = "";
    liqRatioEl.textContent = "—";
    liqPreviewEl.textContent = "You will add: —";
    liqRemoveSharesEl.value = "";

    setMsg(swapMsg, "");
    setMsg(liqMsg, "");
    setMsg(faucetMsg, "");

    fromToken = CFG.ui.defaultFrom || "PATHUSD";
    toToken = CFG.ui.defaultTo || "ALPHAUSD";
    activePoolKey = "PATH_ALPHA";

    setConnectedUI(false);
  }

  async function resetAll() {
    fromAmountEl.value = "";
    toAmountEl.value = "";
    rateLineEl.textContent = "—";

    liqAAmountEl.value = "";
    liqBAmountEl.value = "";
    liqRatioEl.textContent = "—";
    liqPreviewEl.textContent = "You will add: —";
    liqRemoveSharesEl.value = "";

    setMsg(swapMsg, "");
    setMsg(liqMsg, "");
    setMsg(faucetMsg, "");

    fromToken = CFG.ui.defaultFrom || "PATHUSD";
    toToken = CFG.ui.defaultTo || "ALPHAUSD";
    setSwapSelects();
    enforceSwapPair();
    setLiquidityLabels();

    await refreshBalances();
    await updateQuote();
    await syncLiquidityInputs();
  }

  // ---------- Swap ----------
  function getAToBForPool(poolKey, fromSym, toSym) {
    // In our deploy, tokenA is PATHUSD for all pools, tokenB is ALPHA/BETA/THETA.
    const base = CFG.ui.baseToken || "PATHUSD";
    if (poolKey === "PATH_ALPHA") {
      return (fromSym === base && toSym === "ALPHAUSD");
    }
    if (poolKey === "PATH_BETA") {
      return (fromSym === base && toSym === "BETAUSD");
    }
    // PATH_THETA
    return (fromSym === base && toSym === "THETAUSD");
  }

  async function updateQuote() {
    setMsg(swapMsg, "");
    toAmountEl.value = "";
    rateLineEl.textContent = "—";

    if (!provider || !account || !amm) return;

    const raw = (fromAmountEl.value || "").trim();
    const amt = Number(raw);
    if (!raw || !isFinite(amt) || amt <= 0) return;

    try {
      enforceSwapPair();

      const decIn = tokenDec[fromToken] ?? 6;
      const decOut = tokenDec[toToken] ?? 6;

      const amountIn = ethers.parseUnits(raw, decIn);
      const aToB = getAToBForPool(activePoolKey, fromToken, toToken);

      const out = await amm[CFG.fn.ammGetAmountOut](amountIn, aToB);
      const outFmt = ethers.formatUnits(out, decOut);

      toAmountEl.value = outFmt;

      const rate = amt > 0 ? (Number(outFmt) / amt) : 0;
      rateLineEl.textContent = rate > 0
        ? `1 ${labelOf(fromToken)} ≈ ${trimNum(rate)} ${labelOf(toToken)}`
        : "—";
    } catch (_) {}
  }

  async function doSwap() {
    setMsg(swapMsg, "");

    if (!account || !signer) {
      await connect();
      return;
    }

    const raw = (fromAmountEl.value || "").trim();
    const amt = Number(raw);
    if (!raw || !isFinite(amt) || amt <= 0) {
      setMsg(swapMsg, "Enter amount > 0");
      return;
    }

    btnSwap.disabled = true;

    try {
      enforceSwapPair();

      const decIn = tokenDec[fromToken] ?? 6;
      const tokenIn = tokenCtrs[fromToken];
      const poolAddr = getPoolAddress(activePoolKey);

      const amountIn = ethers.parseUnits(raw, decIn);
      const aToB = getAToBForPool(activePoolKey, fromToken, toToken);

      const out = await amm[CFG.fn.ammGetAmountOut](amountIn, aToB);

      const slipPct = getSlippagePct();
      const bps = BigInt(Math.floor(slipPct * 100));
      const minOut = out - (out * bps) / 10000n;

      const allowance = await tokenIn.allowance(account, poolAddr);
      if (allowance < amountIn) {
        setMsg(swapMsg, `Approving ${labelOf(fromToken)}…`);
        const txA = await tokenIn.approve(poolAddr, amountIn);
        await txA.wait();
      }

      setMsg(swapMsg, "Swapping…");
      const tx = await amm[CFG.fn.ammSwap](amountIn, minOut, aToB);
      const rc = await tx.wait();

      setMsg(swapMsg, `✅ Swap success. Tx: ${rc.hash.slice(0, 10)}…`);
      await refreshBalances();
      await updateQuote();
      await syncLiquidityInputs();
    } catch (e) {
      console.error(e);
      const msg = e?.shortMessage || e?.reason || e?.message || String(e);
      setMsg(swapMsg, `Swap failed: ${msg}`);
    } finally {
      btnSwap.disabled = false;
    }
  }

  // ---------- Faucet ----------
  async function canClaimToken(sym) {
    try {
      const ok = await faucet[CFG.fn.faucetCanClaim](account, TOKENS[sym]);
      return Boolean(ok);
    } catch (_) {
      return true; // if view fails, allow attempt
    }
  }

  async function doClaim(sym, btn) {
    setMsg(faucetMsg, "");

    if (!account || !signer) {
      await connect();
      return;
    }

    btn.disabled = true;

    try {
      const ok = await canClaimToken(sym);
      if (!ok) {
        setMsg(faucetMsg, `Cooldown active for ${labelOf(sym)}. Try later.`);
        return;
      }

      const fnMap = {
        PATHUSD: CFG.fn.faucetClaimPath,
        ALPHAUSD: CFG.fn.faucetClaimAlpha,
        BETAUSD: CFG.fn.faucetClaimBeta,
        THETAUSD: CFG.fn.faucetClaimTheta
      };

      const fn = fnMap[sym];
      if (!fn || typeof faucet[fn] !== "function") {
        // fallback to claim(address)
        setMsg(faucetMsg, `Claiming ${labelOf(sym)}…`);
        const tx0 = await faucet.claim(TOKENS[sym], { gasLimit: 250000n });
        const rc0 = await tx0.wait();
        setMsg(faucetMsg, `✅ Claim ${labelOf(sym)} success. Tx: ${rc0.hash.slice(0, 10)}…`);
      } else {
        setMsg(faucetMsg, `Claiming 100 ${labelOf(sym)}…`);
        const tx = await faucet[fn]({ gasLimit: 250000n });
        const rc = await tx.wait();
        setMsg(faucetMsg, `✅ Claim ${labelOf(sym)} success. Tx: ${rc.hash.slice(0, 10)}…`);
      }

      await refreshBalances();
      await updateQuote();
      await syncLiquidityInputs();
    } catch (e) {
      console.error(e);
      const msg = e?.shortMessage || e?.reason || e?.message || String(e);
      setMsg(faucetMsg, `Claim failed: ${msg}`);
    } finally {
      btn.disabled = false;
    }
  }

  // ---------- Liquidity ----------
  function setLiqPreview(aStr, bStr, aSym, bSym) {
    if (!aStr || !bStr) {
      liqPreviewEl.textContent = "You will add: —";
      return;
    }
    liqPreviewEl.textContent = `You will add: ${trimNum(aStr)} ${labelOf(aSym)} + ${trimNum(bStr)} ${labelOf(bSym)}`;
  }

  async function getPoolReserves(pool) {
    try {
      const r = await pool[CFG.fn.ammReserves]();
      return { rA: r[0], rB: r[1] };
    } catch (_) {
      return null;
    }
  }

  async function syncLiquidityInputs() {
    if (!provider || !account) return;

    const pair = getLiquidityPair();
    const pool = makeAmm(pair.poolKey);
    if (!pool) return;

    // update lp shares display (in this pool)
    try {
      const [myShares, totalShares] = await Promise.all([
        pool[CFG.fn.ammSharesOf](account),
        pool[CFG.fn.ammTotalShares](),
      ]);
      lpSharesLineEl.textContent = `${myShares.toString()} / ${totalShares.toString()}`;
    } catch (_) {
      lpSharesLineEl.textContent = "—";
    }

    const rawA0 = (liqAAmountEl.value || "").trim();
    const rawB0 = (liqBAmountEl.value || "").trim();

    if ((!rawA0 || Number(rawA0) <= 0) && (!rawB0 || Number(rawB0) <= 0)) {
      liqRatioEl.textContent = "—";
      setLiqPreview("", "", pair.a, pair.b);
      return;
    }

    const reserves = await getPoolReserves(pool);
    if (!reserves) {
      liqRatioEl.textContent = "unavailable";
      setLiqPreview("", "", pair.a, pair.b);
      return;
    }

    const rA = reserves.rA;
    const rB = reserves.rB;

    const decA = tokenDec[pair.a] ?? 6;
    const decB = tokenDec[pair.b] ?? 6;

    // pool empty
    if (rA === 0n || rB === 0n) {
      liqRatioEl.textContent = "empty pool (set initial amounts)";
      if (rawA0 && rawB0) setLiqPreview(rawA0, rawB0, pair.a, pair.b);
      else setLiqPreview("", "", pair.a, pair.b);
      return;
    }

    const ratio = Number(ethers.formatUnits(rB, decB)) / Number(ethers.formatUnits(rA, decA));
    liqRatioEl.textContent = isFinite(ratio) && ratio > 0
      ? `1 ${labelOf(pair.a)} ≈ ${trimNum(ratio)} ${labelOf(pair.b)}`
      : "—";

    try {
      liqIsSyncing = true;

      if (liqLastEdited === "A") {
        const rawA = (liqAAmountEl.value || "").trim();
        const nA = Number(rawA);
        if (!rawA || !isFinite(nA) || nA <= 0) {
          liqBAmountEl.value = "";
          setLiqPreview("", "", pair.a, pair.b);
          return;
        }

        const amtA = ethers.parseUnits(rawA, decA);
        const amtB = (amtA * rB) / rA;
        const bFmt = ethers.formatUnits(amtB, decB);
        liqBAmountEl.value = bFmt;

        setLiqPreview(rawA, bFmt, pair.a, pair.b);
      } else {
        const rawB = (liqBAmountEl.value || "").trim();
        const nB = Number(rawB);
        if (!rawB || !isFinite(nB) || nB <= 0) {
          liqAAmountEl.value = "";
          setLiqPreview("", "", pair.a, pair.b);
          return;
        }

        const amtB = ethers.parseUnits(rawB, decB);
        const amtA = (amtB * rA) / rB;
        const aFmt = ethers.formatUnits(amtA, decA);
        liqAAmountEl.value = aFmt;

        setLiqPreview(aFmt, rawB, pair.a, pair.b);
      }
    } finally {
      liqIsSyncing = false;
    }
  }

  async function ensureApprove(tokenSym, spender, amount) {
    const token = tokenCtrs[tokenSym];
    const allowance = await token.allowance(account, spender);
    if (allowance >= amount) return;

    setMsg(liqMsg, `Approving ${labelOf(tokenSym)}…`);
    const tx = await token.approve(spender, amount);
    await tx.wait();
  }

  async function doAddLiquidity() {
    setMsg(liqMsg, "");

    if (!account || !signer) {
      await connect();
      return;
    }

    await syncLiquidityInputs();

    const pair = getLiquidityPair();
    const poolAddr = getPoolAddress(pair.poolKey);
    const pool = makeAmm(pair.poolKey);

    const rawA = (liqAAmountEl.value || "").trim();
    const rawB = (liqBAmountEl.value || "").trim();

    const nA = Number(rawA);
    const nB = Number(rawB);

    if (!rawA || !isFinite(nA) || nA <= 0) {
      setMsg(liqMsg, `Enter ${labelOf(pair.a)} amount > 0`);
      return;
    }
    if (!rawB || !isFinite(nB) || nB <= 0) {
      setMsg(liqMsg, `Enter ${labelOf(pair.b)} amount > 0`);
      return;
    }

    btnAddLiquidity.disabled = true;

    try {
      const decA = tokenDec[pair.a] ?? 6;
      const decB = tokenDec[pair.b] ?? 6;

      const amtA = ethers.parseUnits(rawA, decA);
      const amtB = ethers.parseUnits(rawB, decB);

      await ensureApprove(pair.a, poolAddr, amtA);
      await ensureApprove(pair.b, poolAddr, amtB);

      setMsg(liqMsg, "Adding liquidity…");
      const tx = await pool[CFG.fn.ammAddLiquidity](amtA, amtB);
      const rc = await tx.wait();

      setMsg(liqMsg, `✅ Liquidity added. Tx: ${rc.hash.slice(0, 10)}…`);

      liqAAmountEl.value = "";
      liqBAmountEl.value = "";
      liqRatioEl.textContent = "—";
      liqPreviewEl.textContent = "You will add: —";

      await refreshBalances();
      await syncLiquidityInputs();
      await updateQuote();
    } catch (e) {
      console.error(e);
      const msg = e?.shortMessage || e?.reason || e?.message || String(e);
      setMsg(liqMsg, `Add liquidity failed: ${msg}`);
    } finally {
      btnAddLiquidity.disabled = false;
    }
  }

  async function doRemoveLiquidity() {
    setMsg(liqMsg, "");

    if (!account || !signer) {
      await connect();
      return;
    }

    const pair = getLiquidityPair();
    const pool = makeAmm(pair.poolKey);
    if (!pool) {
      setMsg(liqMsg, "Pool not available.");
      return;
    }

    const raw = (liqRemoveSharesEl.value || "").trim();
    const n = Number(raw);
    if (!raw || !isFinite(n) || n <= 0) {
      setMsg(liqMsg, "Enter shares > 0 (integer).");
      return;
    }

    let shares;
    try {
      shares = BigInt(raw);
    } catch {
      setMsg(liqMsg, "Shares must be an integer number.");
      return;
    }

    btnRemoveLiquidity.disabled = true;

    try {
      setMsg(liqMsg, "Removing liquidity…");
      const tx = await pool[CFG.fn.ammRemoveLiquidity](shares);
      const rc = await tx.wait();

      setMsg(liqMsg, `✅ Liquidity removed. Tx: ${rc.hash.slice(0, 10)}…`);
      liqRemoveSharesEl.value = "";

      await refreshBalances();
      await syncLiquidityInputs();
      await updateQuote();
    } catch (e) {
      console.error(e);
      const msg = e?.shortMessage || e?.reason || e?.message || String(e);
      setMsg(liqMsg, `Remove liquidity failed: ${msg}`);
    } finally {
      btnRemoveLiquidity.disabled = false;
    }
  }

  // ===== Events =====
  btnConnectTop?.addEventListener("click", connect);
  btnDisconnect?.addEventListener("click", disconnect);
  btnReset?.addEventListener("click", resetAll);

  tabSwap?.addEventListener("click", () => setTab("swap"));
  tabFaucet?.addEventListener("click", () => setTab("faucet"));
  tabLiquidity?.addEventListener("click", async () => {
    setTab("liq");
    setLiquidityLabels();
    await refreshBalances();
    await syncLiquidityInputs();
  });

  fromTokenSel?.addEventListener("change", async () => {
    fromToken = fromTokenSel.value;
    enforceSwapPair();
    await refreshBalances();
    await updateQuote();
  });

  toTokenSel?.addEventListener("change", async () => {
    toToken = toTokenSel.value;
    enforceSwapPair();
    await refreshBalances();
    await updateQuote();
  });

  fromAmountEl?.addEventListener("input", () => updateQuote());
  slippageSel?.addEventListener("change", () => updateQuote());

  btnFlip?.addEventListener("click", async () => {
    [fromToken, toToken] = [toToken, fromToken];
    setSwapSelects();
    enforceSwapPair();
    setMsg(swapMsg, "");
    await refreshBalances();
    await updateQuote();
  });

  btnSwap?.addEventListener("click", doSwap);

  // faucet buttons (onchain keys unchanged)
  btnClaimPATH?.addEventListener("click", () => doClaim("PATHUSD", btnClaimPATH));
  btnClaimALPHA?.addEventListener("click", () => doClaim("ALPHAUSD", btnClaimALPHA));
  btnClaimBETA?.addEventListener("click", () => doClaim("BETAUSD", btnClaimBETA));
  btnClaimTHETA?.addEventListener("click", () => doClaim("THETAUSD", btnClaimTHETA));

  // liquidity
  liqPoolSel?.addEventListener("change", async () => {
    setLiquidityLabels();
    liqAAmountEl.value = "";
    liqBAmountEl.value = "";
    liqRemoveSharesEl.value = "";
    liqRatioEl.textContent = "—";
    liqPreviewEl.textContent = "You will add: —";
    setMsg(liqMsg, "");
    await refreshBalances();
    await syncLiquidityInputs();
  });

  liqAAmountEl?.addEventListener("input", async () => {
    if (liqIsSyncing) return;
    liqLastEdited = "A";
    await syncLiquidityInputs();
  });

  liqBAmountEl?.addEventListener("input", async () => {
    if (liqIsSyncing) return;
    liqLastEdited = "B";
    await syncLiquidityInputs();
  });

  btnAddLiquidity?.addEventListener("click", doAddLiquidity);
  btnRemoveLiquidity?.addEventListener("click", doRemoveLiquidity);

  // wallet events
  if (window.ethereum) {
    window.ethereum.on?.("accountsChanged", async () => {
      disconnect();
      await connect();
    });

    window.ethereum.on?.("chainChanged", async () => {
      window.location.reload();
    });
  }

  // init
  networkNameEl.textContent = CFG.chain.chainName;
  setConnectedUI(false);
  setTab("swap");

  // set defaults
  setSwapSelects();
  enforceSwapPair();
  setLiquidityLabels();

  // also update pool line on load
  setSwapPoolLine();
})();