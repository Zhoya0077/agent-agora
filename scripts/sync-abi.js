#!/usr/bin/env node
/**
 * Copies the compiled ABI into app.js (between the generated markers) and,
 * optionally, sets the deployed contract address.
 *
 * Usage:
 *   node scripts/sync-abi.js                     # ABI only
 *   node scripts/sync-abi.js 0xYourContractAddr  # ABI + address
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const artifact = JSON.parse(fs.readFileSync(path.join(ROOT, "build", "AgentAgora.json"), "utf8"));
const appPath = path.join(ROOT, "app.js");
let source = fs.readFileSync(appPath, "utf8");

const abiJson = JSON.stringify(artifact.abi, null, 2)
  .split("\n")
  .map((line, i) => (i === 0 ? line : "  " + line))
  .join("\n");

const startMarker = "/* ---------------------------------------------- BEGIN ABI (generated) */";
const endMarker = "/* ------------------------------------------------ END ABI (generated) */";
const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker);

if (start === -1 || end === -1) {
  console.error("ABI markers not found in app.js");
  process.exit(1);
}

const block = `${startMarker}\nconst AGORA_ABI = ${abiJson};\n${endMarker}`;
source = source.slice(0, start) + block + source.slice(end + endMarker.length);

const address = process.argv[2];
if (address) {
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    console.error(`Invalid address: ${address}`);
    process.exit(1);
  }
  source = source.replace(
    /const AGORA_ADDRESS = "0x[0-9a-fA-F]{40}";/,
    `const AGORA_ADDRESS = "${address}";`
  );
  console.log(`address set to ${address}`);
}

fs.writeFileSync(appPath, source);
console.log(`ABI injected: ${artifact.abi.length} entries`);
