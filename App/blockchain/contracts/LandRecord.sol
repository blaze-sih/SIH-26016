// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title LandRecord
 * @notice LRVS — Land Record Integrity Contract
 * @dev Team BLAZE | SIH26016
 *
 * Stores SHA-256 hashes of land records and documents on-chain.
 * Actual documents and database records remain off-chain (MongoDB).
 * Only hashes/events are stored on-chain for tamper-evident audit.
 */
contract LandRecord {
    address public immutable owner;

    struct HashEntry {
        bytes32 hash;
        string  requestId;
        uint256 timestamp;
        address registeredBy;
    }

    // documentHash → HashEntry
    mapping(bytes32 => HashEntry) public documentHashes;
    // landRecordHash → HashEntry
    mapping(bytes32 => HashEntry) public landRecordHashes;

    event DocumentRegistered(
        bytes32 indexed hash,
        string  requestId,
        uint256 timestamp,
        address indexed registeredBy
    );

    event LandRecordRegistered(
        bytes32 indexed hash,
        string  requestId,
        uint256 timestamp,
        address indexed registeredBy
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "LandRecord: caller is not the owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /**
     * @notice Register the SHA-256 hash of an uploaded document.
     * @param hash       SHA-256 hash of the document (as bytes32)
     * @param requestId  LRVS request ID for cross-reference
     */
    function registerDocument(bytes32 hash, string calldata requestId) external {
        require(hash != bytes32(0), "LandRecord: hash cannot be zero");
        require(bytes(requestId).length > 0, "LandRecord: requestId required");
        require(documentHashes[hash].timestamp == 0, "LandRecord: document hash already registered");

        documentHashes[hash] = HashEntry({
            hash:         hash,
            requestId:    requestId,
            timestamp:    block.timestamp,
            registeredBy: msg.sender
        });

        emit DocumentRegistered(hash, requestId, block.timestamp, msg.sender);
    }

    /**
     * @notice Register the SHA-256 hash of a verified land record snapshot.
     * @param hash       SHA-256 hash of the record snapshot
     * @param requestId  LRVS request ID
     */
    function registerLandRecord(bytes32 hash, string calldata requestId) external {
        require(hash != bytes32(0), "LandRecord: hash cannot be zero");
        require(bytes(requestId).length > 0, "LandRecord: requestId required");
        // Allow re-registration for updated snapshots (verification, possession)

        landRecordHashes[hash] = HashEntry({
            hash:         hash,
            requestId:    requestId,
            timestamp:    block.timestamp,
            registeredBy: msg.sender
        });

        emit LandRecordRegistered(hash, requestId, block.timestamp, msg.sender);
    }

    /**
     * @notice Verify whether a document hash has been registered.
     */
    function verifyDocument(bytes32 hash) external view returns (bool, string memory, uint256) {
        HashEntry memory entry = documentHashes[hash];
        return (entry.timestamp != 0, entry.requestId, entry.timestamp);
    }

    /**
     * @notice Verify whether a land record hash has been registered.
     */
    function verifyLandRecord(bytes32 hash) external view returns (bool, string memory, uint256) {
        HashEntry memory entry = landRecordHashes[hash];
        return (entry.timestamp != 0, entry.requestId, entry.timestamp);
    }
}
