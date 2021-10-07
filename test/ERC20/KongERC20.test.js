// Import test helpers.
const { expectEvent, expectRevert } = require('@openzeppelin/test-helpers');

// Packages / modules.
const bigNumber                  = require('bignumber.js');
const timeTravel                 = require("../helpers/timeTravel");

// Contracts.
const KongERC20                  = artifacts.require('KongERC20Mock');

// Run tests.
contract('KongERC20', function (accounts) {

  let KongERC20Deployed;

  beforeEach(async function () {

    KongERC20Deployed = await KongERC20.new(accounts[0]);

  });

  describe('\n\tConstructor Tests', () => {

    it('Sets name.', async function () {

      assert.equal(await KongERC20Deployed.name(), 'KONG');

    });

    it('Sets symbol.', async function () {

      assert.equal(await KongERC20Deployed.symbol(), 'KONG');

    });

    it('Sets decimals.', async function () {

      assert.equal(await KongERC20Deployed.decimals(), 18);

    });

    it('Sets the timestamp of the launch.', async function () {

      var block = await web3.eth.getBlock('latest');
      var launchTimestamp = await KongERC20Deployed._launchTimestamp.call();
      assert.equal(block.timestamp, launchTimestamp);

    });

    it('Sets owner.', async function () {

      var owner = await KongERC20Deployed._owner.call();
      assert.equal(owner, accounts[0]);

    });

  });

  describe('\n\tMinting Tests', () => {

    it('addMinter() adds minter when called by owner.', async function () {

      var registrationStatusBeforeAdd = await KongERC20Deployed._minters.call(accounts[1]);
      await KongERC20Deployed.addMinter(accounts[1]);
      var registrationStatusAfterAdd = await KongERC20Deployed._minters.call(accounts[1]);

      assert.equal(registrationStatusBeforeAdd, false);
      assert.equal(registrationStatusAfterAdd, true);

    });

    it('addMinter() emits event MinterAddition event.', async function () {

      await KongERC20Deployed.addMinter(accounts[1]);

      var eventList = await KongERC20Deployed.getPastEvents('MinterAddition', {fromBlock: 0, toBlock: 'latest'});
      assert.equal(eventList.length, 1);

    });

    it('addMinter() throws when called from non-owner account.', async function () {

      await expectRevert(KongERC20Deployed.addMinter(accounts[1], {from: accounts[1]}), 'Can only be called by owner.');

    });

    it('getMintingLimit() returns correct annual limit.', async function () {

      for (i = 0; i <= 20; i++) {

        // Get current limit.
        var currentLimit = await KongERC20Deployed.getMintingLimit();

        // Calculate expected limit.
        var expectedLimit = 2 ** 25 * 10 ** 18;
        if (i > 0) {expectedLimit += 2 ** 24 * 10 ** 18;}
        if (i > 1) {expectedLimit += 2 ** 23 * 10 ** 18;}
        if (i > 2) {expectedLimit += 2 ** 22 * 10 ** 18;}

        // Verify.
        assert.equal(currentLimit, expectedLimit);

        // When this baby hits 88 miles an hour...
        await timeTravel.advanceTime(365 * 24 * 60 * 60);
        await timeTravel.advanceBlock();

      }

    });

    it('_mint() [through mockMint()] increases _totalMinted.', async function () {

      var minted = await KongERC20Deployed._totalMinted.call();
      assert.equal(minted, 0);

      // This should be possible.
      await KongERC20Deployed.mockMint(1, accounts[0]);

      // Verify.
      var minted = await KongERC20Deployed._totalMinted.call();
      assert.equal(minted, 1);

    });

    it('mint() throws when _totalMinted.add(mintedAmount) > mintingLimit.', async function () {

      for (i = 0; i <= 20; i++) {

        // Get current limit.
        var currentLimit = await KongERC20Deployed.getMintingLimit();
        var minted = await KongERC20Deployed._totalMinted.call();
        var mintableAmount = '0x' + (new bigNumber(currentLimit - minted)).toString(16);

        // This should be possible.
        await KongERC20Deployed.mockMint(mintableAmount, accounts[0]);

        // This should throw.
        await expectRevert(KongERC20Deployed.mockMint(1, accounts[0]), 'Exceeds global cap.');

        // When this baby hits 88 miles an hour...
        await timeTravel.advanceTime(360 * 24 * 60 * 60);
        await timeTravel.advanceBlock();

      }

    });

  });

  describe('\n\tOther Tests', () => {

    it('mint() throws when called directly.', async function () {

      await expectRevert(KongERC20Deployed.mint(100, accounts[1], {from: accounts[0]}), 'Can only be called by registered minter.');

    });

  });

});
