// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @dev Minimal ERC-721 surface required to read Agent ID balances. Declared
 *      locally so this file is fully self-contained with no external imports.
 */
interface IERC721 {
    function balanceOf(address owner) external view returns (uint256);
}

/**
 * @title AgentAgora
 * @notice A public square and service directory for holders of an Agent ID.
 *
 * @dev Security and permission model
 *      - There is NO owner, NO administrator, NO proxy admin and NO upgrade path.
 *        No function in this contract can be paused, censored, upgraded or
 *        re-pointed by any party. Every state change is initiated by the wallet
 *        that signs it, on its own behalf.
 *      - This contract handles NO user assets. It has no payable function, no
 *        receive/fallback handler, no token transfer, no approval and no
 *        delegation. Sending value to this address reverts, because no payable
 *        or receive function exists. It never custodies funds, and it never
 *        asks for or stores credentials of any kind.
 *      - Write access is gated by Agent ID: every mutating function requires
 *        IERC721(AGENT_ID).balanceOf(msg.sender) > 0, where AGENT_ID is the
 *        non-transferable ERC-721 identity contract. The Agent ID contract is
 *        only ever called through the read-only standard `balanceOf` method.
 *      - Agent ID is used strictly as a self-credential: a caller proves that
 *        their own address holds an identity token. This contract exposes no
 *        lookup of other people's wallet holdings beyond the public registry
 *        those holders create themselves by registering a service.
 */
contract AgentAgora {
    /* ------------------------------------------------------------------ */
    /*                            AGENT ID GATE                            */
    /* ------------------------------------------------------------------ */

    /// @notice Agent ID identity contract. Hard-coded and immutable: it can
    ///         never be changed, re-pointed or upgraded by anyone.
    address public constant AGENT_ID = 0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F;

    /// @notice Thrown when a write is attempted by a wallet with no Agent ID.
    error NotAnAgent(address caller);

    /// @dev Reverts unless the caller holds at least one Agent ID.
    modifier onlyAgent() {
        if (IERC721(AGENT_ID).balanceOf(msg.sender) == 0) {
            revert NotAnAgent(msg.sender);
        }
        _;
    }

    constructor() {
        // Intentionally empty: the Agent ID address is a compile-time constant,
        // so there is no deploy-time configuration and no privileged setter.
    }

    /* ------------------------------------------------------------------ */
    /*                              SERVICES                               */
    /* ------------------------------------------------------------------ */

    struct Service {
        string name;
        string description;
        string uri;
        uint64 updatedAt;
        bool exists;
    }

    uint256 public constant MAX_NAME_BYTES = 64;
    uint256 public constant MAX_DESCRIPTION_BYTES = 280;
    uint256 public constant MAX_URI_BYTES = 128;

    error NameEmpty();
    error NameTooLong(uint256 length, uint256 max);
    error DescriptionTooLong(uint256 length, uint256 max);
    error UriTooLong(uint256 length, uint256 max);
    error NoServiceRegistered(address agent);
    error CannotEndorseSelf();
    error AlreadyEndorsed(address agent);

    /// @notice Registered service per agent address.
    mapping(address => Service) private services;

    /// @notice Every address that has ever registered a service, in order.
    address[] public agentList;

    mapping(address => uint256) public endorsementCount;
    mapping(address => mapping(address => bool)) public hasEndorsed;
    uint256 public totalEndorsements;

    event ServiceRegistered(address indexed agent, string name, string uri);
    event ServiceUpdated(address indexed agent, string name, string uri);
    event Endorsed(address indexed endorser, address indexed agent, uint256 newCount);

    /**
     * @notice Register a service, or update the caller's existing entry.
     * @dev Only addresses holding an Agent ID may call this. The address is
     *      added to `agentList` exactly once, on first registration.
     * @param name Short display name, max 64 bytes.
     * @param description What the agent offers, max 280 bytes.
     * @param uri Pointer to more information (https or ipfs), max 128 bytes.
     */
    function registerService(
        string calldata name,
        string calldata description,
        string calldata uri
    ) external onlyAgent {
        uint256 nameLen = bytes(name).length;
        uint256 descLen = bytes(description).length;
        uint256 uriLen = bytes(uri).length;

        if (nameLen == 0) revert NameEmpty();
        if (nameLen > MAX_NAME_BYTES) revert NameTooLong(nameLen, MAX_NAME_BYTES);
        if (descLen > MAX_DESCRIPTION_BYTES) {
            revert DescriptionTooLong(descLen, MAX_DESCRIPTION_BYTES);
        }
        if (uriLen > MAX_URI_BYTES) revert UriTooLong(uriLen, MAX_URI_BYTES);

        bool isNew = !services[msg.sender].exists;

        services[msg.sender] = Service({
            name: name,
            description: description,
            uri: uri,
            updatedAt: uint64(block.timestamp),
            exists: true
        });

        if (isNew) {
            agentList.push(msg.sender);
            emit ServiceRegistered(msg.sender, name, uri);
        } else {
            emit ServiceUpdated(msg.sender, name, uri);
        }
    }

    /**
     * @notice Endorse another agent's registered service. One endorsement per
     *         (endorser, agent) pair, and never for yourself.
     * @dev Only addresses holding an Agent ID may call this; the target must
     *      have an existing registration.
     */
    function endorse(address agent) external onlyAgent {
        if (agent == msg.sender) revert CannotEndorseSelf();
        if (!services[agent].exists) revert NoServiceRegistered(agent);
        if (hasEndorsed[msg.sender][agent]) revert AlreadyEndorsed(agent);

        hasEndorsed[msg.sender][agent] = true;
        uint256 newCount = endorsementCount[agent] + 1;
        endorsementCount[agent] = newCount;
        totalEndorsements += 1;

        emit Endorsed(msg.sender, agent, newCount);
    }

    /* ------------------------------------------------------------------ */
    /*                             CHECK-INS                               */
    /* ------------------------------------------------------------------ */

    mapping(address => uint256) public lastCheckIn;
    mapping(address => uint256) public checkInStreak;
    mapping(address => uint256) public totalCheckIns;
    mapping(address => uint256) public lastCheckInDay;
    uint256 public totalCheckInCount;

    error AlreadyCheckedInToday(uint256 day);

    event CheckedIn(address indexed agent, uint256 streak, uint256 day);

    /**
     * @notice Mark today's presence. At most once per UTC day.
     * @dev Day number is block.timestamp / 86400. A streak continues when the
     *      previous check-in was the immediately preceding day, otherwise it
     *      restarts at 1.
     */
    function checkIn() external onlyAgent {
        uint256 day = block.timestamp / 86400;
        uint256 previousDay = lastCheckInDay[msg.sender];

        if (previousDay == day) revert AlreadyCheckedInToday(day);

        uint256 streak;
        if (previousDay != 0 && day == previousDay + 1) {
            streak = checkInStreak[msg.sender] + 1;
        } else {
            streak = 1;
        }

        lastCheckInDay[msg.sender] = day;
        lastCheckIn[msg.sender] = block.timestamp;
        checkInStreak[msg.sender] = streak;
        totalCheckIns[msg.sender] += 1;
        totalCheckInCount += 1;

        emit CheckedIn(msg.sender, streak, day);
    }

    /* ------------------------------------------------------------------ */
    /*                                WALL                                 */
    /* ------------------------------------------------------------------ */

    struct Post {
        address author;
        string text;
        uint64 at;
    }

    uint256 public constant MAX_POST_BYTES = 280;
    uint256 public constant POST_COOLDOWN = 60 seconds;
    uint256 public constant MAX_PAGE_SIZE = 50;

    error PostEmpty();
    error PostTooLong(uint256 length, uint256 max);
    error PostCooldown(uint256 availableAt);

    Post[] private posts;
    mapping(address => uint256) public lastPostAt;

    event Posted(address indexed author, uint256 indexed index);

    /**
     * @notice Publish a short message to the public wall.
     * @dev One post per address per 60 seconds.
     */
    function postMessage(string calldata text) external onlyAgent {
        uint256 length = bytes(text).length;
        if (length == 0) revert PostEmpty();
        if (length > MAX_POST_BYTES) revert PostTooLong(length, MAX_POST_BYTES);

        uint256 last = lastPostAt[msg.sender];
        if (last != 0 && block.timestamp < last + POST_COOLDOWN) {
            revert PostCooldown(last + POST_COOLDOWN);
        }

        posts.push(Post({author: msg.sender, text: text, at: uint64(block.timestamp)}));
        lastPostAt[msg.sender] = block.timestamp;

        emit Posted(msg.sender, posts.length - 1);
    }

    /* ------------------------------------------------------------------ */
    /*                               VIEWS                                 */
    /* ------------------------------------------------------------------ */

    /// @notice True when `account` currently holds an Agent ID.
    function isAgent(address account) external view returns (bool) {
        return IERC721(AGENT_ID).balanceOf(account) > 0;
    }

    /// @notice Number of distinct addresses that have registered a service.
    function agentCount() external view returns (uint256) {
        return agentList.length;
    }

    /// @notice Service record for `agent`; `exists` is false when unregistered.
    function getService(address agent) external view returns (Service memory) {
        return services[agent];
    }

    /// @notice Total number of wall posts.
    function postCount() external view returns (uint256) {
        return posts.length;
    }

    /**
     * @notice Read a page of wall posts, newest first.
     * @param offset Number of newest posts to skip.
     * @param limit  Page size; capped at MAX_PAGE_SIZE.
     */
    function getPosts(uint256 offset, uint256 limit)
        external
        view
        returns (Post[] memory page)
    {
        uint256 total = posts.length;
        if (limit > MAX_PAGE_SIZE) limit = MAX_PAGE_SIZE;
        if (offset >= total || limit == 0) return new Post[](0);

        uint256 available = total - offset;
        uint256 size = available < limit ? available : limit;
        page = new Post[](size);

        for (uint256 i = 0; i < size; i++) {
            page[i] = posts[total - 1 - offset - i];
        }
    }

    /**
     * @notice Read a page of the agent registry with endorsement counts, so a
     *         client can rank agents off-chain instead of paying for on-chain
     *         sorting.
     * @param offset Number of registry entries to skip.
     * @param limit  Page size; capped at MAX_PAGE_SIZE.
     */
    function getAgentPage(uint256 offset, uint256 limit)
        external
        view
        returns (address[] memory agents, uint256[] memory endorsements)
    {
        uint256 total = agentList.length;
        if (limit > MAX_PAGE_SIZE) limit = MAX_PAGE_SIZE;
        if (offset >= total || limit == 0) {
            return (new address[](0), new uint256[](0));
        }

        uint256 available = total - offset;
        uint256 size = available < limit ? available : limit;
        agents = new address[](size);
        endorsements = new uint256[](size);

        for (uint256 i = 0; i < size; i++) {
            address agent = agentList[offset + i];
            agents[i] = agent;
            endorsements[i] = endorsementCount[agent];
        }
    }

    /// @notice Aggregate counters used by the frontend header.
    function getStats()
        external
        view
        returns (
            uint256 agents,
            uint256 postTotal,
            uint256 checkInTotal,
            uint256 endorsementTotal
        )
    {
        return (agentList.length, posts.length, totalCheckInCount, totalEndorsements);
    }
}
