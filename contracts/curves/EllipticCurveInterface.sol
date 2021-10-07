pragma solidity 0.5.17;

/**
 * @title Interface for EllipticCurve contract.
 */
interface EllipticCurveInterface {

    function validateSignature(bytes32 message, uint[2] calldata rs, uint[2] calldata Q) external view returns (bool);

}
