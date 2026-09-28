// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Approval
 * @notice LRVS — Approval Integrity Contract
 * @dev Team BLAZE | SIH26016
 *
 * Records SHA-256 hashes of approval decisions on-chain.
 * Actual approval records remain in MongoDB (off-chain).
 */
contract Approval {
    address public immutable owner;

    struct ApprovalEntry {
        bytes32 hash;
        string  requestId;
        string  action;       // "APPROVED" | "REJECTED" | "FORWARDED"
        uint256 timestamp;
        address recordedBy;
    }

    mapping(bytes32 => ApprovalEntry) public approvalHashes;

    event ApprovalRecorded(
        bytes32 indexed hash,
        string  requestId,
        string  action,
        uint256 timestamp,
        address indexed recordedBy
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Approval: caller is not the owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /**
     * @notice Record an approval decision hash.
     * @param hash       SHA-256 hash of the approval record
     * @param requestId  LRVS request ID
     * @param action     The approval action: APPROVED, REJECTED, or FORWARDED
     */
    function recordApproval(
        bytes32 hash,
        string calldata requestId,
        string calldata action
    ) external {
        require(hash != bytes32(0), "Approval: hash cannot be zero");
        require(bytes(requestId).length > 0, "Approval: requestId required");
        require(bytes(action).length > 0, "Approval: action required");

        approvalHashes[hash] = ApprovalEntry({
            hash:       hash,
            requestId:  requestId,
            action:     action,
            timestamp:  block.timestamp,
            recordedBy: msg.sender
        });

        emit ApprovalRecorded(hash, requestId, action, block.timestamp, msg.sender);
    }

    /**
     * @notice Verify whether an approval hash exists.
     */
    function verifyApproval(bytes32 hash)
        external
        view
        returns (bool, string memory, string memory, uint256)
    {
        ApprovalEntry memory entry = approvalHashes[hash];
        return (entry.timestamp != 0, entry.requestId, entry.action, entry.timestamp);
    }
}
