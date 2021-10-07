// Import test helpers.
const { expectEvent, expectRevert } = require('@openzeppelin/test-helpers');

// Packages / modules.
const bigNumber                  = require('bignumber.js');
const crypto                     = require('crypto');
const ecPem                      = require('ec-pem');
const ethereumJSUtil             = require('ethereumjs-util');
const signer                     = require('../helpers/signer');
const device                     = require('../helpers/device');

// Contracts.
const KongERC20Contract          = artifacts.require('KongERC20Mock');
const EntropyContract            = artifacts.require('KongEntropyMerkle');
const RegisterContract           = artifacts.require('RegisterMerkleRoot');
const EllipticCurveContract      = artifacts.require('EllipticCurve');

// Run tests.
contract('KongEntropyMerkle', function (accounts) {

  let rD;
  let rR;
  // let pubkeyHash;
  let address;
  let blockhash;
  //let sig;

  beforeEach(async function () {

    // Deploy contracts.
    KongERC20 =       await KongERC20Contract.new(accounts[0]);
    Register =        await RegisterContract.new(accounts[0], await KongERC20.address);
    Elliptic =        await EllipticCurveContract.new();
    Entropy =         await EntropyContract.new(Elliptic.address, Register.address);

    oneKongAmount = 0xde0b6b3a7640000
    fiveHundredKongAmount = 0x1b1ae4d6e2ef500000
    kongCount = 3
    mintableKong = 0x1b1ae4d6e2ef5000000 * kongCount

    // Delegate minting rights to address of Entropy contract.
    await Register.delegateMintingRights(Entropy.address, '0x' + mintableKong.toString(16));

    // Add register as minter in ERC20.
    await KongERC20.addMinter(Register.address);

    // Create merkleRoot and some devices.
    oR = await device.createRandomMerkleTree(kongCount, oneKongAmount)
    fR = await device.createRandomMerkleTree(kongCount, fiveHundredKongAmount)

  });

  describe('\n\tEntropy Submission', () => {

    it('submitEntropy() succeeds with valid signature of registered primary key.', async () => {

      // Check if minted.
      assert.equal(await Entropy.isDeviceMinted(oR.devices[0][0]), false);

      // Register.
      await Register.addRoot(
        oR.root[0],
        oR.root[1],
        oR.root[2],
        oR.root[3],
        oR.root[4],
        oR.root[5],
        oR.root[6],
        oR.root[7]
      );

      // var initBalance = await KongERC20.balanceOf.call(accounts[7]);
      // console.log(`initBalance: ${initBalance}`)

      // Generate valid signature.
      sig = await signer.signAddressAndBlockhash(oR.devices[0][11], accounts[7]);

      // Submit entropy.
      var receipt = await Entropy.submitEntropy(oR.proofs[0], oR.root[1], oR.devices[0][1], oR.devices[0][2], oR.devices[0][6], sig.pubkeyX, sig.pubkeyY, sig.address, sig.blockNum, sig.signature);
      expectEvent(receipt, 'Minted');

      // Check if minted.
      assert.equal(await Entropy.isDeviceMinted(oR.devices[0][0]), true);

      // The balance of the minted contract should have increased by mintedAmount.
      var receiverBalance = await KongERC20.balanceOf.call(sig.address);
      assert.equal(parseInt(receiverBalance), parseInt(0xde0b6b3a7640000));

    });

    it('submitEntropy() --- Transaction cost test for 1 Kong.', async () => {

      // Register.
      await Register.addRoot(
        oR.root[0],
        oR.root[1],
        oR.root[2],
        oR.root[3],
        oR.root[4],
        oR.root[5],
        oR.root[6],
        oR.root[7]
      );

      // Generate valid signature.
      sig = await signer.signAddressAndBlockhash(oR.devices[0][11], accounts[1]);

      // Submit entropy.
      await Entropy.submitEntropy(oR.proofs[0], oR.root[1], oR.devices[0][1], oR.devices[0][2], oR.devices[0][6], sig.pubkeyX, sig.pubkeyY, sig.address, sig.blockNum, sig.signature);

    });

    it('submitEntropy() --- Transaction cost test for 500 Kong.', async () => {

      // Register.
      await Register.addRoot(
        fR.root[0],
        fR.root[1],
        fR.root[2],
        fR.root[3],
        fR.root[4],
        fR.root[5],
        fR.root[6],
        fR.root[7]
      );

      // Generate valid signature.
      sig = await signer.signAddressAndBlockhash(fR.devices[0][11], accounts[1]);

      // Submit entropy.
      await Entropy.submitEntropy(fR.proofs[0], fR.root[1], fR.devices[0][1], fR.devices[0][2], fR.devices[0][6], sig.pubkeyX, sig.pubkeyY, sig.address, sig.blockNum, sig.signature);

    });

    it('submitEntropy() fails when called multiple times for the same key.', async () => {

      // Register.
      await Register.addRoot(
        oR.root[0],
        oR.root[1],
        oR.root[2],
        oR.root[3],
        oR.root[4],
        oR.root[5],
        oR.root[6],
        oR.root[7]
      );

      // Generate valid signature.
      sig = await signer.signAddressAndBlockhash(oR.devices[0][11], accounts[1]);

      // Submit entropy.
      await Entropy.submitEntropy(oR.proofs[0], oR.root[1], oR.devices[0][1], oR.devices[0][2], oR.devices[0][6], sig.pubkeyX, sig.pubkeyY, sig.address, sig.blockNum, sig.signature);

      // Submit entropy again.
      await expectRevert(Entropy.submitEntropy(oR.proofs[0], oR.root[1], oR.devices[0][1], oR.devices[0][2], oR.devices[0][6], sig.pubkeyX, sig.pubkeyY, sig.address, sig.blockNum, sig.signature), 'Already minted.');

    });

    it('submitEntropy() fails when called for unregistered root.', async () => {

      // Generate valid signature.
      sig = await signer.signAddressAndBlockhash(oR.devices[0][11], accounts[1]);

      // Submit.
      await expectRevert(Entropy.submitEntropy(oR.proofs[0], oR.root[1], oR.devices[0][1], oR.devices[0][2], oR.devices[0][6], sig.pubkeyX, sig.pubkeyY, sig.address, sig.blockNum, sig.signature), 'Invalid root.');

    });

    it('submitEntropy() fails when provided key does not hash to registered key.', async () => {

      // Register.
      await Register.addRoot(
        oR.root[0],
        oR.root[1],
        oR.root[2],
        oR.root[3],
        oR.root[4],
        oR.root[5],
        oR.root[6],
        oR.root[7]
      );

      // Generate valid signature.
      sig = await signer.signAddressAndBlockhash(oR.devices[0][11], accounts[1]);

      // Submit.
      await expectRevert(Entropy.submitEntropy(oR.proofs[0], oR.root[1], oR.devices[0][1], oR.devices[0][1], oR.devices[0][6], sig.pubkeyX, sig.pubkeyY, sig.address, sig.blockNum, sig.signature), 'Device not found in root.');

    });

    it('Otherwise valid call to submitEntropy() throws when entropy contract is not minter.', async () => {

      // Register.
      await Register.addRoot(
        oR.root[0],
        oR.root[1],
        oR.root[2],
        oR.root[3],
        oR.root[4],
        oR.root[5],
        oR.root[6],
        oR.root[7]
      );

      // Remove entropy contract.
      await Register.removeMintingRights(Entropy.address);

      // Generate valid signature.
      sig = await signer.signAddressAndBlockhash(oR.devices[0][11], accounts[1]);

      // This should not work.
      await expectRevert(Entropy.submitEntropy(oR.proofs[0], oR.root[1], oR.devices[0][1], oR.devices[0][2], oR.devices[0][6], sig.pubkeyX, sig.pubkeyY, sig.address, sig.blockNum, sig.signature), 'Can only be called by owner or minter.');

    });

    it('Otherwise valid call to submitEntropy() throws when called with invalid address for signature.', async () => {

      // Register.
      await Register.addRoot(
        oR.root[0],
        oR.root[1],
        oR.root[2],
        oR.root[3],
        oR.root[4],
        oR.root[5],
        oR.root[6],
        oR.root[7]
      );

      // Generate valid signature.
      sig = await signer.signAddressAndBlockhash(oR.devices[0][11], accounts[1]);

      // This should not work (invalid address).
      await expectRevert(Entropy.submitEntropy(oR.proofs[0], oR.root[1], oR.devices[0][1], oR.devices[0][2], oR.devices[0][6], sig.pubkeyX, sig.pubkeyY, accounts[2], sig.blockNum, sig.signature), 'Invalid signature.');

    });

    it('Otherwise valid call to submitEntropy() throws when called with invalid blockNum for signature.', async () => {

      // Register.
      await Register.addRoot(
        oR.root[0],
        oR.root[1],
        oR.root[2],
        oR.root[3],
        oR.root[4],
        oR.root[5],
        oR.root[6],
        oR.root[7]
      );

      // Generate valid signature.
      sig = await signer.signAddressAndBlockhash(oR.devices[0][11], accounts[1]);

      // This should not work (invalid blocknum).
      await expectRevert(Entropy.submitEntropy(oR.proofs[0], oR.root[1], oR.devices[0][1], oR.devices[0][2], oR.devices[0][6], sig.pubkeyX, sig.pubkeyY, sig.address, sig.blockNum - 1, sig.signature), 'Invalid signature.');

    });

    it('Otherwise valid call to submitEntropy() throws when called with wrong signature.', async () => {

      // Register.
      await Register.addRoot(
        oR.root[0],
        oR.root[1],
        oR.root[2],
        oR.root[3],
        oR.root[4],
        oR.root[5],
        oR.root[6],
        oR.root[7]
      );

      // Generate valid signature.
      sig = await signer.signAddressAndBlockhash(oR.devices[0][11], accounts[1]);

      // Flip signature.
      var wrongSignature = [sig.signature[1], sig.signature[0]];

      // This should not work (flipped signature).
      await expectRevert(Entropy.submitEntropy(oR.proofs[0], oR.root[1], oR.devices[0][1], oR.devices[0][2], oR.devices[0][6], sig.pubkeyX, sig.pubkeyY, sig.address, sig.blockNum, wrongSignature), 'Invalid signature.');

    });

  });

});
