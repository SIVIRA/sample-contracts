import hre from "hardhat";
import path from "path";
import { formatEther } from "viem";

import SampleMultipleTypeNFT from "../ignition/modules/SampleMultipleTypeNFT.ts";
import { loadGasReport } from "./util";

const DEPLOYMENT_NAME = "SampleMultipleTypeNFTDeployment";

async function main() {
  const connection = await hre.network.connect();
  const publicClient = await connection.viem.getPublicClient();
  const deploymentId = `${DEPLOYMENT_NAME}-${connection.networkConfig.chainId}`;

  const { nft } = await connection.ignition.deploy(SampleMultipleTypeNFT, {
    parameters: path.resolve(import.meta.dirname, "../ignition/params.json"),
    deploymentId,
  });

  console.log(
    "Chain:",
    connection.networkName,
    connection.networkConfig.chainId
  );
  console.log("SampleMultipleTypeNFT deployed to:", nft.address);

  const gasReport = await loadGasReport(publicClient, deploymentId);
  console.log();
  console.log("[Gas Report]");
  console.log("Total:", formatEther(gasReport.totalGasFee, "wei"), "eth");
  console.log(
    "  * Deploy:",
    `${formatEther(gasReport.deployGasFee, "wei")} eth (tx: ${
      gasReport.deployTxHash
    })`
  );
  for (const call of gasReport.calls) {
    console.log(
      `  * Call ${call.id}: ${formatEther(call.gasFee, "wei")} eth (tx: ${
        call.txHash
      })`
    );
  }
}

main().catch(console.error);
