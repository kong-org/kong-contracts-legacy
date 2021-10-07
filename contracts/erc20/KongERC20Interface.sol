pragma solidity >=0.5.0 <0.8.0;
/**
 * @title  Interface for Kong ERC20 Token Contract.
 */
interface KongERC20Interface {

  function balanceOf(address who) external view returns (uint256);
  function transfer(address to, uint256 value) external returns (bool);
  function mint(uint256 mintedAmount, address recipient) external;
  function getMintingLimit() external returns(uint256);

}
