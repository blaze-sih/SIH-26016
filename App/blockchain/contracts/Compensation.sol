// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Compensation
 * @notice LRVS — Compensation Integrity Contract
 * @dev Team BLAZE | SIH26016
 *
 * Records SHA-256 hashes of compensation approvals and payments on-chain.
 * Amounts are stored as uint256 (INR paise to avoid decimals).
 */
contract Compensation {
    address public immutable owner;

    struct CompensationEntry {
        bytes32 hash;
        string  requestId;
        uint256 amount;       // Amount in paise (INR * 100) or 0 if not applicable
        uint256 timestamp;
        address recordedBy;
    }

    mapping(bytes32 => CompensationEntry) public compensationHashes;

    event CompensationRecorded(
        bytes32 indexed hash,
        string  requestId,
        uint256 amount,
        uint256 timestamp,
        address indexed recordedBy
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Compensation: caller is not the owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /**
     * @notice Record a compensation event hash.
     * @param hash       SHA-256 hash of the compensation record
     * @param requestId  LRVS request ID
     * @param amount     Approved/paid amount in base units (INR)
     */
    function recordCompensation(
        bytes32 hash,
        string calldata requestId,
        uint256 amount
    ) external {
        require(hash != bytes32(0), "Compensation: hash cannot be zero");
        require(bytes(requestId).length > 0, "Compensation: requestId required");

        compensationHashes[hash] = CompensationEntry({
            hash:       hash,
            requestId:  requestId,
            amount:     amount,
            timestamp:  block.timestamp,
            recordedBy: msg.sender
        });

        emit CompensationRecorded(hash, requestId, amount, block.timestamp, msg.sender);
    }

    /**
     * @notice Verify whether a compensation hash exists.
     */
    function verifyCompensation(bytes32 hash)
        external
        view
        returns (bool, string memory, uint256, uint256)
    {
        CompensationEntry memory entry = compensationHashes[hash];
        return (entry.timestamp != 0, entry.requestId, entry.amount, entry.timestamp);
    }
}
