pragma solidity 0.5.2;

// Import ERC20 contract.
import "./KongERC20.sol";

/**
 * @dev This contract wraps the KongERC20 for testing purposes.
 */
contract KongERC20Mock is KongERC20 {

  constructor(address owner) public KongERC20(owner) {

    // Assign test tokens.
    _mint(0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266, 10000000 * 10 ** 18);
    _mint(0x70997970C51812dc3A010C7d01b50e0d17dc79C8, 10000000 * 10 ** 18);

  }

  function mockMint(uint256 mintedAmount, address recipient) public {

    // Enforce global cap.
    require(_totalMinted.add(mintedAmount) <= getMintingLimit(), 'Exceeds global cap.');

    // Increase minted amount.
    _totalMinted += mintedAmount;

    // Mint.
    _mint(recipient, mintedAmount);

  }

}
