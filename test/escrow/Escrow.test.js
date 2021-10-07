// Import test helpers.
const { expectEvent, expectRevert } = require('@openzeppelin/test-helpers');

// Packages / modules.
const bigNumber         = require('bignumber.js');
const crypto            = require('crypto');
const timeTravel        = require('../helpers/timeTravel');
const signer            = require('../helpers/signer');

// Contracts.
const KongERC20Contract     = artifacts.require('KongERC20Mock');
const EscrowContract        = artifacts.require('Escrow');
const EllipticCurveContract = artifacts.require('EllipticCurve');

// Run tests.
contract('Escrow Tests', (accounts) => {

  let ERC20;
  let Escrow;
  let Elliptic;

  beforeEach(async () => {

    // Curve and key objects.
    curve = crypto.createECDH('prime256v1');
    curve.generateKeys();
    publicKey = [
      '0x' + curve.getPublicKey('hex').slice(2, 66),
      '0x' + curve.getPublicKey('hex').slice(-64)
    ];

    // Get block data and timestamp.
    currentBlock        = await web3.eth.getBlock('latest');
    releaseTimestamp    = currentBlock.timestamp + 100;

    // Contracts.
    ERC20               = await KongERC20Contract.new(accounts[0]);
    Elliptic            = await EllipticCurveContract.new();
    Escrow              = await EscrowContract.new(
      publicKey[0], publicKey[1],
      Elliptic.address, ERC20.address,
      releaseTimestamp
    );

  });

  describe('\n\tBasics', async function () {

    it('Sets state variables in Escrow contract.', async function () {

      const KongEscrowState = await Escrow.getContractState.call();

      assert.equal(new bigNumber(KongEscrowState[0]).isEqualTo(new bigNumber(publicKey[0])), true);
      assert.equal(new bigNumber(KongEscrowState[1]).isEqualTo(new bigNumber(publicKey[1])), true);
      assert.equal(KongEscrowState[2], Elliptic.address);
      assert.equal(new bigNumber(KongEscrowState[3]).isEqualTo(new bigNumber(releaseTimestamp)), true);
      assert.equal(KongEscrowState[4], ERC20.address);

    });

  });

  describe('\n\tCases that should fail', async function () {

    it('transferTokens() throws when provided with invalid signature.', async function () {

      // Create invalid signature.
      sig = await signer.signAddressAndBlockhash(curve, accounts[1]);
      sig.signature = [
        '0x' + sig.signature[0].slice(2).split('').sort(function(){return 0.5-Math.random()}).join(''),
        '0x' + sig.signature[1].slice(2).split('').sort(function(){return 0.5-Math.random()}).join('')
      ];

      // Go to valid transfer period.
      await timeTravel.advanceTime(101);

      // This should throw as the signature is invalid.
      await expectRevert(Escrow.transferTokens(accounts[1], sig.blockNum, sig.signature), 'Invalid signature.');

    });

    it('transferTokens() throws when provided with signature of outdated blockhash.', async function () {

      // Transfer tokens to Escrow contract.
      await ERC20.transfer(Escrow.address, 100);

      // Verify.
      var escrowBalance = await ERC20.balanceOf(Escrow.address);
      assert.equal(new bigNumber(escrowBalance).isEqualTo(100), true);

      // Create a signature to transfer toklens off contract.
      sig = await signer.signAddressAndBlockhash(curve, accounts[1]);

      // Go to valid transfer period (timestamp).
      await timeTravel.advanceTime(101);

      // Advance 250 blocks
      for (i=0; i<=250; i++) {
        await timeTravel.advanceBlock();
      }

      // This should throw as only blockhashes from the last 240 blocks are acceptable.
      await expectRevert(Escrow.transferTokens(accounts[1], sig.blockNum, sig.signature), 'Outdated block.');

    });

    it('transferTokens() throws when trying to transfer tokens before releaseTimestamp.', async function () {

      // Transfer tokens to Escrow contract.
      await ERC20.transfer(Escrow.address, 100);

      // Verify.
      var receiverBalance = await ERC20.balanceOf(Escrow.address);
      assert.equal(new bigNumber(receiverBalance).isEqualTo(100), true);

      // Create valid signature.
      sig = await signer.signAddressAndBlockhash(curve, accounts[1]);

      // This should throw as timestamp for unlock has not been reached.
      await expectRevert(Escrow.transferTokens(accounts[1], sig.blockNum, sig.signature), 'Cannot unlock yet.');

    });

  });

  describe('\n\tCases that should succeed', async function () {

    it('transferTokens() transfers tokens with valid signature after releaseTimestamp.', async function () {

      // Transfer tokens to Escrow contract.
      await ERC20.transfer(Escrow.address, 100);

      // Verify.
      var receiverBalance = await ERC20.balanceOf(Escrow.address);
      assert.equal(new bigNumber(receiverBalance).isEqualTo(100), true);

      // Advance to unlock period.
      await timeTravel.advanceTime(100 + 1);
      await timeTravel.advanceBlock();

      // Create valid signature.
      sig = await signer.signAddressAndBlockhash(curve, accounts[8]);

      // Submit - this should succeed.
      await Escrow.transferTokens(accounts[8], sig.blockNum, sig.signature);

      // Verify receipt.
      var claimantBalance = await ERC20.balanceOf(accounts[8]);
      assert.equal(new bigNumber(claimantBalance).isEqualTo(100), true);

      // Verify existence of transfer event and identity of recipient.
      const eventList = await ERC20.getPastEvents("Transfer", {fromBlock: 0, toBlock: 'latest'});
      assert.equal(eventList[eventList.length - 1].event, 'Transfer');
      assert.equal(eventList[eventList.length - 1].returnValues['from'], Escrow.address);
      assert.equal(eventList[eventList.length - 1].returnValues['to'], accounts[8]);

    });

  });

})
