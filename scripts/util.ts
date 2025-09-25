import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PublicClient } from "@nomicfoundation/hardhat-viem/types";

type GasReport = {
  totalGasFee: bigint;
  deployGasFee: bigint;
  deployTxHash: string;
  calls: Array<{
    id: string;
    gasFee: bigint;
    txHash: string;
  }>;
};

export async function loadGasReport(
  publicClient: PublicClient,
  deploymentId: string
): Promise<GasReport> {
  // Load: ignition/deployments/<deploymentId>/journal.jsonl
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const journalPath = path.resolve(
    __dirname,
    "../ignition/deployments",
    deploymentId,
    "journal.jsonl"
  );
  if (!fs.existsSync(journalPath)) {
    throw new Error(`journal.jsonl が見つかりません: ${journalPath}`);
  }

  let report: GasReport = {
    totalGasFee: 0n,
    deployGasFee: 0n,
    deployTxHash: "",
    calls: [],
  };
  for (const line of fs.readFileSync(journalPath, "utf8").split(/\r?\n/)) {
    if (!line) continue;
    const entry = JSON.parse(line);
    if (!entry.receipt) continue;

    // `ModuleName#ContractName.callId`
    const callId = entry.futureId.toString().split(".")[1] || "deploy";
    const txHash = entry.hash;
    const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
    if (!receipt) {
      throw new Error(`Failed to get receipt ${txHash}`);
    }
    let gasFee =
      BigInt(receipt.effectiveGasPrice ?? 0n) * BigInt(receipt.gasUsed ?? 0n);

    if (receipt.l1Fee) {
      gasFee += BigInt(receipt.l1Fee);
    }

    if (callId === "deploy") {
      report.deployGasFee = gasFee;
      report.deployTxHash = txHash;
    } else {
      report.calls.push({
        id: callId,
        gasFee,
        txHash,
      });
    }
    report.totalGasFee += gasFee;
  }

  return report;
}
