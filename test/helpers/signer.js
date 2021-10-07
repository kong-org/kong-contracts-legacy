const ec_pem            = require('ec-pem');
const crypto            = require('crypto');

async function signAddressAndBlockhash(curve, address) {

    // Create message to be hashed.
    var block = await web3.eth.getBlock('latest');
    var addressAndBlockHash = address + block.hash.slice(2);

    // console.log(addressAndBlockHash);
    var addressAndBlockhashBuffer = Buffer.from(addressAndBlockHash.slice(2), 'hex');

    // Create and format signature.
    var signer = crypto.createSign('SHA256');
    signer.update(addressAndBlockhashBuffer, 'hex');
    var signatureLong = signer.sign(ec_pem(curve, 'prime256v1').encodePrivateKey(), 'hex');
    var xlength = 2 * ('0x' + signatureLong.slice(6, 8));

    var signature = [
      '0x' + signatureLong.slice(8, 8 + xlength),
      '0x' + signatureLong.slice(8 + xlength + 4)
    ];

    // Ensure the signature's coordinates have the proper length.
    if (signature[0].length == 68) {signature[0] = '0x' + signature[0].slice(4)}
    if (signature[1].length == 68) {signature[1] = '0x' + signature[1].slice(4)}
    
    // console.log(block.number);
    // console.log(address);
    // console.log('0x' + curve.getPublicKey('hex').slice(2, 66));

    // Return dict with objects.
    return {
      'blockNum': block.number,
      'signature' : signature,
      'pubkeyX': '0x' + curve.getPublicKey('hex').slice(2, 66),
      'pubkeyY': '0x' + curve.getPublicKey('hex').slice(-64),
      'address': address
    }

}

module.exports = {
    signAddressAndBlockhash
}