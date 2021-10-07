// From https://medium.com/edgefund/time-travelling-truffle-tests-f581c1964687

advanceBlock = () => {
    return new Promise((resolve, reject) => {
        web3.currentProvider.send({
            jsonrpc: "2.0",
            method: "evm_mine",
            id: new Date().getTime()
        }, (err, result) => {
            if (err) { return reject(err); }
            const newBlock = web3.eth.getBlock('latest');

            return resolve(newBlock)
        });
    });
}

advanceTime = (seconds) => {
    return new Promise((resolve, reject) => {
        web3.currentProvider.send({
            jsonrpc: "2.0",
            method: "evm_increaseTime",
            params: [seconds],
            id: new Date().getTime()
        }, (err, result) => {
            if (err) { return reject(err); }
            const newBlock = web3.eth.getBlock('latest');

            return resolve(newBlock)
        });
    });
}


module.exports = {
    advanceBlock,
    advanceTime
}