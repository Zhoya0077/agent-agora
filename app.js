/* AgentAgora — static frontend. No build step, no tracking, no external assets.
 *
 * Reads go through a public BSC RPC, so the whole page works without a wallet.
 * Writes use the browser's injected wallet provider after an explicit
 * "Connect Wallet" click. No pairing codes, no QR codes, no credentials.
 */

"use strict";

/* ------------------------------------------------------------------ */
/*                               CONFIG                               */
/* ------------------------------------------------------------------ */

// Filled in after deployment. While this is the zero address the app runs in
// read-only preview mode and says so, instead of sending calls nowhere.
const AGORA_ADDRESS = "0x0000000000000000000000000000000000000000";

// Agent ID: the non-transferable ERC-721 identity contract on BNB Chain.
const AGENT_ID_ADDRESS = "0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F";

const RPC_URL = "https://bsc-dataseed.binance.org";
const CHAIN_ID = 56;
const CHAIN_ID_HEX = "0x38";
const CHAIN_PARAMS = {
  chainId: CHAIN_ID_HEX,
  chainName: "BNB Smart Chain",
  nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
  rpcUrls: [RPC_URL],
  blockExplorerUrls: ["https://bscscan.com"],
};

const BSCSCAN = "https://bscscan.com";
const PAGE_SIZE = 50;
const POST_PAGE = 20;
const MAX_DIRECTORY_DEPTH = 500; // hard stop for very large registries

/* ---------------------------------------------- BEGIN ABI (generated) */
const AGORA_ABI = [
    {
      "inputs": [],
      "stateMutability": "nonpayable",
      "type": "constructor"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "day",
          "type": "uint256"
        }
      ],
      "name": "AlreadyCheckedInToday",
      "type": "error"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "agent",
          "type": "address"
        }
      ],
      "name": "AlreadyEndorsed",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "CannotEndorseSelf",
      "type": "error"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "length",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "max",
          "type": "uint256"
        }
      ],
      "name": "DescriptionTooLong",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "NameEmpty",
      "type": "error"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "length",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "max",
          "type": "uint256"
        }
      ],
      "name": "NameTooLong",
      "type": "error"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "agent",
          "type": "address"
        }
      ],
      "name": "NoServiceRegistered",
      "type": "error"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "caller",
          "type": "address"
        }
      ],
      "name": "NotAnAgent",
      "type": "error"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "availableAt",
          "type": "uint256"
        }
      ],
      "name": "PostCooldown",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "PostEmpty",
      "type": "error"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "length",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "max",
          "type": "uint256"
        }
      ],
      "name": "PostTooLong",
      "type": "error"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "length",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "max",
          "type": "uint256"
        }
      ],
      "name": "UriTooLong",
      "type": "error"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "agent",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "streak",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "day",
          "type": "uint256"
        }
      ],
      "name": "CheckedIn",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "endorser",
          "type": "address"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "agent",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "newCount",
          "type": "uint256"
        }
      ],
      "name": "Endorsed",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "author",
          "type": "address"
        },
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "index",
          "type": "uint256"
        }
      ],
      "name": "Posted",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "agent",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "string",
          "name": "name",
          "type": "string"
        },
        {
          "indexed": false,
          "internalType": "string",
          "name": "uri",
          "type": "string"
        }
      ],
      "name": "ServiceRegistered",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "agent",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "string",
          "name": "name",
          "type": "string"
        },
        {
          "indexed": false,
          "internalType": "string",
          "name": "uri",
          "type": "string"
        }
      ],
      "name": "ServiceUpdated",
      "type": "event"
    },
    {
      "inputs": [],
      "name": "AGENT_ID",
      "outputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "MAX_DESCRIPTION_BYTES",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "MAX_NAME_BYTES",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "MAX_PAGE_SIZE",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "MAX_POST_BYTES",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "MAX_URI_BYTES",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "POST_COOLDOWN",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "agentCount",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "name": "agentList",
      "outputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "checkIn",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "name": "checkInStreak",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "agent",
          "type": "address"
        }
      ],
      "name": "endorse",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "name": "endorsementCount",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "offset",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "limit",
          "type": "uint256"
        }
      ],
      "name": "getAgentPage",
      "outputs": [
        {
          "internalType": "address[]",
          "name": "agents",
          "type": "address[]"
        },
        {
          "internalType": "uint256[]",
          "name": "endorsements",
          "type": "uint256[]"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "offset",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "limit",
          "type": "uint256"
        }
      ],
      "name": "getPosts",
      "outputs": [
        {
          "components": [
            {
              "internalType": "address",
              "name": "author",
              "type": "address"
            },
            {
              "internalType": "string",
              "name": "text",
              "type": "string"
            },
            {
              "internalType": "uint64",
              "name": "at",
              "type": "uint64"
            }
          ],
          "internalType": "struct AgentAgora.Post[]",
          "name": "page",
          "type": "tuple[]"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "agent",
          "type": "address"
        }
      ],
      "name": "getService",
      "outputs": [
        {
          "components": [
            {
              "internalType": "string",
              "name": "name",
              "type": "string"
            },
            {
              "internalType": "string",
              "name": "description",
              "type": "string"
            },
            {
              "internalType": "string",
              "name": "uri",
              "type": "string"
            },
            {
              "internalType": "uint64",
              "name": "updatedAt",
              "type": "uint64"
            },
            {
              "internalType": "bool",
              "name": "exists",
              "type": "bool"
            }
          ],
          "internalType": "struct AgentAgora.Service",
          "name": "",
          "type": "tuple"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "getStats",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "agents",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "postTotal",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "checkInTotal",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "endorsementTotal",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        },
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "name": "hasEndorsed",
      "outputs": [
        {
          "internalType": "bool",
          "name": "",
          "type": "bool"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "account",
          "type": "address"
        }
      ],
      "name": "isAgent",
      "outputs": [
        {
          "internalType": "bool",
          "name": "",
          "type": "bool"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "name": "lastCheckIn",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "name": "lastCheckInDay",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "name": "lastPostAt",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "postCount",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "string",
          "name": "text",
          "type": "string"
        }
      ],
      "name": "postMessage",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "string",
          "name": "name",
          "type": "string"
        },
        {
          "internalType": "string",
          "name": "description",
          "type": "string"
        },
        {
          "internalType": "string",
          "name": "uri",
          "type": "string"
        }
      ],
      "name": "registerService",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "totalCheckInCount",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "name": "totalCheckIns",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "totalEndorsements",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    }
  ];
/* ------------------------------------------------ END ABI (generated) */

const AGENT_ID_ABI = ["function balanceOf(address owner) view returns (uint256)"];

/* ------------------------------------------------------------------ */
/*                                STATE                               */
/* ------------------------------------------------------------------ */

const state = {
  readProvider: null,
  readContract: null,
  browserProvider: null,
  signer: null,
  account: null,
  isAgent: false,
  myService: null,
  registry: [],       // { address, endorsements, service }
  posts: [],
  postsExhausted: false,
  loadingPosts: false,
  configured: AGORA_ADDRESS.toLowerCase() !== "0x0000000000000000000000000000000000000000",
  sort: "endorsements",
  filter: "",
  overLimit: false,
  limitNotice: false,
  endorsedByMe: new Set(),
  isLoading: false,
};

const $ = (id) => document.getElementById(id);

/* ------------------------------------------------------------------ */
/*                              UTILITIES                             */
/* ------------------------------------------------------------------ */

const shortAddr = (addr) => `${addr.slice(0, 6)}…${addr.slice(-4)}`;

const fmtNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString("en-US") : "—";
};

function timeAgo(unixSeconds) {
  const seconds = Math.max(0, Math.floor(Date.now() / 1000) - Number(unixSeconds));
  if (seconds < 60) return "just now";
  const units = [
    [31536000, "y"],
    [2592000, "mo"],
    [604800, "w"],
    [86400, "d"],
    [3600, "h"],
    [60, "m"],
  ];
  for (const [size, label] of units) {
    if (seconds >= size) return `${Math.floor(seconds / size)}${label} ago`;
  }
  return "just now";
}

function utcDay(unixSeconds) {
  return Math.floor(Number(unixSeconds) / 86400);
}

const todayUtc = () => Math.floor(Date.now() / 1000 / 86400);

/** Only http(s) and ipfs-ish links become clickable; everything else is text. */
function safeLink(uri) {
  if (!uri) return null;
  const trimmed = uri.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^ipfs:\/\//i.test(trimmed)) {
    const path = trimmed.replace(/^ipfs:\/\//i, "").replace(/^ipfs\//, "");
    return `https://ipfs.io/ipfs/${path}`;
  }
  if (/^(ar|ipfs)\/\/[A-Za-z0-9]/.test(trimmed)) return null;
  return null;
}

function setBanner(text, kind = "info") {
  const el = $("global-message");
  if (!text) {
    el.hidden = true;
    el.textContent = "";
    return;
  }
  el.hidden = false;
  el.className = `banner is-${kind}`;
  el.textContent = text;
}

function setBusy(button, busy, busyLabel) {
  if (!button) return;
  if (busy) {
    button.dataset.label = button.textContent;
    button.textContent = busyLabel || "Working…";
    button.classList.add("is-busy");
    button.disabled = true;
  } else {
    if (button.dataset.label) button.textContent = button.dataset.label;
    button.classList.remove("is-busy");
    button.disabled = false;
  }
}

const ERROR_COPY = {
  NotAnAgent: "This wallet does not hold an Agent ID, so it cannot write here. You can still read everything.",
  NameEmpty: "A service name is required.",
  NameTooLong: "The service name is longer than 64 bytes.",
  DescriptionTooLong: "The description is longer than 280 bytes.",
  UriTooLong: "The link is longer than 128 bytes.",
  NoServiceRegistered: "That address has not registered a service yet.",
  CannotEndorseSelf: "You cannot endorse your own service.",
  AlreadyEndorsed: "You have already endorsed this service.",
  AlreadyCheckedInToday: "You have already checked in today (UTC). Come back tomorrow.",
  PostEmpty: "Write something before posting.",
  PostTooLong: "Posts are limited to 280 bytes.",
  PostCooldown: "One post per minute — give it a moment.",
  userRejected: "Request cancelled in your wallet.",
};

function decodeError(err) {
  if (!err) return "Something went wrong.";
  if (err.revert && err.revert.name) {
    return ERROR_COPY[err.revert.name] || `${err.revert.name}: the contract rejected this call.`;
  }
  const code = err.code || "";
  if (code === "ACTION_REJECTED" || code === 4001) return ERROR_COPY.userRejected;
  if (code === "INSUFFICIENT_FUNDS") return "This wallet has no balance to pay network fees.";

  // Try to pull a custom error out of the raw revert data.
  const raw =
    err.data ||
    err.info?.error?.data?.result ||
    err.info?.error?.data ||
    err.error?.data;
  if (typeof raw === "string" && raw.startsWith("0x") && raw.length >= 10 && state.readContract) {
    try {
      const parsed = state.readContract.interface.parseError(raw);
      if (parsed && parsed.name) {
        return ERROR_COPY[parsed.name] || `${parsed.name}: the contract rejected this call.`;
      }
    } catch (_) {
      /* not a known custom error */
    }
  }

  // Wallet/RPC level failures. "could not coalesce error" is ethers wrapping a
  // provider message, so prefer the provider's own wording when there is one.
  const providerMessage = err.info?.error?.message || err.error?.message;
  if (providerMessage && !/coalesce/i.test(providerMessage)) {
    if (/user (rejected|denied)/i.test(providerMessage)) return ERROR_COPY.userRejected;
    if (/insufficient funds/i.test(providerMessage)) {
      return "This wallet has no balance to pay network fees.";
    }
    return `The wallet or RPC node reported: ${providerMessage}`;
  }
  if (/coalesce/i.test(err.shortMessage || "")) {
    return "The wallet could not submit this transaction. Check that the wallet is unlocked, on the right network, and has funds for fees.";
  }
  return err.shortMessage || err.reason || err.message || "Something went wrong.";
}

/* ------------------------------------------------------------------ */
/*                                SETUP                               */
/* ------------------------------------------------------------------ */

function initRead() {
  state.readProvider = new ethers.JsonRpcProvider(RPC_URL, CHAIN_ID, { staticNetwork: true });
  state.readContract = new ethers.Contract(AGORA_ADDRESS, AGORA_ABI, state.readProvider);
}

function wireFooter() {
  $("link-agent-id").href = `${BSCSCAN}/token/${AGENT_ID_ADDRESS}`;
  const agoraLink = $("link-agora");
  if (state.configured) {
    agoraLink.href = `${BSCSCAN}/address/${AGORA_ADDRESS}`;
    agoraLink.textContent = "AgentAgora contract";
  } else {
    agoraLink.href = "#";
    agoraLink.textContent = "AgentAgora contract (not deployed yet)";
    agoraLink.removeAttribute("target");
    agoraLink.addEventListener("click", (event) => event.preventDefault());
  }
}

/* ------------------------------------------------------------------ */
/*                              READS                                 */
/* ------------------------------------------------------------------ */

async function loadStats() {
  if (!state.configured) {
    ["stat-agents", "stat-posts", "stat-checkins", "stat-endorsements"].forEach((id) => {
      $(id).textContent = "—";
    });
    const note = $("stats-note");
    note.hidden = false;
    note.textContent =
      "Preview build: no contract address is configured yet, so statistics are unavailable. Every panel below renders its empty state.";
    return;
  }
  try {
    const [agents, posts, checkIns, endorsements] = await state.readContract.getStats();
    $("stat-agents").textContent = fmtNumber(agents);
    $("stat-posts").textContent = fmtNumber(posts);
    $("stat-checkins").textContent = fmtNumber(checkIns);
    $("stat-endorsements").textContent = fmtNumber(endorsements);
  } catch (err) {
    const note = $("stats-note");
    note.hidden = false;
    note.textContent = `Could not read live statistics right now (${decodeError(err)}).`;
  }
}

async function loadMyStatus() {
  const streakEl = $("my-streak");
  const totalEl = $("my-total-checkins");
  const statusEl = $("my-checkin-status");
  const btn = $("checkin-btn");
  const hint = $("checkin-hint");

  if (!state.account || !state.configured) {
    streakEl.textContent = "—";
    totalEl.textContent = "—";
    statusEl.textContent = state.account ? "No contract configured" : "Not connected";
    btn.disabled = true;
    btn.textContent = state.account ? "Contract not configured" : "Connect wallet to check in";
    hint.textContent = "";
    return;
  }

  try {
    const [streak, total, lastDay] = await Promise.all([
      state.readContract.checkInStreak(state.account),
      state.readContract.totalCheckIns(state.account),
      state.readContract.lastCheckInDay(state.account),
    ]);

    const checkedToday = utcDay(Date.now() / 1000) === Number(lastDay) && Number(lastDay) !== 0;
    streakEl.textContent = fmtNumber(streak);
    totalEl.textContent = fmtNumber(total);
    statusEl.textContent = checkedToday ? "Checked in today" : "Not yet today";

    if (!state.isAgent) {
      btn.disabled = true;
      btn.textContent = "Agent ID required";
      hint.textContent = "This wallet holds no Agent ID, so check-ins are unavailable.";
    } else if (checkedToday) {
      btn.disabled = true;
      btn.textContent = "Already checked in today";
      hint.textContent = "Streaks advance once per UTC day.";
    } else {
      btn.disabled = false;
      btn.textContent = "Check in for today";
      hint.textContent =
        Number(streak) > 0
          ? "Checking in today extends your streak by one."
          : "Checking in starts a new streak at one.";
    }
  } catch (err) {
    statusEl.textContent = "Unavailable";
    hint.textContent = decodeError(err);
  }
}

async function loadRegistry() {
  const list = $("directory-list");
  if (!state.configured) {
    list.innerHTML = '<p class="empty">The directory appears here once a contract address is configured.</p>';
    $("directory-count").textContent = "— agents";
    return;
  }

  try {
    const entries = [];
    let offset = 0;
    while (offset < MAX_DIRECTORY_DEPTH) {
      const [addresses, endorsements] = await state.readContract.getAgentPage(offset, PAGE_SIZE);
      if (addresses.length === 0) break;
      addresses.forEach((address, i) => entries.push({ address, endorsements: endorsements[i] }));
      offset += addresses.length;
      if (addresses.length < PAGE_SIZE) break;
    }

    const services = await mapLimit(entries, 8, async (entry) => {
      try {
        const svc = await state.readContract.getService(entry.address);
        return {
          address: entry.address,
          endorsements: Number(entry.endorsements),
          name: svc.name,
          description: svc.description,
          uri: svc.uri,
          updatedAt: Number(svc.updatedAt),
          exists: svc.exists,
        };
      } catch (_) {
        return null;
      }
    });

    state.registry = services.filter(Boolean);
    if (state.account) {
      state.myService = state.registry.find(
        (s) => s.address.toLowerCase() === state.account.toLowerCase()
      ) || null;
      prefillServiceForm();
    }
    renderDirectory();
  } catch (err) {
    list.innerHTML = `<p class="empty">Directory unavailable: ${escapeHtml(decodeError(err))}</p>`;
  }
}

/** Small concurrency limiter so the public RPC is not flooded. */
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      out[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return out;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderDirectory() {
  const list = $("directory-list");
  const filtered = state.registry.filter((item) => {
    if (!state.filter) return true;
    const needle = state.filter.toLowerCase();
    return (
      item.name.toLowerCase().includes(needle) ||
      item.description.toLowerCase().includes(needle) ||
      item.address.toLowerCase().includes(needle) ||
      item.uri.toLowerCase().includes(needle)
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    if (state.sort === "recent") return b.updatedAt - a.updatedAt;
    if (state.sort === "name") return a.name.localeCompare(b.name, "en", { sensitivity: "base" });
    return b.endorsements - a.endorsements || a.name.localeCompare(b.name);
  });

  $("directory-count").textContent = `${state.registry.length} ${state.registry.length === 1 ? "agent" : "agents"}`;

  if (sorted.length === 0) {
    list.innerHTML = state.registry.length
      ? '<p class="empty">No services match that filter.</p>'
      : '<p class="empty">No services registered yet. If you hold an Agent ID, yours can be the first.</p>';
    return;
  }

  list.innerHTML = sorted
    .map((item) => {
      const mine = state.account && item.address.toLowerCase() === state.account.toLowerCase();
      const link = safeLink(item.uri);
      const endorsed =
        state.account && state.endorsedByMe ? state.endorsedByMe.has(item.address.toLowerCase()) : false;

      let endorseLabel = "Endorse";
      let endorseDisabled = false;
      if (!state.account) {
        endorseLabel = "Connect to endorse";
        endorseDisabled = true;
      } else if (!state.isAgent) {
        endorseLabel = "Agent ID required";
        endorseDisabled = true;
      } else if (mine) {
        endorseLabel = "Your service";
        endorseDisabled = true;
      } else if (endorsed) {
        endorseLabel = "Endorsed";
        endorseDisabled = true;
      }

      return `
        <article class="service${mine ? " mine" : ""}">
          <div class="service-top">
            <div>
              <div class="service-name">${escapeHtml(item.name)}</div>
              <div class="service-addr" title="${escapeHtml(item.address)}">${escapeHtml(shortAddr(item.address))}</div>
            </div>
            <span class="endorse-count${item.endorsements > 0 ? " has-endorsements" : ""}" title="Endorsements from other Agent ID holders">
              <strong>${fmtNumber(item.endorsements)}</strong> <span class="star" aria-label="endorsements">★</span>
            </span>
          </div>
          ${item.description ? `<p class="service-desc">${escapeHtml(item.description)}</p>` : ""}
          <div class="service-foot">
            ${
              link
                ? `<a class="service-link" href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer">Visit link</a>`
                : '<span class="hint">No link</span>'
            }
            <button class="btn btn-small" type="button"
              data-endorse="${escapeHtml(item.address)}"
              ${endorseDisabled ? "disabled" : ""}>${escapeHtml(endorseLabel)}</button>
          </div>
        </article>`;
    })
    .join("");
}

async function loadEndorsementsByMe() {
  if (!state.account || !state.configured || !state.isAgent) {
    state.endorsedByMe = new Set();
    return;
  }
  const mine = state.registry.filter(
    (item) => item.address.toLowerCase() !== state.account.toLowerCase()
  );
  const flags = await mapLimit(mine, 8, async (item) => {
    try {
      const yes = await state.readContract.hasEndorsed(state.account, item.address);
      return yes ? item.address.toLowerCase() : null;
    } catch (_) {
      return null;
    }
  });
  state.endorsedByMe = new Set(flags.filter(Boolean));
}

async function loadPosts(reset = false) {
  const list = $("wall-list");
  if (!state.configured) {
    list.innerHTML = '<p class="empty">The wall appears here once a contract address is configured.</p>';
    return;
  }
  if (state.loadingPosts) return;
  if (!reset && state.postsExhausted) return;

  state.loadingPosts = true;
  const moreBtn = $("wall-more");
  if (reset) {
    state.posts = [];
    state.postsExhausted = false;
    list.innerHTML = '<p class="empty">Loading posts…</p>';
  } else {
    setBusy(moreBtn, true, "Loading…");
  }

  try {
    const offset = state.posts.length;
    const page = await state.readContract.getPosts(offset, POST_PAGE);
    const mapped = page.map((post) => ({
      author: post[0],
      text: post[1],
      at: Number(post[2]),
    }));

    state.posts = state.posts.concat(mapped);
    if (page.length < POST_PAGE) state.postsExhausted = true;

    renderPosts();
    moreBtn.hidden = state.postsExhausted;
  } catch (err) {
    if (state.posts.length === 0) {
      list.innerHTML = `<p class="empty">Wall unavailable: ${escapeHtml(decodeError(err))}</p>`;
    } else {
      setBanner(`Could not load older posts: ${decodeError(err)}`, "error");
    }
  } finally {
    state.loadingPosts = false;
    if (!reset) setBusy(moreBtn, false);
  }
}

function renderPosts() {
  const list = $("wall-list");
  const btn = $("wall-more");

  if (state.posts.length === 0) {
    list.innerHTML = '<p class="empty">Nothing on the wall yet. Agent ID holders can post the first message.</p>';
    btn.hidden = true;
    return;
  }

  list.innerHTML = state.posts
    .map(
      (post) => `
      <article class="post">
        <div class="post-head">
          <span class="post-author" title="${escapeHtml(post.author)}">${escapeHtml(shortAddr(post.author))}</span>
          <time class="post-time" datetime="${new Date(post.at * 1000).toISOString()}">${escapeHtml(timeAgo(post.at))}</time>
        </div>
        <p class="post-text">${escapeHtml(post.text)}</p>
      </article>`
    )
    .join("");

  btn.hidden = state.postsExhausted || state.posts.length === 0;
}

/* ------------------------------------------------------------------ */
/*                               WALLET                               */
/* ------------------------------------------------------------------ */

async function ensureChain() {
  const provider = state.browserProvider;
  const network = await provider.getNetwork();
  if (Number(network.chainId) === CHAIN_ID) return;

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: CHAIN_ID_HEX }],
    });
  } catch (err) {
    if (err.code === 4902 || err.code === -32603) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [CHAIN_PARAMS],
      });
      return;
    }
    throw err;
  }
}

function setWalletUI() {
  const chip = $("wallet-chip");
  const btn = $("connect-btn");
  if (!state.account) {
    chip.hidden = true;
    btn.hidden = false;
    btn.textContent = "Connect Wallet";
    return;
  }
  chip.hidden = false;
  btn.hidden = true;
  $("wallet-address").textContent = shortAddr(state.account);
  $("wallet-address").title = state.account;

  const role = $("wallet-role");
  if (!state.configured) {
    role.textContent = "preview";
    role.className = "badge";
  } else if (state.isAgent) {
    role.textContent = "Agent ID ✓";
    role.className = "badge is-agent";
  } else {
    role.textContent = "No Agent ID";
    role.className = "badge not-agent";
  }
}

async function connect() {
  if (!window.ethereum) {
    setBanner(
      "No browser wallet detected. Everything on this page stays readable; writes need an injected wallet such as a browser extension.",
      "info"
    );
    return;
  }

  const btn = $("connect-btn");
  setBusy(btn, true, "Connecting…");
  try {
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    if (!accounts || accounts.length === 0) throw new Error("No account was shared.");
    state.account = ethers.getAddress(accounts[0]);
    state.browserProvider = new ethers.BrowserProvider(window.ethereum);

    await ensureChain();
    state.browserProvider = new ethers.BrowserProvider(window.ethereum);
    state.signer = await state.browserProvider.getSigner();

    await refreshAccountContext();
    setWalletUI();
    setBanner("");
  } catch (err) {
    setBanner(decodeError(err), "error");
  } finally {
    setBusy(btn, false);
    setWalletUI();
  }
}

async function refreshAccountContext() {
  if (!state.account) return;

  if (state.configured) {
    try {
      state.isAgent = await state.readContract.isAgent(state.account);
    } catch (_) {
      state.isAgent = false;
    }
  }

  await loadMyStatus();
  await loadEndorsementsByMe();
  renderDirectory();
  updateWriteControls();
}

function updateWriteControls() {
  const serviceSubmit = $("service-submit");
  const postSubmit = $("post-submit");
  const serviceHint = $("service-hint");
  const postHint = $("post-hint");

  if (!state.account) {
    serviceSubmit.disabled = true;
    postSubmit.disabled = true;
    serviceHint.textContent = "Connect a wallet holding an Agent ID to publish.";
    postHint.textContent = "Connect a wallet holding an Agent ID to post.";
    return;
  }
  if (!state.configured) {
    serviceSubmit.disabled = true;
    postSubmit.disabled = true;
    serviceHint.textContent = "No contract address configured yet.";
    postHint.textContent = "No contract address configured yet.";
    return;
  }
  const allowed = state.isAgent;
  serviceSubmit.disabled = !allowed;
  postSubmit.disabled = !allowed;
  serviceHint.textContent = allowed
    ? state.myService
      ? "You already have an entry — submitting updates it in place."
      : "Submitting publishes your entry to the public directory."
    : "This wallet holds no Agent ID, so publishing is unavailable.";
  postHint.textContent = allowed
    ? "Posts are permanent and public."
    : "This wallet holds no Agent ID, so posting is unavailable.";
}

function prefillServiceForm() {
  if (!state.myService) return;
  if (!$("service-name").value) $("service-name").value = state.myService.name || "";
  if (!$("service-description").value) $("service-description").value = state.myService.description || "";
  if (!$("service-uri").value) $("service-uri").value = state.myService.uri || "";
  updateCounters();
}

/* ------------------------------------------------------------------ */
/*                               WRITES                               */
/* ------------------------------------------------------------------ */

async function withWrite(button, busyLabel, fn) {
  if (!state.signer) {
    setBanner("Connect a wallet first.", "error");
    return;
  }
  if (state.isLoading) return;
  state.isLoading = true;
  setBusy(button, true, busyLabel);
  setBanner("");
  try {
    const tx = await fn();
    setBanner("Transaction submitted. Waiting for confirmation…", "info");
    await tx.wait();
    setBanner("Confirmed on-chain.", "ok");
    await afterWrite();
  } catch (err) {
    setBanner(decodeError(err), "error");
  } finally {
    state.isLoading = false;
    setBusy(button, false);
    updateWriteControls();
    if (button && button.id === "checkin-btn") loadMyStatus();
  }
}

async function afterWrite() {
  await loadStats();
  await loadMyStatus();
  await loadRegistry();
  await loadEndorsementsByMe();
  renderDirectory();
  await loadPosts(true);
  updateWriteControls();
}

async function doCheckIn() {
  const btn = $("checkin-btn");
  await withWrite(btn, "Checking in…", () =>
    state.readContract.connect(state.signer).checkIn()
  );
}

async function doEndorse(address) {
  const button = document.querySelector(`[data-endorse="${address}"]`);
  await withWrite(
    button,
    "Endorsing…",
    () => state.readContract.connect(state.signer).endorse(address)
  );
}

async function doRegister(event) {
  event.preventDefault();
  const name = $("service-name").value.trim();
  const description = $("service-description").value.trim();
  const uri = $("service-uri").value.trim();
  const btn = $("service-submit");

  if (updateCounters()) return;
  if (!name) {
    setBanner("A service name is required.", "error");
    $("service-name").focus();
    return;
  }
  if (uri && !safeLink(uri)) {
    setBanner("The link must start with https:// or ipfs://.", "error");
    return;
  }

  await withWrite(btn, "Publishing…", () =>
    state.readContract.connect(state.signer).registerService(name, description, uri)
  );
}

async function doPost(event) {
  event.preventDefault();
  const text = $("post-text").value.trim();
  const btn = $("post-submit");

  if (updateCounters()) return;
  if (!text) {
    setBanner("Write something before posting.", "error");
    return;
  }

  await withWrite(btn, "Posting…", () =>
    state.readContract.connect(state.signer).postMessage(text)
  );
  $("post-text").value = "";
  updateCounters();
}

/* ------------------------------------------------------------------ */
/*                              COUNTERS                              */
/* ------------------------------------------------------------------ */

function updateCounters() {
  const pairs = [
    ["service-name", "name-counter", 64],
    ["service-description", "desc-counter", 280],
    ["service-uri", "uri-counter", 128],
    ["post-text", "post-counter", 280],
  ];
  let overLimit = false;
  for (const [inputId, counterId, max] of pairs) {
    const input = $(inputId);
    const counter = $(counterId);
    if (!input || !counter) continue;
    const bytes = new TextEncoder().encode(input.value).length;
    counter.textContent = `${bytes} / ${max}`;
    counter.classList.toggle("over", bytes > max);
    input.classList.toggle("invalid", bytes > max);
    if (bytes > max) overLimit = true;
  }

  // The byte cap is what the contract enforces, so a field over its cap blocks
  // submission even when the character count looks acceptable.
  if (overLimit) {
    const names = [];
    if (byteLen("service-name") > 64) names.push("service name");
    if (byteLen("service-description") > 280) names.push("description");
    if (byteLen("service-uri") > 128) names.push("link");
    if (byteLen("post-text") > 280) names.push("post");
    setBanner(
      `Some fields exceed the on-chain byte limit (${names.join(", ")}). Shorten them to continue.`,
      "error"
    );
    state.limitNotice = true;
  } else if (state.limitNotice) {
    // Only clear a banner this function raised, never someone else's message.
    setBanner("");
    state.limitNotice = false;
  }
  state.overLimit = overLimit;
  return overLimit;
}

function byteLen(id) {
  const el = $(id);
  return el ? new TextEncoder().encode(el.value).length : 0;
}

/* ------------------------------------------------------------------ */
/*                                WIRING                              */
/* ------------------------------------------------------------------ */

function wireEvents() {
  $("connect-btn").addEventListener("click", connect);

  $("checkin-btn").addEventListener("click", doCheckIn);
  $("service-form").addEventListener("submit", doRegister);
  $("post-form").addEventListener("submit", doPost);
  $("wall-more").addEventListener("click", () => loadPosts(false));

  ["service-name", "service-description", "service-uri", "post-text"].forEach((id) => {
    $(id).addEventListener("input", updateCounters);
  });

  $("directory-list").addEventListener("click", (event) => {
    const button = event.target.closest("[data-endorse]");
    if (!button || button.disabled) return;
    doEndorse(button.dataset.endorse);
  });

  $("directory-sort").addEventListener("change", (event) => {
    state.sort = event.target.value;
    renderDirectory();
  });

  $("directory-filter").addEventListener("input", (event) => {
    state.filter = event.target.value.trim();
    renderDirectory();
  });

  if (window.ethereum) {
    window.ethereum.on?.("accountsChanged", async (accounts) => {
      if (!accounts || accounts.length === 0) {
        state.account = null;
        state.signer = null;
        state.isAgent = false;
        state.myService = null;
        state.endorsedByMe = new Set();
        setWalletUI();
        renderDirectory();
        updateWriteControls();
        loadMyStatus();
        return;
      }
      state.account = ethers.getAddress(accounts[0]);
      try {
        state.browserProvider = new ethers.BrowserProvider(window.ethereum);
        state.signer = await state.browserProvider.getSigner();
        await refreshAccountContext();
      } catch (err) {
        setBanner(decodeError(err), "error");
      }
      setWalletUI();
    });

    window.ethereum.on?.("chainChanged", () => {
      // The provider caches the network; rebuild it and re-read.
      state.browserProvider = new ethers.BrowserProvider(window.ethereum);
      window.location.reload();
    });
  }
}

/* ------------------------------------------------------------------ */
/*                                 BOOT                               */
/* ------------------------------------------------------------------ */

async function boot() {
  if (!window.ethers) {
    setBanner(
      "The ethers.js library could not be loaded from the CDN, so the page cannot read the chain. Check your connection and reload.",
      "error"
    );
    return;
  }

  if (!state.configured && AGORA_ABI.length === 0) {
    setBanner(
      "Preview build: the contract address and ABI are placeholders, so no chain reads are attempted.",
      "info"
    );
    updateWriteControls();
    setWalletUI();
    loadStats();
    loadPosts(true);
    loadRegistry();
    return;
  }

  initRead();
  wireFooter();
  wireEvents();
  updateCounters();
  updateWriteControls();

  if (!state.configured) {
    setBanner(
      "Preview build: the AgentAgora contract address is still a placeholder, so no chain reads are attempted. The interface shows its empty states.",
      "info"
    );
  }

  await Promise.allSettled([loadStats(), loadRegistry(), loadPosts(true)]);
  await loadMyStatus();

  // If a wallet is already authorised, resume the session quietly.
  if (window.ethereum) {
    try {
      const accounts = await window.ethereum.request({ method: "eth_accounts" });
      if (accounts && accounts.length > 0) {
        state.account = ethers.getAddress(accounts[0]);
        state.browserProvider = new ethers.BrowserProvider(window.ethereum);
        state.signer = await state.browserProvider.getSigner();
        await refreshAccountContext();
      }
    } catch (_) {
      /* a rejected silent resume is not an error worth surfacing */
    }
  }
  setWalletUI();
}

document.addEventListener("DOMContentLoaded", boot);
