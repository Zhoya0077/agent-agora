#!/usr/bin/env node
/**
 * Compiles contracts/AgentAgora.sol with the locally installed solc and writes
 * build/AgentAgora.json (ABI, bytecode, deployed bytecode, compiler metadata).
 *
 * Usage: node scripts/compile.js
 */
const fs = require("fs");
const path = require("path");
const solc = require("solc");

const ROOT = path.resolve(__dirname, "..");
const SOURCE_PATH = path.join(ROOT, "contracts", "AgentAgora.sol");
const OUT_DIR = path.join(ROOT, "build");
const OUT_FILE = path.join(OUT_DIR, "AgentAgora.json");

const source = fs.readFileSync(SOURCE_PATH, "utf8");

const input = {
  language: "Solidity",
  sources: {
    "AgentAgora.sol": { content: source },
  },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    // Target the Shanghai EVM: BNB Chain supports Shanghai, and it avoids Cancun
    // opcodes (MCOPY/TSTORE) that not every execution environment implements.
    evmVersion: "shanghai",
    outputSelection: {
      "*": {
        "*": ["abi", "evm.bytecode.object", "evm.deployedBytecode.object", "metadata"],
      },
    },
  },
};

const output = JSON.parse(solc.compile(JSON.stringify(input)));

const diagnostics = (output.errors || []).map((e) => `[${e.severity}] ${e.formattedMessage}`);
const fatal = (output.errors || []).filter((e) => e.severity === "error");

if (diagnostics.length) {
  console.log("--- solc diagnostics ---");
  diagnostics.forEach((d) => console.log(d));
}

if (fatal.length) {
  console.error(`\nCompilation failed with ${fatal.length} error(s).`);
  process.exit(1);
}

const contract = output.contracts["AgentAgora.sol"]["AgentAgora"];
const bytecode = contract.evm.bytecode.object;
const deployed = contract.evm.deployedBytecode.object;

const artifact = {
  contractName: "AgentAgora",
  sourceFile: "contracts/AgentAgora.sol",
  compiler: { version: solc.version(), optimizer: { enabled: true, runs: 200 } },
  abi: contract.abi,
  bytecode: "0x" + bytecode,
  deployedBytecode: "0x" + deployed,
  metadata: JSON.parse(contract.metadata),
};

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT_FILE, JSON.stringify(artifact, null, 2) + "\n");

const sizeKb = ((deployed.length / 2) * 1).toFixed(0);
console.log(`solc: ${solc.version()}`);
console.log(`bytecode (creation):  ${bytecode.length / 2} bytes`);
console.log(`bytecode (deployed):  ${deployed.length / 2} bytes`);
console.log(`ABI entries:          ${contract.abi.length}`);
console.log(`artifact:             ${path.relative(ROOT, OUT_FILE)}`);
console.log(`EIP-170 headroom:     ${24576 - Number(sizeKb)} bytes`);
