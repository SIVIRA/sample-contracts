import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("SampleMultipleTypeNFTModule", (m) => {
  const maxTokenType = m.getParameter("maxTokenType", 2n);
  const minter = m.getParameter("minter");
  const owner = m.getParameter("owner");

  const nft = m.contract("SampleMultipleTypeNFT", [maxTokenType]);

  const setBaseTokenURI = m.call(nft, "setBaseTokenURI", ["https://example.com/tokens/"]);

  const addMinter = m.call(nft, "addMinter", [minter]);

  const unpause = m.call(nft, "unpause", [], { after: [setBaseTokenURI, addMinter] });

  m.call(nft, "transferOwnership", [owner], { after: [unpause] });

  return { nft };
});
