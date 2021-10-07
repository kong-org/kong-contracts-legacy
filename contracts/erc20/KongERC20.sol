pragma solidity 0.5.2;

// Import Safe Math library.
import 'openzeppelin-solidity/contracts/math/SafeMath.sol';

// Import contracts.
import 'openzeppelin-solidity/contracts/token/ERC20/ERC20.sol';
import 'openzeppelin-solidity/contracts/token/ERC20/ERC20Burnable.sol';
import 'openzeppelin-solidity/contracts/token/ERC20/ERC20Detailed.sol';
import '../lockdrop/LockDrop.sol';

/**
 * @title  Kong ERC20 Token Contract.
 *
 * @dev    Extends OpenZeppelin contracts `ERC20`, `ERC20Detailed`, and `ERC20Burnable`.
 *
 *         Main additions:
 *
 *         - `beginLockDrop()`: Function to deploy instances of `LockDrop` contracts. This function
 *         can be called periodically. The amount of new tokens minted is proportional to the
 *         existing supply of tokens.
 *
 *         - `mint()`: Function to mint new Kong token. Can only be called by addresses that have
 *         been added to `_minters` through `addMinter()` which is only accessible to `owner`.
 *         `mint()` is subject to restrictions concerning the mintable amount (see below).
 */
contract KongERC20 is ERC20, ERC20Burnable, ERC20Detailed {

    // Constants.
    uint256 constant ONE_YEAR = 365 * 24 * 60 * 60;
    uint256 constant ONE_MONTH = 30 * 24 * 60 * 60;
    uint256 constant MINTING_REWARD = 2 ** 8 * 10 ** 18;

    // Account with right to add to `minters`.
    address public _owner;

    // Total amount minted through `minters`; does not include Genesis Kong.
    uint256 public _totalMinted;

    // Timestamp of contract deployment; used to calculate number of years since launch.
    uint256 public _launchTimestamp;

    // Address and timestamp of last `LockDrop` deployment.
    address public _lastLockDropAddress;
    uint256 public _lastLockDropTimestamp;

    // Addresses allowed to mint new Kong.
    mapping (address => bool) public _minters;

    // Emits when new `LockDrop` is deployed.
    event LockDropCreation(
        address deployedBy,
        uint256 deployedTimestamp,
        uint256 deployedSize,
        address deployedAddress
    );

    // Emits when a new address is added to `minters`.
    event MinterAddition(
        address minter
    );

    /**
     * @dev The constructor sets the following variables:
     *
     *      - `_name`,
     *      - `_symbol`,
     *      - `_decimals`,
     *      - `_owner`, and
     *      - `_launchTimeStamp`.
     *
     *      It also mints Genesis tokens.
     */
    constructor(address owner) public ERC20Detailed('KONG', 'KONG', 18) {

        // Set _owner.
        _owner = owner;

        // Store launch time.
        _launchTimestamp = block.timestamp;

        // Mint Genesis Kong.
        _mint(0xBEf7E07B54809Ecfc6f281012F539f22E261f1B8, 3 * 2 ** 20 * 10 ** 18);
        _mint(0x9699b500fD907636f10965d005813F0CE0986176, 2 ** 20 * 10 ** 18);
        _mint(0xdBa9A507aa0838370399FDE048752E91B5a27F06, 2 ** 20 * 10 ** 18);
        _mint(0xb2E0F4dee26CcCf1f3A267Ad185f212Dd3e7a6b1, 2 ** 20 * 10 ** 18);
        _mint(0xdB6e9FaAcE283e230939769A2DFa80BdcD7E1E43, 2 ** 20 * 10 ** 18);

    }

    /**
     * @dev Function to add a minter.
     */
    function addMinter(address minter) public {

      require(msg.sender == _owner, 'Can only be called by owner.');

      _minters[minter] = true;
      emit MinterAddition(minter);

    }

    /**
     * @dev Function to deploy a new `LockDrop` contract. The function can be called every 30 days,
     *      i.e., whenever 30 days have passed since the function was last called successfully.
     *      Mints approximately (1.01^(1/12) - 1) percent of the current total supply
     *      and transfers the new tokens to the deployed contract. Mints `MINTING_REWARD` tokens
     *      to whoever calls it successfully.
     */
    function beginLockDrop() public {

        // Verify that time to last `LockDrop` deployment exceeds 30 days.
        require(_lastLockDropTimestamp + ONE_MONTH <= block.timestamp, '30 day cooling period.');

        // Update timestamp of last `LockDrop` deployment.
        _lastLockDropTimestamp = block.timestamp;

        // Calculate size of lockdrop as 0.0008295381 (≈ 1.01 ^ (1/12) - 1) times the total supply.
        uint256 lockDropSize = totalSupply().mul(8295381).div(10 ** 10);

        // Deploy a new `LockDrop` contract.
        LockDrop lockDrop = new LockDrop(address(this));

        // Update address of last lock drop.
        _lastLockDropAddress = address(lockDrop);

        // Mint `lockDropSize` to deployed `LockDrop` contract.
        _mint(_lastLockDropAddress, lockDropSize);

        // Mint `MINTING_REWARD` to msg.sender.
        _mint(msg.sender, MINTING_REWARD);

        // Emit event.
        emit LockDropCreation(
            msg.sender,
            block.timestamp,
            lockDropSize,
            address(lockDrop)
        );

    }

    /**
     * @dev Helper function to calculate the maximal amount `minters` are capable of minting.
     */
    function getMintingLimit() public view returns(uint256) {

        // Calculate number of years since launch.
        uint256 y = (block.timestamp - _launchTimestamp) / uint(ONE_YEAR);

        // Determine maximally mintable amount.
        uint256 mintingLimit = 2 ** 25 * 10 ** 18;
        if (y > 0) {mintingLimit += 2 ** 24 * 10 ** 18;}
        if (y > 1) {mintingLimit += 2 ** 23 * 10 ** 18;}
        if (y > 2) {mintingLimit += 2 ** 22 * 10 ** 18;}

        // Return.
        return mintingLimit;

    }

    /**
     * @dev Mints new tokens conditional on not exceeding minting limits. Can only be called by
     *      valid `minters`.
     */
    function mint(uint256 mintedAmount, address recipient) public {

        require(_minters[msg.sender] == true, 'Can only be called by registered minter.');

        // Enforce global cap.
        require(_totalMinted.add(mintedAmount) <= getMintingLimit(), 'Exceeds global cap.');

        // Increase minted amount.
        _totalMinted += mintedAmount;

        // Mint.
        _mint(recipient, mintedAmount);

    }

}
