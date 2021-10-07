// Import test helpers.
const { expectEvent, expectRevert } = require('@openzeppelin/test-helpers');

// Packages.
const bigNumber                  = require('bignumber.js');
const timeTravel                 = require('../helpers/timeTravel');

// Contracts.
const KongERC20                  = artifacts.require('KongERC20Mock');
const LockDrop                   = artifacts.require('LockDrop');
const LockETH                    = artifacts.require('LockETH');

// Run tests.
contract('LockDrop', function (accounts) {

  let ONE_DAY = 1 * 24 * 60 * 60;
  let ONE_MONTH = 30 * 24 * 60 * 60;
  let MINTING_REWARD = 2 ** 8 * 10 ** 18;
  let MINTING_PCT = 8295381 / (10 ** 10);

  let KongERC20Deployed;
  let LockDropDeployed;

  describe('\n\tLaunching', async function () {

    beforeEach(async function () {

      KongERC20Deployed = await KongERC20.new(accounts[0]);

    });

    it('beginLockDrop() updates stored address of last lock drop.', async function () {

      await KongERC20Deployed.beginLockDrop({from: accounts[1]});
      var eventList = await KongERC20Deployed.getPastEvents('LockDropCreation', {fromBlock: 0, toBlock: 'latest'});
      var lockDropAddress = eventList[eventList.length - 1].returnValues.deployedAddress;
      var storedLockDropAddress = await KongERC20Deployed._lastLockDropAddress.call();

      assert.equal(lockDropAddress, storedLockDropAddress);

    });

    it('beginLockDrop() can be called immediately after launch and whenever 30 days have passed since the last launch.', async function () {

      // Start first lockdrop.
      await KongERC20Deployed.beginLockDrop({from: accounts[1]});

      for (i = 1; i <= 200; i++) {

        // Jump 1 day to the future.
        await timeTravel.advanceTime(ONE_DAY);

        // This should only be possible if #days % 30 == 0.
        if (i % 30 == 0) {

          await KongERC20Deployed.beginLockDrop({from: accounts[1]});

        } else {

          await expectRevert(KongERC20Deployed.beginLockDrop({from: accounts[1]}), '30 day cooling period.');

        }

      }

    });

    it('beginLockDrop() emits event when called successfully.', async function () {

      // Start a new lockdrop.
      var {logs} = await KongERC20Deployed.beginLockDrop({from: accounts[1]});

      // Verify existence of event.
      expectEvent.inLogs(logs, 'LockDropCreation');

    });

    it('beginLockDrop() mints MINTING_REWARD to minter.', async function () {

      for (i = 0; i < 10; i++) {

        // Jump 30 days to the future.
        await timeTravel.advanceTime(ONE_MONTH);

        // Collect balance before minting.
        var minterBalanceBefore = new bigNumber(await KongERC20Deployed.balanceOf(accounts[1]));

        // Mint lockdrop.
        await KongERC20Deployed.beginLockDrop({from: accounts[1]});

        // Check updated balance.
        var minterBalanceAfter = new bigNumber(await KongERC20Deployed.balanceOf(accounts[1]));
        assert.equal(minterBalanceAfter.isEqualTo(minterBalanceBefore.plus(MINTING_REWARD)), true);

      }

    });

    it('beginLockDrop() mints [1.01**(1/12) - 1] % of the current total supply to the lockdrop contract.', async function () {

      for (i = 0; i < 10; i++) {

        // Jump 30 days to the future.
        await timeTravel.advanceTime(ONE_MONTH);

        // Get old supply, create lock drop, check lock drop balance.
        var oldSupply = await KongERC20Deployed.totalSupply();
        await KongERC20Deployed.beginLockDrop({from: accounts[1]});
        var eventList = await KongERC20Deployed.getPastEvents('LockDropCreation', {fromBlock: 0, toBlock: 'latest'});
        var lockDropAddress = eventList[eventList.length - 1].returnValues.deployedAddress;
        var lockDropBalance = await KongERC20Deployed.balanceOf(lockDropAddress);

        // Verify approximate accuracy.
        assert.equal(Math.round(10000 * oldSupply * MINTING_PCT / lockDropBalance), 10000);

      }

    });

  });

  describe('\n\tStaking', () => {

    beforeEach(async function () {

      KongERC20Deployed = await KongERC20.new(accounts[0]);
      await KongERC20Deployed.beginLockDrop();
      var eventList = await KongERC20Deployed.getPastEvents('LockDropCreation', {fromBlock: 0, toBlock: 'latest'});
      LockDropDeployed = await LockDrop.at(eventList[eventList.length - 1].returnValues.deployedAddress);

    });

    it('Throws when stakeETH() is called without value.', async function () {

      await expectRevert(LockDropDeployed.stakeETH(100, {from: accounts[0], value: 0}), 'Msg value = 0.');

    });

    it('Throws when stakeETH() is called multiple times by same msg.sender.', async function () {

      await LockDropDeployed.stakeETH(100, {from: accounts[0], value: 100});
      await expectRevert(LockDropDeployed.stakeETH(100, {from: accounts[0], value: 100}), 'No topping up.');

    });

    it('Throws when stakeETH() is called with invalid staking period', async function () {

      await expectRevert(LockDropDeployed.stakeETH(29, {from: accounts[0], value: 100}), 'Staking period outside of allowed range.');
      await expectRevert(LockDropDeployed.stakeETH(366, {from: accounts[1], value: 100}), 'Staking period outside of allowed range.');
      await LockDropDeployed.stakeETH(30, {from: accounts[2], value: 100});
      await LockDropDeployed.stakeETH(360, {from: accounts[3], value: 100});

    });

    it('Stops accepting contributions after end of contribution period.', async function () {

      // This should work.
      await LockDropDeployed.stakeETH(100, {from: accounts[0], value: 100});

      // Jump to 1 minute before end of contribution period.
      await timeTravel.advanceTime(30 * ONE_DAY - 60);

      // Should still work.
      await LockDropDeployed.stakeETH(100, {from: accounts[1], value: 100});

      // Jump to 1 minute after end of contribution period.
      await timeTravel.advanceTime(120);

      // Should stop working.
      await expectRevert(LockDropDeployed.stakeETH(100, {from: accounts[2], value: 100}), 'Closed for contributions.');

    });

    it('Sets lockingEnd as stakingEnd + stakingPeriod * 24 * 60 * 60 when stakeETH is called.', async function () {

      // Contribute.
      var stakingPeriod = 100;
      await LockDropDeployed.stakeETH(stakingPeriod, {from: accounts[0], value: 100});

      // Get staking end.
      var stakingEnd = parseInt(await LockDropDeployed._stakingEnd.call());

      // Get lockingEnd[msg.sender].
      var lockingEnd = parseInt(await LockDropDeployed._lockingEnds.call(accounts[0]));

      // Verify.
      assert.equal(lockingEnd, stakingEnd + stakingPeriod * ONE_DAY);

    });

    it('Sets weight to (stakingEnd + stakingPeriod * 24 * 60 * 60 - block.timestamp) * msg.value when stakeETH is called.', async function () {

      // Contribute.
      var stakingPeriod = 100;
      await LockDropDeployed.stakeETH(stakingPeriod, {from: accounts[0], value: 100});

      // Get current timestamp.
      var currentBlock        = await web3.eth.getBlock('latest');
      var currentTimestamp    = currentBlock.timestamp;

      // Get staking end.
      var stakingEnd = parseInt(await LockDropDeployed._stakingEnd.call());

      // Get weight[msg.sender].
      var weight = parseInt(await LockDropDeployed._weights.call(accounts[0]));

      // Verify.
      assert.equal(weight, (stakingEnd + stakingPeriod * ONE_DAY - currentTimestamp) * 100);

    });

    it('Emits event after successful stakeETH() call.', async function () {

      // There should be no Staked events after deployment.
      var eventList = await LockDropDeployed.getPastEvents('Staked', {fromBlock: 0, toBlock: 'latest'});
      assert.equal(eventList.length, 0);

      // Stake.
      await LockDropDeployed.stakeETH(100, {from: accounts[0], value: 100});

      // Now there should be a Staked event.
      var eventList = await LockDropDeployed.getPastEvents('Staked', {fromBlock: 0, toBlock: 'latest'});
      assert.equal(eventList.length, 1);

    });

    it('Deploys locking contract after successful stakeETH() call; Forwards msg.value; Sets owner and end of lockup.', async function () {

      stakingValue = 100;
      stakingPeriod = 100;

      // Stake.
      await LockDropDeployed.stakeETH(stakingPeriod, {from: accounts[0], value: stakingValue});

      // Get balance of LockETH.
      var eventList = await LockDropDeployed.getPastEvents('Staked', {fromBlock: 0, toBlock: 'latest'});

      // Create contract interface.
      var contractAddress = eventList[0].returnValues.lockETHAddress;
      var LockETHContract = await LockETH.at(contractAddress);

      // Verify owner of new contract.
      assert.equal(accounts[0], await LockETHContract._contractOwner.call());

      // Verify end of lockup period.
      assert.equal(
        parseInt(await LockDropDeployed._lockingEnds.call(accounts[0])),
        parseInt(await LockETHContract._endOfLockUp.call())
      );

      // Verify contract balance.
      assert.equal(stakingValue, await web3.eth.getBalance(contractAddress));

    });

  });

  describe('\n\tETH Claiming', async function () {

    beforeEach(async function () {

      KongERC20Deployed = await KongERC20.new(accounts[0]);
      await KongERC20Deployed.beginLockDrop();
      var eventList = await KongERC20Deployed.getPastEvents('LockDropCreation', {fromBlock: 0, toBlock: 'latest'});
      LockDropDeployed = await LockDrop.at(eventList[eventList.length - 1].returnValues.deployedAddress);

    });

    it('unlockETH() throws when called before lockingEnd.', async function () {

      stakingValue = 100;
      stakingPeriod = 100;

      // Stake.
      await LockDropDeployed.stakeETH(stakingPeriod, {from: accounts[0], value: stakingValue});

      // Create contract interface.
      var eventList = await LockDropDeployed.getPastEvents('Staked', {fromBlock: 0, toBlock: 'latest'});
      var LockETHContract = await LockETH.at(eventList[0].returnValues.lockETHAddress);

      // Get lockingEnd.
      var lockingEnd = parseInt(await LockETHContract._endOfLockUp.call());

      for (i = 1; i <= 140; i++) {

        // Jump 1 day into the future.
        await timeTravel.advanceTime(ONE_DAY); await timeTravel.advanceBlock();

        // Get block.
        var block = await web3.eth.getBlock('latest');

        // Note: Padding with 30 seconds in either direction to avoid timing problems at boundary.

        // It should not work if lockingEnd is in the future.
        if (block.timestamp <= lockingEnd) {

          await expectRevert(LockETHContract.unlockETH({from: accounts[0]}), 'Cannot claim yet.');

        } else if (block.timestamp > lockingEnd) {

          await LockETHContract.unlockETH({from: accounts[0]});

        }

      }

    });

    it('unlockETH() returns ETH to _contractOwner after locking period end.', async function () {

      stakingValue = 100;
      stakingPeriod = 100;

      // Stake.
      await LockDropDeployed.stakeETH(stakingPeriod, {from: accounts[0], value: stakingValue});

      // Create contract interface.
      var eventList = await LockDropDeployed.getPastEvents('Staked', {fromBlock: 0, toBlock: 'latest'});
      var LockETHContract = await LockETH.at(eventList[0].returnValues.lockETHAddress);

      // Jump 31 days into the future; Adding an extra day to make sure we are beyond the locking end.
      await timeTravel.advanceTime(ONE_MONTH + stakingPeriod * 24 * 60 * 60 + ONE_DAY);

      // Balance before.
      var balanceBefore = parseInt(await web3.eth.getBalance(accounts[1]));

      // Unlock (from account[0] so we dont have to account for txn costs).
      await LockETHContract.unlockETH({from: accounts[0]});

      // Balance after.
      var balanceAfter = parseInt(await web3.eth.getBalance(accounts[1]));

      // Verify.
      assert.equal(balanceBefore + stakingValue, balanceAfter);

    });

  });

  describe('\n\tKONG Claiming', async function () {

    beforeEach(async function () {

      KongERC20Deployed = await KongERC20.new(accounts[0]);

      // Call beginLockDrop from account[9] to make it easier to calculate proportions later.
      await KongERC20Deployed.beginLockDrop({from: accounts[9]});
      var eventList = await KongERC20Deployed.getPastEvents('LockDropCreation', {fromBlock: 0, toBlock: 'latest'});
      LockDropDeployed = await LockDrop.at(eventList[eventList.length - 1].returnValues.deployedAddress);

    });

    it('claimKong() throws when called before locking period end.', async function () {

      stakingValue = 100;
      stakingPeriod = 100;

      // Stake.
      await LockDropDeployed.stakeETH(stakingPeriod, {from: accounts[0], value: stakingValue});

      // Get lockingEnd.
      var lockingEnd = parseInt(await LockDropDeployed._lockingEnds.call(accounts[0]));

      for (i = 1; i <= 140; i++) {

        // Jump 1 day into the future.
        await timeTravel.advanceTime(ONE_DAY); await timeTravel.advanceBlock();
        await timeTravel.advanceTime(60); await timeTravel.advanceBlock();

        // Check whether timestamp exceeds lockingEnd.
        var block = await web3.eth.getBlock('latest');

        // Should not work before we reach lockingEnd.
        if (block.timestamp <= lockingEnd) {

          await expectRevert(LockDropDeployed.claimKong({from: accounts[0]}), 'Cannot claim yet.');

        } else if (block.timestamp > lockingEnd ) {

          if (parseInt(await LockDropDeployed._weights.call(accounts[0])) > 0) {

            await LockDropDeployed.claimKong({from: accounts[0]});

          } else {

            await expectRevert(LockDropDeployed.claimKong({from: accounts[0]}), 'Zero contribution.');

          }

        }

      }

    });

    it('claimKong() sends Kong to contributor in proportion to weight.', async function () {

      var precision = 1000;

      // Get lockdrop size.
      var lockDropSize = await KongERC20Deployed.balanceOf.call(LockDropDeployed.address);

      // Stake.
      await LockDropDeployed.stakeETH(100, {from: accounts[2], value: 1 * 10 ** 18});
      await LockDropDeployed.stakeETH(200, {from: accounts[3], value: 2 * 10 ** 18});
      await LockDropDeployed.stakeETH(300, {from: accounts[4], value: 3 * 10 ** 18});
      await LockDropDeployed.stakeETH(300, {from: accounts[5], value: 4 * 10 ** 18});

      // Get time for first stakes.
      var block = await web3.eth.getBlock('latest');
      var stakesTimestamp = block.timestamp;

      // Get staking end.
      var stakingEnd = parseInt(await LockDropDeployed._stakingEnd.call());

      // Calculate expected weights.
      var expectedWeight2 = 1 * 10 ** 18 * (stakingEnd + 100 * ONE_DAY - stakesTimestamp);
      var expectedWeight3 = 2 * 10 ** 18 * (stakingEnd + 200 * ONE_DAY - stakesTimestamp);
      var expectedWeight4 = 3 * 10 ** 18 * (stakingEnd + 300 * ONE_DAY - stakesTimestamp);
      var expectedWeight5 = 4 * 10 ** 18 * (stakingEnd + 300 * ONE_DAY - stakesTimestamp);
      var expectedSumOfWeights = expectedWeight2 + expectedWeight3 + expectedWeight4 + expectedWeight5;

      // Get actual weights and calculate shares.
      var contractWeight2 = parseInt(await LockDropDeployed._weights.call(accounts[2]));
      var contractWeight3 = parseInt(await LockDropDeployed._weights.call(accounts[3]));
      var contractWeight4 = parseInt(await LockDropDeployed._weights.call(accounts[4]));
      var contractWeight5 = parseInt(await LockDropDeployed._weights.call(accounts[5]));
      var contractSumOfWeights = parseInt(await LockDropDeployed._weightsSum.call());

      // Approximate verification.
      assert.equal(Math.round(precision * expectedWeight2 / contractWeight2), precision);
      assert.equal(Math.round(precision * expectedWeight3 / contractWeight3), precision);
      assert.equal(Math.round(precision * expectedWeight4 / contractWeight4), precision);
      assert.equal(Math.round(precision * expectedWeight5 / contractWeight5), precision);
      assert.equal(Math.round(precision * expectedSumOfWeights / contractSumOfWeights), precision);

      // Time travel to claim period.
      await timeTravel.advanceTime(12 * ONE_MONTH);

      // Claim.
      await LockDropDeployed.claimKong({from: accounts[2]});
      await LockDropDeployed.claimKong({from: accounts[3]});
      await LockDropDeployed.claimKong({from: accounts[4]});
      await LockDropDeployed.claimKong({from: accounts[5]});

      // Get balances.
      var balance2 = parseInt(await KongERC20Deployed.balanceOf.call(accounts[2]));
      var balance3 = parseInt(await KongERC20Deployed.balanceOf.call(accounts[3]));
      var balance4 = parseInt(await KongERC20Deployed.balanceOf.call(accounts[4]));
      var balance5 = parseInt(await KongERC20Deployed.balanceOf.call(accounts[5]));
      var sumOfBalances = balance2 + balance3 + balance4 + balance5;

      // Calculate expected balances.
      var expectedBalance2 = lockDropSize * expectedWeight2 / expectedSumOfWeights;
      var expectedBalance3 = lockDropSize * expectedWeight3 / expectedSumOfWeights;
      var expectedBalance4 = lockDropSize * expectedWeight4 / expectedSumOfWeights;
      var expectedBalance5 = lockDropSize * expectedWeight5 / expectedSumOfWeights;

      // Approximate verification.
      assert.equal(Math.round(precision * balance2 / expectedBalance2), precision);
      assert.equal(Math.round(precision * balance3 / expectedBalance3), precision);
      assert.equal(Math.round(precision * balance4 / expectedBalance4), precision);
      assert.equal(Math.round(precision * balance5 / expectedBalance5), precision);
      assert.equal(Math.round(precision * sumOfBalances / lockDropSize), precision);

    });

    it('LockDrop emits event after successful claimKong() call.', async function () {

      // Stake.
      await LockDropDeployed.stakeETH(100, {from: accounts[0], value: 100});

      // Time travel to claim period.
      await timeTravel.advanceTime(12 * ONE_MONTH);

      // Claim.
      var {logs} = await LockDropDeployed.claimKong({from: accounts[0]});

      // Verify existence of event.
      expectEvent.inLogs(logs, 'Claimed');

    });

  });

});
