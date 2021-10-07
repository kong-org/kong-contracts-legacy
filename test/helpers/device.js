const crypto                     = require('crypto');
const { MerkleTree }             = require('../helpers/merkleTree.js');
const ethereumJSUtil             = require('ethereumjs-util');
const fs                         = require('fs');
const path                       = require('path');

// Construct the hardwareHash which consists of the primary public key, secondary public key, tertiary public key and hardware serial.
function createHardwareHash(primaryPublicKeyHash, secondaryPublicKeyHash, tertiaryPublicKeyHash, hardwareSerial) {
  var hardwareBuf = Buffer.alloc(128);
  primaryPublicKeyHash.copy(hardwareBuf, 0);
  secondaryPublicKeyHash.copy(hardwareBuf, 32);
  tertiaryPublicKeyHash.copy(hardwareBuf, 64);
  hardwareSerial.copy(hardwareBuf, 96);
  var hardwareHash = crypto.createHash('sha256').update(hardwareBuf, 'hex').digest('hex');

  return hardwareHash;
}

// Generate an individual device.
async function createRandomDevice(kongAmount) {
  // Curve and key objects.
  curve = crypto.createECDH('prime256v1');
  curve.generateKeys();
  publicKey = [
    '0x' + curve.getPublicKey('hex').slice(2, 66),
    '0x' + curve.getPublicKey('hex').slice(-64)
  ];

  var tertiaryPublicKeyHash = ethereumJSUtil.bufferToHex(ethereumJSUtil.sha256(publicKey[0] + publicKey[1].slice(2)));

  var primaryPublicKeyHash = crypto.randomBytes(32);
  var secondaryPublicKeyHash = crypto.randomBytes(32);
  var hardwareSerial = crypto.randomBytes(32);

  tertiaryPublicKeyHash = Buffer.from(tertiaryPublicKeyHash.slice(2,66), 'hex');

  var hardwareHash = createHardwareHash(primaryPublicKeyHash, secondaryPublicKeyHash, tertiaryPublicKeyHash, hardwareSerial);

  return [
    '0x' + hardwareHash.toString('hex').toLowerCase(),            // bytes32: hardwareHash    
    '0x' + primaryPublicKeyHash.toString('hex').toLowerCase(),    // bytes32: primaryPublicKeyHash
    '0x' + secondaryPublicKeyHash.toString('hex').toLowerCase(),  // bytes32: secondaryPublicKeyHash
    tertiaryPublicKeyHash,                                        // bytes32: tertiaryPublicKeyHash
    '0x' + crypto.randomBytes(32).toString('hex').toLowerCase(),  // bytes32: hardwareManufacturer
    '0x' + crypto.randomBytes(32).toString('hex').toLowerCase(),  // bytes32: hardwareModel
    '0x' + hardwareSerial.toString('hex').toLowerCase(),          // bytes32: hardwareSerial
    '0x' + crypto.randomBytes(32).toString('hex').toLowerCase(),  // bytes32: hardwareConfig      
    '0x' + kongAmount.toString(16),                               // uint256: kongAmount
    '0x' + '0'.repeat(64),                                        // uint256: mintableTime
    true,                                                         // bool:    mintable
    curve                                                         // EC pair for tertiaryKey used for minting
  ];

}

// Generate random merkle tree, array of proofs and array of devices.
async function createRandomMerkleTree(count, kongAmount) {
  var totalMintableKong = 0;
  var totalDevices = 0;
  var devices = [];
  var deviceHardwareHashes = [];
  var deviceKongAmount = kongAmount;
  var proofs = [];

  for (var i = count - 1; i >= 0; i--) {
    device = await createRandomDevice(kongAmount);
    totalMintableKong += kongAmount;
    totalDevices += 1;
    devices.push(device);
    deviceHardwareHashes.push(device[0]);
  }

  const merkleTree = new MerkleTree(deviceHardwareHashes);
  const deviceRoot = merkleTree.getHexRoot();

  // Grab the proofs.
  for (var i = 0, len = deviceHardwareHashes.length; i < len; i++) {
    proof = merkleTree.getHexProof(deviceHardwareHashes[i]);
    proofs.push(proof);
  }

  // NOTE: we are using the buffer here rather than getting the hex root as that adds 0x
  var deviceRootHash = crypto.createHash('sha256').update(merkleTree.getRoot(), 'hex').digest('hex');

  return {
    devices: devices, 
    proofs: proofs, 
    root: [
      '0x' + deviceRootHash,                                        // bytes32 deviceRootHash;
      deviceRoot,                                                   // bytes32 deviceRoot;
      '0x' + deviceKongAmount.toString(16),                         // uint256 deviceKongAmount;
      '0x' + totalDevices.toString(16),                             // uint256 totalDevices;
      '0x' + totalMintableKong.toString(16),                        // uint256 totalMintableKong; 
      '0x' + '0'.repeat(64),                                        // uint256 mintableTime;
      'Qmep63fwu7oqrxN29KhZurxgd7hiksfqexu7esppmSRj23',             // string ipfsUri;
      'Fs2TGaWzK87Jh8PyE0QGWG--YcTRWaCWm83u4bPP9sw'                 // string arwUri;
    ]
  };
}

// Generate merkle tree from list of files for a given Kong amount
async function createMerkleTreeFromFiles(
  dir, 
  kongAmount, 
  mintableTime, 
  registryAddress = '0x0000000000000000000000000000000000000000', 
  kongERC20Address = '0x177F2aCE25f81fc50F9F6e9193aDF5ac758e8098',
  chain = 'local'
) {
  var totalMintableKong = BigInt(0);
  var totalDevices = 0;
  var devices = [];
  var deviceHardwareHashes = [];
  var deviceKongAmount = BigInt(kongAmount);
  var proofs = [];
  var deviceMap = {}
  // var deviceMapBackup = {}

  // TODO - grab dir, create merkle tree, export to json? send to arweave/ipfs? save file with details for deployment to contract?
  const extFiles = fs.readdirSync(dir);

  for (extFile of extFiles) {

    // Ignore files we can't parse.
    try {
        device = await JSON.parse(fs.readFileSync(`${dir}/${extFile}`));
    } catch(e) {
        device = null;
    }
    
    if (extFile.length == 71 && device && parseInt(device.kongAmount) == parseInt(kongAmount) && parseInt(device.claimDate) == parseInt(mintableTime)) {
      // console.log(`Adding ${extFile} with ${kongAmount}.`);
      totalMintableKong += BigInt(kongAmount);
      totalDevices += 1;
      // TODO: get device contract address if present, else set to nil
      if (!device.contractAddress) {
        device.contractAddress = '0x0000000000000000000000000000000000000000';
      }
      devices.push(device);
      deviceHardwareHash = createHardwareHash(
        Buffer.from(device.primaryPublicKeyHash.slice(2,66), 'hex'),
        Buffer.from(device.secondaryPublicKeyHash.slice(2,66), 'hex'),
        Buffer.from(device.tertiaryPublicKeyHash.slice(2,66), 'hex'), 
        Buffer.from(device.hardwareSerial.slice(2,66), 'hex')
      )
      device.hardwareHash = '0x' + deviceHardwareHash 

      // console.log(device.hardwareHash)

      // Let's store the proof hash so that someone needs to have a device to prove inclusion. Note we do this with bytes, no prepended 0x.
      device.hardwareHashHash = '0x' + crypto.createHash('sha256').update(deviceHardwareHash, 'hex').digest('hex');

      // We use this array to build up the merkle root.
      deviceHardwareHashes.push(device.hardwareHash);
      // console.log(`Adding ${extFile}`)
    } else {
      // console.log(`Ignoring ${extFile}, kongAmount or mintableTime doesn't match.`);
    }
  }

  // console.log(`totalMintableKong: ${totalMintableKong.toString()}`)

  if (devices.length > 0) {
    const merkleTree = new MerkleTree(deviceHardwareHashes);
    const deviceRoot = merkleTree.getHexRoot();

    // Grab the proofs.
    for (var i = 0, len = devices.length; i < len; i++) {
      var currentDevice = devices[i]
      var proof = merkleTree.getHexProof(currentDevice.hardwareHash);

      // TODO: test.
      if (!currentDevice.count) {
        currentDevice.count = null;
      }

      // TODO: Clean up with proofs. Building this up for file export.
      deviceMap[currentDevice.hardwareHashHash] = { 
        proof: proof, primaryPublicKeyHash: 
        currentDevice.primaryPublicKeyHash, 
        secondaryPublicKeyHash: currentDevice.secondaryPublicKeyHash, 
        tertiaryPublicKeyHash: currentDevice.tertiaryPublicKeyHash,
        hardwareManufacturer: currentDevice.hardwareManufacturer,
        hardwareModel: currentDevice.hardwareModel,
        hardwareConfig: currentDevice.hardwareConfig,
        contractAddress: currentDevice.contractAddress,
        count: currentDevice.count
      }

      // Don't need anymore as we can map using primary public key hash.
      // deviceMapBackup[currentDevice.hardwareHash] = { proof: proof, contractAddress: currentDevice.contractAddress}
      proofs.push(proof);

      // NOTE: we are using the buffer here rather than getting the hex root as that adds 0x
      var deviceRootHash = crypto.createHash('sha256').update(merkleTree.getRoot(), 'hex').digest('hex');
    }

    // TODO: Clean up this vs. hash below. This is redundant, but structured how we want the JSON for file export.
    var tree = {
      'deviceRoot'        :deviceRoot,                       // bytes32 deviceRoot;
      'deviceKongAmount'  :deviceKongAmount.toString(),      // uint256 deviceKongAmount;
      'totalDevices'      :totalDevices,                     // uint256 totalDevices;
      'totalMintableKong' :totalMintableKong.toString(),     // uint256 totalMintableKong; 
      'mintableTime'      :mintableTime,                     // uint256 mintableTime;
      'registryAddress'   :registryAddress,                  // address registry contract adddress -- for older devices, we use the older kong registry.
      'kongAddress'       :kongERC20Address,                 // address kong adddress;
      'chain'             :chain 
    }

    var merkleTreeAndDevices = {
      devices: devices,
      deviceMap: deviceMap,
      tree: tree,
      deviceHardwareHashes: deviceHardwareHashes, 
      proofs: proofs, 
      root: [
        '0x' + deviceRootHash,                                        // bytes32 deviceRootHash;
        deviceRoot,                                                   // bytes32 deviceRoot;
        '0x' + deviceKongAmount.toString(16),                         // uint256 deviceKongAmount;
        '0x' + totalDevices.toString(16),                             // uint256 totalDevices;
        '0x' + totalMintableKong.toString(16),                        // uint256 totalMintableKong; 
        '0x' + mintableTime.toString(16),                             // uint256 mintableTime;
        '0x' + crypto.randomBytes(23).toString('hex').toLowerCase(),  // bytes32 ipfsUri;
        '0x' + crypto.randomBytes(23).toString('hex').toLowerCase()   // bytes32 arwUri;
      ]
    };

    return merkleTreeAndDevices;  
  
  } else {
    console.log(`No devices matching Kong amount and mintableTime, refusing to generate empty tree.`)
    process.exit();
  }

}

module.exports = {
    createRandomDevice, createRandomMerkleTree, createMerkleTreeFromFiles
}  