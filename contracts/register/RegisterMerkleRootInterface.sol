pragma solidity 0.5.17;

/**
 * @title Interface for Register contract.
 */
interface RegisterInterface {

  function isDeviceMintable(bytes32 hardwareHash) external view returns (bool);
  function getRootDetails(bytes32 root) external view returns (uint256, uint256, uint256, uint256, string memory, string memory, uint256, uint256);
  function mintKong(bytes32[] calldata proof, bytes32 root, bytes32 hardwareHash, address recipient) external;

}
