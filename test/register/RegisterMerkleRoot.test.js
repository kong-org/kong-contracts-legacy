// Import test helpers.
const { expectEvent, expectRevert } = require('@openzeppelin/test-helpers');

// Packages / modules.
const bigNumber                  = require('bignumber.js');
const timeTravel                 = require("../helpers/timeTravel");
const crypto                     = require('crypto');
const signer                     = require('../helpers/signer');
const { MerkleTree }             = require('../helpers/merkleTree.js');
const device                     = require('../helpers/device');


// Contracts.
const EllipticCurveContract      = artifacts.require('EllipticCurve');
const KongERC20Contract          = artifacts.require('KongERC20Mock');
const RegisterMerkleRootContract = artifacts.require('RegisterMerkleRoot');

// Run tests.
contract('RegisterMerkleRoot', function (accounts) {

  let rR;
  let rC;
  let KongERC20;
  let Register;
  let Elliptic;
  let maximumMintingRights;

  beforeEach(async function () {

    maximumMintingRights =  (2 ** 25 + 2 ** 24 + 2 ** 23 + 2 ** 22) * 10 ** 18;

    KongERC20 =             await KongERC20Contract.new(accounts[0]);
    Register =              await RegisterMerkleRootContract.new(accounts[0], await KongERC20.address);
    Elliptic =              await EllipticCurveContract.new();

    rR = await device.createRandomMerkleTree(3, 0xde0b6b3a7640000);
    rC = await device.createRandomMerkleTree(1, 0x422CA8B0A00A4250000000);

    //aR = await device.createMerkleTreeFromFiles('/Users/cameron/Documents/Airtime/kongbucks/kong/deployment/json/_0_kong', 0xde0b6b3a7640000);
    //console.log(aR.root)

    // Register register as minter.
    await KongERC20.addMinter(Register.address);

  });

  describe('\n\tConstructor Tests', () => {

    it('constructor() accounts[0] as _owner.', async function () {

        assert.equal(accounts[0], await Register._owner.call());

    });

    it('constructor() sets mintingCaps[_owner] to expected amount.', async function () {

        assert.equal(maximumMintingRights, await Register._mintingCaps.call(accounts[0]));

    });

    it('constructor() sets correct address for _kongERC20Address.', async function () {

        assert.equal(KongERC20.address, await Register._kongERC20Address.call());

    });

  });

  describe('\n\tRegisterMerkelRoot', () => {

    it('addRoot() emits event upon registration.', async function () {

      // Register.
      var {logs} = await Register.addRoot(
        rR.root[0],
        rR.root[1],
        rR.root[2],
        rR.root[3],
        rR.root[4],
        rR.root[5],
        rR.root[6],
        rR.root[7]                              
      );

      // Verify existence of registration event.
      expectEvent.inLogs(logs, 'RootAddition');

    });

    it('addRoot() correctly inserts new struct.', async function () {

      // Register.
      await Register.addRoot(
        rR.root[0],
        rR.root[1],
        rR.root[2],
        rR.root[3],
        rR.root[4],
        rR.root[5],
        rR.root[6],
        rR.root[7]
      );

      var returnedForValidHash = await Register.verifyProof.call(rR.proofs[0], rR.root[1], rR.devices[0][0], rR.devices[0][8]);
      assert.equal(returnedForValidHash, true);

    });       

    it('addRoot() throws when attempting to mint more than allowed by ERC20 contract (in year 0).', async function () {

      Register.addRoot(
        rR.root[0],
        rR.root[1],
        rR.root[2],
        rR.root[3],
        rR.root[4],
        rR.root[5],
        rR.root[6],
        rR.root[7]
      );

      // This should throw.
      await expectRevert(
        Register.addRoot(
          rC.root[0],
          rC.root[1],
          rC.root[2],
          rC.root[3],
          rC.root[4],
          rC.root[5],
          rC.root[6],
          rR.root[7]
        ), 'Exceeds cumulative limit.'
      );

    });

    it('addRoot() reduces remaining minting rights when called successfully.', async function () {

      // Get minting rights before.
      var mintingRightsBefore = new bigNumber(await Register._mintingCaps.call(accounts[0]));

      // Register random root.
      await Register.addRoot(
        rR.root[0],
        rR.root[1],
        rR.root[2],
        rR.root[3],        
        rR.root[4],       
        rR.root[5],
        rR.root[6],
        rR.root[7]
      );

      // Get minting rights after.
      var mintingRightsAfter = new bigNumber(await Register._mintingCaps.call(accounts[0]));

      // Verify.
      assert.equal((mintingRightsBefore.minus(rR.root[4])).isEqualTo(mintingRightsAfter), true);

    });

    it('addRoot() fails when if deviceKongAmount * totalDevices != totalMintableKong', async function () {
      // Register with extra device.
      await expectRevert(
        Register.addRoot(
          rR.root[0],
          rR.root[1],
          '0xde0b6b3a7640001',
          rR.root[3],
          rR.root[4],
          rR.root[5],
          rR.root[6],
          rR.root[7]
        ), 'Incorrect Kong per device.'
      );

    })

    it('addRoot() throws when trying to register the same root multiple times.', async function () {

      // Register.
      await Register.addRoot(
        rR.root[0],
        rR.root[1],
        rR.root[2],
        rR.root[3],
        rR.root[4],
        rR.root[5],
        rR.root[6],
        rR.root[7]
      );

      // Attempt second registration of same hash.
      await expectRevert(
        Register.addRoot(
          rR.root[0],
          rR.root[1],
          rR.root[2],
          rR.root[3],
          rR.root[4],
          rR.root[5],
          rR.root[6],
          rR.root[7]
        ), 'Already registered.'
      );

    });

    it('addRoot() throws when trying to register from account that is not among _minters.', async function () {

      // Attempt to register from wrong account.
      await expectRevert(
        Register.addRoot(
          rR.root[0],
          rR.root[1],
          rR.root[2],
          rR.root[3],
          rR.root[4],
          rR.root[5],
          rR.root[6],
          rR.root[7],
          {from: accounts[1]}
        ), 'Can only be called by owner or minter.'
      );

    });

    it('delegateMintingRights() allows for registration through new account after adding it to _minters.', async function () {

      // Add minter.
      var {logs} = await Register.delegateMintingRights(accounts[1], '0x12c', {from: accounts[0]});
      expectEvent.inLogs(logs, 'MinterAddition');

      // Register.
      var {logs} = await Register.addRoot(
        rR.root[0],
        rR.root[1],
        '0x64',
        rR.root[3],
        '0x12c',
        rR.root[5],
        rR.root[6],
        rR.root[7],
        {from: accounts[1]}
      );
      expectEvent.inLogs(logs, 'RootAddition');

      // Check that the root works for another device.
      var returnedForValidHash = await Register.verifyProof.call(rR.proofs[0], rR.root[1], rR.devices[0][0], '0x64');
      assert.equal(returnedForValidHash, true);

    });

    it('delegateMintingRights() throws when called from any account but owner.', async function () {

      // Add minter.
      await Register.delegateMintingRights(accounts[1], 1, {from: accounts[0]});

      // This should throw because accounts[1] is minter but not owner.
      await expectRevert(Register.delegateMintingRights(accounts[2], 1, {from: accounts[1]}), 'Can only be called by owner.');

    });

    it('delegateMintingRights() throws when attempting to endow new account with more rights than calling account has.', async function () {

      // Add minter.
      await Register.delegateMintingRights(accounts[1], 1, {from: accounts[0]});
      await expectRevert.unspecified(
        Register.delegateMintingRights(
          accounts[1],
          '0x340aad21b3b70000000000', // (Equals maximum minting rights.)
          {from: accounts[0]}
        )
      );

    });

    it('delegateMintingRights() moves minting rights from granting to granted account.', async function () {

      // Get minting rights before.
      var mintingCap0Before = new bigNumber(await Register._mintingCaps.call(accounts[0]));

      // Add minter.
      await Register.delegateMintingRights(accounts[1], 100, {from: accounts[0]});

      // Get minting rights for both accounts.
      var mintingCap0After = new bigNumber(await Register._mintingCaps.call(accounts[0]));
      var mintingCap1After = new bigNumber(await Register._mintingCaps.call(accounts[1]));

      // Verify.
      assert.equal((mintingCap0Before.minus(100)).isEqualTo(mintingCap0After), true);
      assert.equal(mintingCap1After.isEqualTo(100), true);

    });

    it('delegateMintingRights() tops up minting rights when called multiple times.', async function () {

      // Add minter.
      await Register.delegateMintingRights(accounts[1], 100, {from: accounts[0]});
      await Register.delegateMintingRights(accounts[1], 100, {from: accounts[0]});

      assert.equal(parseInt(await Register._mintingCaps.call(accounts[1])), 200);

    });

    it('removeMintingRights() moves minting rights back to owner.', async function () {

      // Add minter.
      await Register.delegateMintingRights(accounts[1], 100, {from: accounts[0]});

      // Get minting rights after adding.
      var mintingRightsAfterAdding0 = new bigNumber(await Register._mintingCaps.call(accounts[0]));
      var mintingRightsAfterAdding1 = new bigNumber(await Register._mintingCaps.call(accounts[1]));

      // Remove them.
      await Register.removeMintingRights(accounts[1], {from: accounts[0]});

      // Get minting rights after removing.
      var mintingRightsAfterRemoving0 = new bigNumber(await Register._mintingCaps.call(accounts[0]));
      var mintingRightsAfterRemoving1 = new bigNumber(await Register._mintingCaps.call(accounts[1]));

      // Verify.
      assert.equal((mintingRightsAfterAdding0.plus(100)).isEqualTo(mintingRightsAfterRemoving0), true);
      assert.equal((mintingRightsAfterAdding1.minus(100)).isEqualTo(mintingRightsAfterRemoving1), true);
      assert.equal(mintingRightsAfterRemoving1.isEqualTo(0), true);

    });

    it('removeMintingRights() throws when called with owner as removed minter.', async function () {

      await expectRevert(
        Register.removeMintingRights(
          accounts[0],
          {from: accounts[0]}
        ), 'Cannot remove owner from minters.'
      );

    });

    it('addRoot() throws if successfully added minter attempts to create mintable Kong with amount exceeding minter`s minting rights.', async function () {

      // Add minter.
      await Register.delegateMintingRights(accounts[1], 0x12B, {from: accounts[0]});
      await expectRevert(Register.addRoot(
        rR.root[0],
        rR.root[1],
        '0x64',
        rR.root[3],        
        '0x12C',       
        rR.root[5],
        rR.root[6],
        rR.root[7], {from: accounts[1]}), 'SafeMath: subtraction overflow');

    });

  });

  describe('\n\tVerify', () => {
    it('verifyProof() correctly validates proof from filesystem.', async function () {
      // Create merkle tree from actual Kong JSON files. Note that Kong amount and mintableTime must match desired files; non-matching files will not be added to tree.
      aR = await device.createMerkleTreeFromFiles('/Users/cameron/Documents/Airtime/kongbucks/kong/deployment/json/_0_kong', 0xde0b6b3a7640000, 1664668800);

      // Register.
      await Register.addRoot(
        aR.root[0],
        aR.root[1],
        aR.root[2],
        aR.root[3],
        aR.root[4],
        aR.root[5],
        aR.root[6],
        rR.root[7]
      );

      var returnedForValidHash = await Register.verifyProof.call(aR.proofs[5], aR.root[1], aR.deviceHardwareHashes[5], aR.root[2]);
      assert.equal(returnedForValidHash, true);

    }); 

    it('verifyProof() returns false for invalid hardwareHash.', async function () {

      // Register.
      await Register.addRoot(
        rR.root[0],
        rR.root[1],
        rR.root[2],
        rR.root[3],
        rR.root[4],
        rR.root[5],
        rR.root[6],
        rR.root[7]
      );

      // This should throw.
      var returnedForValidHash = await Register.verifyProof.call(rR.proofs[0], rR.root[1], rR.devices[0][1], rR.devices[0][8]);
      assert.equal(returnedForValidHash, false);      

    });


    it('verifyProof() returns false for invalid proof.', async function () {

      // Register.
      await Register.addRoot(
        rR.root[0],
        rR.root[1],
        rR.root[2],
        rR.root[3],
        rR.root[4],
        rR.root[5],
        rR.root[6],
        rR.root[7]
      );

      // This should throw.
      var returnedForValidHash = await Register.verifyProof.call(rR.proofs[1], rR.root[1], rR.devices[0][0], rR.devices[0][8]);
      assert.equal(returnedForValidHash, false);      

    });

  });

  describe('\n\tAdmin', () => {

    it('addUpgradeAddress() successfully adds upgrade address if none present.', async function () {

      var {logs} = await Register.addUpgradeAddress(accounts[5]);

      // Verify existence of address addition event.
      expectEvent.inLogs(logs, 'UpgradeAddressAdded');

      assert.equal(accounts[5], await Register._upgradeContract.call());

    });

    it('addSigner() successfully adds signer.', async function () {

      var {logs} = await Register.addSigner(accounts[5]);

      // Verify existence of address addition event.
      expectEvent.inLogs(logs, 'SignerAddition');

    });    


    it('removeSigner() successfully removes signer.', async function () {

      var {logs} = await Register.addSigner(accounts[5]);

      // Verify existence of address addition event.
      expectEvent.inLogs(logs, 'SignerAddition');

      var {logs} = await Register.removeSigner(accounts[5]);

      // Verify existence of address addition event.
      expectEvent.inLogs(logs, 'SignerRemoval');      

    });

  });

  describe('\n\tRegistration', () => {     

    it('addAddress() successfully adds contract address if none present.', async function () {

      // Register random root.
      await Register.addRoot(
        rR.root[0],
        rR.root[1],
        rR.root[2],
        rR.root[3],        
        rR.root[4],       
        rR.root[5],
        rR.root[6],
        rR.root[7]
      );

      var {logs} = await Register.addAddress(rR.devices[0][1], rR.devices[0][2], rR.devices[0][3], rR.devices[0][6], accounts[5]);

      // Verify existence of address event.
      expectEvent.inLogs(logs, 'AddressAdded');

      // Get address from Register.
      var address = await Register.getDeviceAddress.call(rR.devices[0][0]);

      assert.equal(address, accounts[5]);

    }); 

    it('addAddress() successfully adds contract address as signer.', async function () {

      // Register random root.
      await Register.addRoot(
        rR.root[0],
        rR.root[1],
        rR.root[2],
        rR.root[3],        
        rR.root[4],       
        rR.root[5],
        rR.root[6],
        rR.root[7]
      );

      var {logs} = await Register.addSigner(accounts[1]);

      // Verify existence of address addition event.
      expectEvent.inLogs(logs, 'SignerAddition');

      var {logs} = await Register.addAddress(rR.devices[0][1], rR.devices[0][2], rR.devices[0][3], rR.devices[0][6], accounts[5], {from: accounts[1]});

      // Verify existence of address event.
      expectEvent.inLogs(logs, 'AddressAdded');

      // Get address from Register.
      var address = await Register.getDeviceAddress.call(rR.devices[0][0]);

      assert.equal(address, accounts[5]);

    });       

    it('addAddress() fails if not owner or signer.', async function () {

      // Register random root.
      await Register.addRoot(
        rR.root[0],
        rR.root[1],
        rR.root[2],
        rR.root[3],        
        rR.root[4],       
        rR.root[5],
        rR.root[6],
        rR.root[7]
      );

      // Attempt to register from wrong account.
      await expectRevert(
        Register.addAddress(
          rR.devices[0][1], 
          rR.devices[0][2], 
          rR.devices[0][3], 
          rR.devices[0][6], 
          accounts[5],
          {from: accounts[1]}
        ), 'Can only be called by owner or signer.'
      );

    });

    it('getRootDetails() returns the registration information for a given root.', async function () {

      // Register random root.
      await Register.addRoot(
        rR.root[0],
        rR.root[1],
        rR.root[2],
        rR.root[3],        
        rR.root[4],       
        rR.root[5],
        rR.root[6],
        rR.root[7]
      );


      // Get minting rights before.
      var getRootDetails = await Register.getRootDetails.call(rR.root[1]);   

      // Verify, expecting extra 0's dependent on length of URI
      assert.equal(parseInt(getRootDetails[3]), parseInt(rR.root[5]));

    });

    it('getRootByIndex() returns the registered root.', async function () {

      // Register random root.
      await Register.addRoot(
        rR.root[0],
        rR.root[1],
        rR.root[2],
        rR.root[3],        
        rR.root[4],       
        rR.root[5],
        rR.root[6],
        rR.root[7]
      );


      // Get minting rights before.
      var root = await Register.getRootByIndex.call(1);

      // Verify, expecting extra 0's dependent on length of URI
      assert.equal(root, rR.root[1]);

    });     

  });

  describe('\n\tMinting', () => {

    it('mintKong() throws when called from account that is neither owner nor minter.', async function () {

      // Register random root.
      await Register.addRoot(
        rR.root[0],
        rR.root[1],
        rR.root[2],
        rR.root[3],        
        rR.root[4],       
        rR.root[5],
        rR.root[6],
        rR.root[7]
      );

      // This should throw.
      await expectRevert(Register.mintKong(rR.proofs[0], rR.root[1], rR.devices[0][0], accounts[2], {from: accounts[3]}), 'Can only be called by owner or minter.');

    });

    it('mintKong() throws when attempting to be called for non-existent Kong.', async function () {

      // Register random root.
      await Register.addRoot(
        rR.root[0],
        rR.root[1],
        rR.root[2],
        rR.root[3],        
        rR.root[4],       
        rR.root[5],
        rR.root[6],
        rR.root[7]
      );

      //console.log(`primaryPublicKeyHash of device 0 is ${rR.devices[0][1]}`)
      // This should throw.
      await expectRevert(Register.mintKong(rR.proofs[0], rR.root[1], rR.devices[0][1], accounts[0]), 'Device not found in root.');

    });


    it('mintKong() emits event.', async function () {

      // Register random root.
      await Register.addRoot(
        rR.root[0],
        rR.root[1],
        rR.root[2],
        rR.root[3],        
        rR.root[4],       
        rR.root[5],
        rR.root[6],
        rR.root[7]
      );

      var {logs} = await Register.mintKong(rR.proofs[0], rR.root[1], rR.devices[0][0], accounts[0]);

      // Verify existence of minting event.
      expectEvent.inLogs(logs, 'MintKong');

    });    

    it('mintKong() throws when called too early but executes after enough time has passed.', async function () {

      var block = await web3.eth.getBlock('latest')

      // Register random device.
      // Register random root.
      await Register.addRoot(
        rR.root[0],
        rR.root[1],
        rR.root[2],
        rR.root[3],        
        rR.root[4],       
        block.timestamp + 1000,
        rR.root[6],
        rR.root[7]
      );

      // This should throw.
      await expectRevert(Register.mintKong(rR.proofs[0], rR.root[1], rR.devices[0][0], accounts[3]), 'Cannot mint yet.');

      // Time travel to claim period.
      await timeTravel.advanceTime(1000);
      await timeTravel.advanceBlock();

      // This should not throw.
      await Register.mintKong(rR.proofs[0], rR.root[1], rR.devices[0][0], accounts[3]);

      // Verify balance.
      assert.equal(parseInt(await KongERC20.balanceOf(accounts[3])), parseInt(rR.root[2]));

    });

    it('mintKong() throws if register contract has not been registered as minter in ERC20 contract.', async function () {

        // Deploy new contracts but don't register Register contract as minter.
        var NewKongERC20 = await KongERC20Contract.new(accounts[0]);
        var NewRegister = await RegisterMerkleRootContract.new(accounts[0], await KongERC20.address);
        rR = await device.createRandomMerkleTree(7, 0xde0b6b3a7640001);

        // Register and mint.
        await NewRegister.addRoot(
          rR.root[0],
          rR.root[1],
          rR.root[2],
          rR.root[3],        
          rR.root[4],       
          rR.root[5],
          rR.root[6],
          rR.root[7]
        );
        await expectRevert(NewRegister.mintKong(rR.proofs[0], rR.root[1], rR.devices[0][0], accounts[3]), 'Can only be called by registered minter.');

    });

    it('mintKong() throws when attempting to mint again.', async function () {

      // Register random root.
      await Register.addRoot(
        rR.root[0],
        rR.root[1],
        rR.root[2],
        rR.root[3],        
        rR.root[4],       
        rR.root[5],
        rR.root[6],
        rR.root[7]
      );


      await Register.mintKong(rR.proofs[0], rR.root[1], rR.devices[0][0], accounts[0]);
      //console.log(`primaryPublicKeyHash of device 0 is ${rR.devices[0][1]}`)
      // This should throw.
      await expectRevert(Register.mintKong(rR.proofs[0], rR.root[1], rR.devices[0][0], accounts[0]), 'Already minted.');

    });

    // TODO: check mintable before and after
    it('mintKong() is no longer deviceMintable after minting.', async function () {
      

      // Register random root.
      await Register.addRoot(
        rR.root[0],
        rR.root[1],
        rR.root[2],
        rR.root[3],        
        rR.root[4],       
        rR.root[5],
        rR.root[6],
        rR.root[7]
      );

      // Verify not mintable.
      assert.equal(await Register.isDeviceMintable(rR.devices[0][0]), true);

      await Register.mintKong(rR.proofs[0], rR.root[1], rR.devices[0][0], accounts[0]);

      // Verify not mintable.
      await expectRevert(Register.isDeviceMintable(rR.devices[0][0]), 'Device already minted.');

    });


    it('mintKong() increases balance of recipient contract by minted amount.', async function () {

      // Make sure that contract is not charged beforehand.
      assert.equal(parseInt(await KongERC20.balanceOf(accounts[3])), 0);

      // Register and mint.
      await Register.addRoot(
        rR.root[0],
        rR.root[1],
        rR.root[2],
        rR.root[3],        
        rR.root[4],       
        rR.root[5],
        rR.root[6],
        rR.root[7]
      );
      await Register.mintKong(rR.proofs[0], rR.root[1], rR.devices[0][0], accounts[3]);

      // Verify balance.
      assert.equal(parseInt(await KongERC20.balanceOf(accounts[3])), parseInt(rR.root[2]));

    });

    it('Successful call of mintKong() increases _totalMinted.', async function () {

      assert.equal(parseInt(await KongERC20._totalMinted.call()), 0);

      for (i = 0; i <= 50; i++) {

        // Register random device.
        var _rD = await device.createRandomMerkleTree(1, 0x64);
        // Register and mint.
        await Register.addRoot(
          _rD.root[0],
          _rD.root[1],
          _rD.root[2],
          _rD.root[3],        
          _rD.root[4],       
          _rD.root[5],
          _rD.root[6],
          _rD.root[7]
        );
        await Register.mintKong(_rD.proofs[0], _rD.root[1], _rD.devices[0][0], accounts[3]);

        // Verify.
        assert.equal(parseInt(await KongERC20._totalMinted.call()), (1 + i) * 0x64);

      }

    });

    it('Successful call of mintKong() decreases totalMintableKong.', async function () {

      // Register random root.
      await Register.addRoot(
        rR.root[0],
        rR.root[1],
        rR.root[2],
        rR.root[3],        
        rR.root[4],       
        rR.root[5],
        rR.root[6],
        rR.root[7]
      );


      // Get minting rights before.
      var root = await Register.getRootDetails.call(rR.root[1]);
      var mintableBefore = new bigNumber(root[2]);

      // Mint Kong.
      await Register.mintKong(rR.proofs[0], rR.root[1], rR.devices[0][0], accounts[3]);

      // Get minting rights after.
      var laterRoot = await Register.getRootDetails.call(rR.root[1]);
      var mintableAfter = new bigNumber(laterRoot[2]);

      // Verify.
      assert.equal((mintableBefore.minus(rR.root[2])).isEqualTo(mintableAfter), true);

    });

    it('Successful call of mintKong() decreases totalDevices.', async function () {

      // Register random root.
      await Register.addRoot(
        rR.root[0],
        rR.root[1],
        rR.root[2],
        rR.root[3],        
        rR.root[4],       
        rR.root[5],
        rR.root[6],
        rR.root[7]
      );


      // Get minting rights before.
      // Get minting rights before.
      var root = await Register.getRootDetails.call(rR.root[1]);
      var mintableBefore = new bigNumber(root[1]);           
      // console.log(`minting rights before: ${mintableBefore}`)

      // Mint Kong.
      await Register.mintKong(rR.proofs[0], rR.root[1], rR.devices[0][0], accounts[3]);

      // Get minting rights after.
      var laterRoot = await Register.getRootDetails.call(rR.root[1]);
      var mintableAfter = new bigNumber(laterRoot[1]);

      // Verify.
      assert.equal((mintableBefore.minus(1)).isEqualTo(mintableAfter), true);

    });   

  });

});
