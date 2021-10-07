# KONG

## Intro.

This is a repository containing legacy KONG smart contracts and test scripts dating to late 2019. Unless noted, these contracts are solely for reference purposes and not currently in active development.

### KongERC20.

This is the Kong ERC20 contract. It is distinct from standard ERC20 implementations in that it contains additional logic allowing for minting up to an addition 1% per year of the Kong token supply via the `LockDrop` contract. It also contains additional minting rights in order to create more Kong Cash physical notes.

Two variations of Kong Cash physical notes have been deployed: those with Kong ERC20 escrowed in individual `Escrow` contracts and those with rights to mint additional Kong ERC20 tokens as granted to them through the `RegisterMerkleRoot` contract. In both cases the tokens cannot be released (or minted) until October 2022.

### Elliptic.

The initial SiLo's created by Kong (e.g. Kong Cash) use chips that only support the `P256` (or `secp256r1`) elliptic curve and not the `sepc256k1` curve native to Ethereum. The elliptic contract verifies `P256` signatures on chain.

### RegisterMerkleRoot.

This contract serves as a registry of all Kong SiLo devices to date. It attests to the nature of a given chip integrated into a Kong Cash note or SiLo tag as serves as the primary link between the physical and digital. It derives from an earlier version of the Kong registry (`0x41a81c92F019EbB05D3365A0E7b56D868eD2318e`) which included information about every chip directly in a struct.

Due to efficiency concerns and increasing transaction costs, this version of the registry instead relies upon Merkle trees stored off chain (on Arweave and IPFS). Each Merkle tree may contain serial number and public key information for hundreds or thousands of devices. Only the Merkle root and Arweave/IPFS ids are stored on chain.

### EntropyMerkle.

This contract allows Kong Cash notes to mint their face value in Kong ERC20 token after the claim date. At the createion of a given Merkle tree in `RegisterMerkleRoot`, an optional `kongAmount` may be added which in turn grants the right to mint via `EntropyMerkle`.

## Deployed Addresses.

- Kong ERC20:         `0x177F2aCE25f81fc50F9F6e9193aDF5ac758e8098`
- Elliptic:           `0xf471789937856D80e589F5996cf8b0511DDD9de4`
- RegisterMerkleRoot: `0x388b9a490f08310285f965addcfb08d693972533`
- EntropyMerkle:      `0x5d1951ae1a2df3b81049aed29276725a2a720983`

## Installation.

Install the required node packages by running

    npm install

## Testing.

This repo has been upgraded to use Hardhat for compiling and testing contracts. See [the Hardhat tutorial](https://hardhat.org/tutorial/setting-up-the-environment.html) for more information on setting up the Hardhat environment.

Once set up, you can run the Hardhat tests:

    npx hardhat test
