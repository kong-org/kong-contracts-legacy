const helper = require("./timeTravel.js");


describe("Helper Functions", () => {

    describe('\n\tTime Travel', () => {

        it("advanceBlock() should advance the blockchain by one block.", async () =>{

            let originalBlock = await web3.eth.getBlock('latest');
            let newBlock = web3.eth.getBlock('latest');

            newBlock = await helper.advanceBlock();
            assert.equal(originalBlock.number + 1, newBlock.number);

        });

        it("advanceBlock() x 3 should advance the blockchain by three blocks.", async () =>{

            let originalBlock = await web3.eth.getBlock('latest');
            let newBlock = web3.eth.getBlock('latest');

            await helper.advanceBlock();
            await helper.advanceBlock();
            newBlock = await helper.advanceBlock();
            assert.equal(originalBlock.number + 3, newBlock.number);

        });

    });

});