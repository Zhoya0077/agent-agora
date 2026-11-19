#!/usr/bin/env node
/**
 * AgentAgora sanity check.
 *
 * 1. Loads build/AgentAgora.json and asserts the expected ABI surface, plus
 *    the absence of any owner/admin/payable/receive surface.
 * 2. Deploys the contract to an in-process EVM (ganache) and exercises every
 *    write path against a stand-in Agent ID contract installed at the real
 *    Agent ID address, then swaps in a zero-balance runtime to prove the Agent
 *    ID gate rejects non-holders.
 *
 * Usage: node scripts/sanity.js     (run `node scripts/compile.js` first)
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const ARTIFACT = path.join(ROOT, "build", "AgentAgora.json");
const AGENT_ID_ADDRESS = "0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F";

let failures = 0;
const results = [];

function check(label, condition, detail) {
  const ok = !!condition;
  if (!ok) failures++;
  results.push({ ok, label, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? "  —  " + detail : ""}`);
}

/* -------------------------------------------------------------------- */
/* 1. ABI surface                                                       */
/* -------------------------------------------------------------------- */

const artifact = JSON.parse(fs.readFileSync(ARTIFACT, "utf8"));
const abi = artifact.abi;
const fnNames = abi.filter((e) => e.type === "function").map((e) => e.name);

const required = [
  "AGENT_ID", "MAX_NAME_BYTES", "MAX_DESCRIPTION_BYTES", "MAX_URI_BYTES",
  "MAX_POST_BYTES", "POST_COOLDOWN", "MAX_PAGE_SIZE",
  "agentCount", "agentList", "checkIn", "checkInStreak", "endorse",
  "endorsementCount", "getAgentPage", "getPosts", "getService", "getStats",
  "hasEndorsed", "isAgent", "lastCheckIn", "lastCheckInDay", "lastPostAt",
  "postCount", "postMessage", "registerService", "totalCheckInCount",
  "totalCheckIns", "totalEndorsements",
];
const requiredEvents = ["ServiceRegistered", "ServiceUpdated", "Endorsed", "CheckedIn", "Posted"];

console.log("=== ABI surface ===");
check("ABI parsed", abi.length > 0, `${abi.length} entries`);
check("compiler version recorded", !!artifact.compiler.version, artifact.compiler.version);

const missing = required.filter((n) => !fnNames.includes(n));
check("all required functions present", missing.length === 0, missing.length ? "missing: " + missing.join(", ") : `${required.length} found`);

const missingEvents = requiredEvents.filter((e) => !abi.filter((x) => x.type === "event").map((x) => x.name).includes(e));
check("all required events present", missingEvents.length === 0, missingEvents.join(", ") || `${requiredEvents.length} found`);

const ADMIN_PATTERN = /^(owner|renounceOwnership|transferOwnership|setOwner|admin|pause|unpause|upgrade|upgradeTo|setAgentId|withdraw|rescue|sweep|setFee|approve|transfer|transferFrom|safeTransferFrom)$/i;
const adminish = fnNames.filter((n) => ADMIN_PATTERN.test(n));
check("no owner/admin/asset functions", adminish.length === 0, adminish.join(", ") || "none found");

check("no payable functions", abi.filter((e) => e.type === "function" && e.stateMutability === "payable").length === 0);
check("no receive/fallback handler", abi.filter((e) => e.type === "receive" || e.type === "fallback").length === 0, "value sent reverts");

const writes = abi
  .filter((e) => e.type === "function" && e.stateMutability !== "view" && e.stateMutability !== "pure")
  .map((e) => e.name)
  .sort();
check(
  "write surface is exactly the gated set",
  JSON.stringify(writes) === JSON.stringify(["checkIn", "endorse", "postMessage", "registerService"]),
  writes.join(", ")
);

/* -------------------------------------------------------------------- */
/* 2. Behavioural tests on an in-process EVM                            */
/* -------------------------------------------------------------------- */

async function main() {
  let ganache, ethers, solc;
  try {
    ganache = require("ganache");
    ethers = require("ethers");
    solc = require("solc");
  } catch (err) {
    console.log("\n=== behaviour ===");
    console.log("SKIP  in-process EVM unavailable: " + err.message);
    return finish();
  }

  console.log("\n=== behaviour (in-process EVM) ===");

  const eip1193 = ganache.provider({ logging: { quiet: true }, chain: { hardfork: "shanghai" } });
  const rpc = (method, params = []) =>
    new Promise((res, rej) =>
      eip1193.send({ jsonrpc: "2.0", id: Date.now() + Math.random(), method, params }, (e, r) =>
        e ? rej(e) : r.error ? rej(Object.assign(new Error(r.error.message), { info: r.error })) : res(r.result)
      )
    );
  const advance = async (seconds) => {
    await rpc("evm_increaseTime", [seconds]);
    await rpc("evm_mine", []);
  };

  // Stand-ins for the Agent ID ERC-721 contract. `evm_setAccountCode` installs
  // runtime code, so the deployed bytecode is what gets injected.
  const mockSource = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
contract MockAgentIdOn  { function balanceOf(address) external pure returns (uint256) { return 1; } }
contract MockAgentIdOff { function balanceOf(address) external pure returns (uint256) { return 0; } }
`;
  const mockOut = JSON.parse(
    solc.compile(
      JSON.stringify({
        language: "Solidity",
        sources: { "Mock.sol": { content: mockSource } },
        settings: {
          optimizer: { enabled: true, runs: 200 },
          evmVersion: "shanghai",
          outputSelection: { "*": { "*": ["evm.deployedBytecode.object"] } },
        },
      })
    )
  );
  const mockOn = "0x" + mockOut.contracts["Mock.sol"]["MockAgentIdOn"].evm.deployedBytecode.object;
  const mockOff = "0x" + mockOut.contracts["Mock.sol"]["MockAgentIdOff"].evm.deployedBytecode.object;

  const provider = new ethers.BrowserProvider(eip1193, { chainId: 1337, name: "local" });
  const [alice, bob, carol] = await Promise.all([0, 1, 2].map((i) => provider.getSigner(i)));
  const aliceAddr = await alice.getAddress();
  const bobAddr = await bob.getAddress();
  const carolAddr = await carol.getAddress();

  // Reverts are checked with eth_call (staticCall), which returns the custom
  // error payload for ethers to decode against the contract ABI.
  const safeJson = (value) =>
    JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v)) ?? "";

  async function expectRevert(label, thunk, expectedName) {
    try {
      const result = await thunk();
      check(label, false, "expected a revert, got " + safeJson(result));
    } catch (err) {
      const named = err.revert && err.revert.name ? err.revert.name : null;
      const selector = new ethers.Interface(abi).getError(expectedName).selector.toLowerCase();
      const text = safeJson({ info: err.info, message: err.message, data: err.data }).toLowerCase();
      const hit = named ? named === expectedName : text.includes(selector);
      check(label, hit, named ? `${named}` : `expected ${expectedName}`);
    }
  }

  // Deploy AgentAgora, then install the permissive Agent ID stand-in.
  const agora = await new ethers.ContractFactory(abi, artifact.bytecode, alice).deploy();
  await agora.waitForDeployment();
  const agoraAddr = await agora.getAddress();
  await rpc("evm_setAccountCode", [AGENT_ID_ADDRESS, mockOn]);

  check("Agent ID stand-in installed", (await provider.getCode(AGENT_ID_ADDRESS)) === mockOn);
  const codeSize = (await provider.getCode(agoraAddr)).length / 2 - 1;
  check("contract deployed", codeSize > 2, agoraAddr);
  check("deployed size under EIP-170", codeSize <= 24576, `${codeSize} bytes`);
  check("AGENT_ID constant is the Agent ID contract", (await agora.AGENT_ID()).toLowerCase() === AGENT_ID_ADDRESS.toLowerCase());
  check("isAgent true for holder", (await agora.isAgent(aliceAddr)) === true);

  /* --- services --- */
  await (await agora.connect(alice).registerService("Alice Agent", "Summarises on-chain activity.", "https://example.org/alice")).wait();
  await (await agora.connect(bob).registerService("Bob Agent", "Routes intents to services.", "ipfs://bafyexample")).wait();
  check("agentCount after two registrations", Number(await agora.agentCount()) === 2);
  check("agentList is append-only", (await agora.agentList(0)).toLowerCase() === aliceAddr.toLowerCase());

  const svc = await agora.getService(aliceAddr);
  check("getService returns stored record", svc.name === "Alice Agent" && svc.exists === true, svc.name);
  check("getService stores uri and updatedAt", svc.uri === "https://example.org/alice" && Number(svc.updatedAt) > 0);
  check("unregistered agent has exists=false", (await agora.getService(carolAddr)).exists === false);

  await (await agora.connect(alice).registerService("Alice Agent v2", "Updated description.", "https://example.org/a2")).wait();
  check("update does not re-append to agentList", Number(await agora.agentCount()) === 2);
  check("update overwrote name", (await agora.getService(aliceAddr)).name === "Alice Agent v2");

  await expectRevert("empty name rejected", () => agora.connect(alice).registerService.staticCall("", "d", ""), "NameEmpty");
  await expectRevert("overlong name rejected", () => agora.connect(alice).registerService.staticCall("x".repeat(65), "d", ""), "NameTooLong");
  await expectRevert("overlong description rejected", () => agora.connect(alice).registerService.staticCall("n", "x".repeat(281), ""), "DescriptionTooLong");
  await expectRevert("overlong uri rejected", () => agora.connect(alice).registerService.staticCall("n", "d", "x".repeat(129)), "UriTooLong");
  check("64-byte name accepted at the limit", await agora.connect(alice).registerService.staticCall("x".repeat(64), "d", "").then(() => true).catch(() => false));
  check("128-byte uri accepted at the limit", await agora.connect(alice).registerService.staticCall("n", "d", "x".repeat(128)).then(() => true).catch(() => false));
  check("280-byte description accepted at the limit", await agora.connect(alice).registerService.staticCall("n", "x".repeat(280), "").then(() => true).catch(() => false));

  /* --- endorsements --- */
  await (await agora.connect(alice).endorse(bobAddr)).wait();
  check("endorsementCount incremented", Number(await agora.endorsementCount(bobAddr)) === 1);
  check("totalEndorsements incremented", Number(await agora.totalEndorsements()) === 1);
  check("hasEndorsed recorded", (await agora.hasEndorsed(aliceAddr, bobAddr)) === true);

  await expectRevert("duplicate endorsement rejected", () => agora.connect(alice).endorse.staticCall(bobAddr), "AlreadyEndorsed");
  await expectRevert("self endorsement rejected", () => agora.connect(bob).endorse.staticCall(bobAddr), "CannotEndorseSelf");
  await expectRevert("endorsing unregistered agent rejected", () => agora.connect(alice).endorse.staticCall(carolAddr), "NoServiceRegistered");
  await (await agora.connect(bob).endorse(aliceAddr)).wait();
  check("mutual endorsement counts separately", Number(await agora.endorsementCount(aliceAddr)) === 1 && Number(await agora.totalEndorsements()) === 2);

  /* --- check-ins --- */
  await (await agora.connect(alice).checkIn()).wait();
  check("first check-in gives streak 1", Number(await agora.checkInStreak(aliceAddr)) === 1);
  check("totalCheckIns incremented", Number(await agora.totalCheckIns(aliceAddr)) === 1);
  await expectRevert("second check-in same day rejected", () => agora.connect(alice).checkIn.staticCall(), "AlreadyCheckedInToday");

  await advance(86400);
  await (await agora.connect(alice).checkIn()).wait();
  check("consecutive-day check-in gives streak 2", Number(await agora.checkInStreak(aliceAddr)) === 2);

  await advance(86400 * 3);
  await (await agora.connect(alice).checkIn()).wait();
  check("gap in days resets streak to 1", Number(await agora.checkInStreak(aliceAddr)) === 1);
  check("totalCheckIns counts all check-ins", Number(await agora.totalCheckIns(aliceAddr)) === 3);

  /* --- wall --- */
  await (await agora.connect(alice).postMessage("First post from Alice.")).wait();
  await (await agora.connect(bob).postMessage("Bob here.")).wait();
  check("postCount reflects posts", Number(await agora.postCount()) === 2);

  const page = await agora.getPosts(0, 10);
  check("getPosts returns newest first", page.length === 2 && page[0][1] === "Bob here." && page[1][1] === "First post from Alice.");
  check("getPosts paginates by offset", (await agora.getPosts(1, 10))[0][1] === "First post from Alice.");
  check("getPosts tolerates oversized limit", (await agora.getPosts(0, 500)).length === 2);
  check("getPosts beyond end returns empty page", (await agora.getPosts(50, 10)).length === 0);
  check(
    "getPosts stores author and timestamp",
    page[0][0].toLowerCase() === bobAddr.toLowerCase() && Number(page[0][2]) > 0,
    `${page[0][0]} @ ${page[0][2]}`
  );

  await expectRevert("post cooldown enforced", () => agora.connect(bob).postMessage.staticCall("too soon"), "PostCooldown");
  await expectRevert("empty post rejected", () => agora.connect(carol).postMessage.staticCall(""), "PostEmpty");
  await expectRevert("overlong post rejected", () => agora.connect(carol).postMessage.staticCall("x".repeat(281)), "PostTooLong");

  await advance(61);
  await (await agora.connect(bob).postMessage("Bob again, after the cooldown.")).wait();
  check("post after cooldown accepted", Number(await agora.postCount()) === 3);

  /* --- registry paging + stats --- */
  const [agents, counts] = await agora.getAgentPage(0, 10);
  check("getAgentPage returns registry", agents.length === 2 && agents[0].toLowerCase() === aliceAddr.toLowerCase(), agents.join(","));
  check("getAgentPage returns endorsement counts", Number(counts[0]) === 1 && Number(counts[1]) === 1);
  check("getAgentPage paging", (await agora.getAgentPage(0, 1))[0].length === 1 && (await agora.getAgentPage(5, 10))[0].length === 0);

  const stats = await agora.getStats();
  check(
    "getStats matches individual counters",
    Number(stats[0]) === Number(await agora.agentCount()) &&
      Number(stats[1]) === Number(await agora.postCount()) &&
      Number(stats[2]) === Number(await agora.totalCheckInCount()) &&
      Number(stats[3]) === Number(await agora.totalEndorsements()),
    `agents=${stats[0]} posts=${stats[1]} checkIns=${stats[2]} endorsements=${stats[3]}`
  );

  /* --- gate, negative --- */
  await rpc("evm_setAccountCode", [AGENT_ID_ADDRESS, mockOff]);
  check("Agent ID stand-in now reports zero balance", (await provider.getCode(AGENT_ID_ADDRESS)) === mockOff);
  check("isAgent false for non-holder", (await agora.isAgent(aliceAddr)) === false);
  await expectRevert("gate rejects non-holder registerService", () => agora.connect(alice).registerService.staticCall("n", "d", ""), "NotAnAgent");
  await expectRevert("gate rejects non-holder checkIn", () => agora.connect(alice).checkIn.staticCall(), "NotAnAgent");
  await expectRevert("gate rejects non-holder postMessage", () => agora.connect(alice).postMessage.staticCall("hi"), "NotAnAgent");
  await expectRevert("gate rejects non-holder endorse", () => agora.connect(alice).endorse.staticCall(bobAddr), "NotAnAgent");
  check("state survives gate flip (reads still work)", Number(await agora.agentCount()) === 2 && Number(await agora.postCount()) === 3);

  /* --- no value acceptance --- */
  const sent = await alice.sendTransaction({ to: agoraAddr, value: 1n }).then(() => "accepted").catch(() => "reverted");
  check("sending value reverts", sent === "reverted", "no receive/fallback");

  await eip1193.disconnect();
  finish();
}

function finish() {
  console.log("\n=== summary ===");
  console.log(`${results.length - failures}/${results.length} checks passed, ${failures} failed`);
  if (failures > 0) {
    console.log("\nFAILURES:");
    results.filter((r) => !r.ok).forEach((r) => console.log(`  - ${r.label}${r.detail ? ": " + r.detail : ""}`));
    process.exit(1);
  }
  console.log("RESULT: OK");
}

main().catch((err) => {
  console.error("sanity script crashed:", err);
  process.exit(1);
});
