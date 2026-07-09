/**
 * contracts/nft-factory.js — Phase 14
 *
 * A factory contract that lets anyone deploy their own NFT collection
 * on SAYMAN without writing raw JS. Similar to OpenSea's storefront.
 *
 * Usage (SDK):
 *   client.callContract({
 *     contractAddress: NFT_FACTORY_ADDRESS,
 *     method: 'createCollection',
 *     args: { name: 'My NFTs', symbol: 'MNFT', maxSupply: 10000 }
 *   });
 */

const contract = {
  methods: {

    /**
     * Create a new NFT collection.
     * Returns the collection's deterministic address (used as its ID).
     */
    createCollection(args) {
      const { name, symbol, maxSupply, baseURI } = args;
      require(name,    'Collection name is required');
      require(symbol,  'Collection symbol is required');
      require(!maxSupply || maxSupply > 0, 'Max supply must be positive');

      const collAddr = generateAddress(`nft:${msg.sender}:${symbol}:${Date.now()}`);
      require(!getState('coll_exists_' + collAddr), 'Collection already exists');

      setState('coll_name_'     + collAddr, name);
      setState('coll_symbol_'   + collAddr, symbol);
      setState('coll_maxSupply_'+ collAddr, maxSupply || 0);  // 0 = unlimited
      setState('coll_baseURI_'  + collAddr, baseURI  || '');
      setState('coll_owner_'    + collAddr, msg.sender);
      setState('coll_supply_'   + collAddr, 0);
      setState('coll_exists_'   + collAddr, true);

      const colls = getState('all_collections') || [];
      colls.push({ address: collAddr, name, symbol, creator: msg.sender });
      setState('all_collections', colls);

      emit('CollectionCreated', { address: collAddr, name, symbol, creator: msg.sender });
      return collAddr;
    },

    /**
     * Mint an NFT in a collection.
     * Only the collection owner can mint (or configure open minting via `setOpenMint`).
     */
    mint(args) {
      const { collAddr, to, tokenURI } = args;
      require(collAddr, 'Collection address required');
      require(to,       'Recipient required');

      const owner      = getState('coll_owner_'     + collAddr);
      const openMint   = getState('coll_openMint_'  + collAddr) || false;
      require(msg.sender === owner || openMint, 'Only collection owner can mint');

      const maxSupply  = getState('coll_maxSupply_' + collAddr) || 0;
      const supply     = getState('coll_supply_'    + collAddr) || 0;
      require(maxSupply === 0 || supply < maxSupply, 'Max supply reached');

      const tokenId = supply + 1;
      setState(`nft_owner_${collAddr}_${tokenId}`,  to);
      setState(`nft_uri_${collAddr}_${tokenId}`,    tokenURI || '');
      setState('coll_supply_' + collAddr, tokenId);

      const bal = getState(`nft_balance_${collAddr}_${to}`) || 0;
      setState(`nft_balance_${collAddr}_${to}`, bal + 1);

      emit('NFTMinted', { collAddr, tokenId, to, tokenURI });
      return tokenId;
    },

    /** Transfer an NFT in a collection */
    transfer(args) {
      const { collAddr, tokenId, to } = args;
      require(collAddr, 'Collection address required');
      require(tokenId,  'Token ID required');
      require(to,       'Recipient required');

      const currentOwner = getState(`nft_owner_${collAddr}_${tokenId}`);
      const approved     = getState(`nft_approved_${collAddr}_${tokenId}`);
      require(
        currentOwner === msg.sender || approved === msg.sender,
        'Not authorized to transfer this NFT'
      );

      setState(`nft_owner_${collAddr}_${tokenId}`,    to);
      setState(`nft_approved_${collAddr}_${tokenId}`, null);

      const fromBal = getState(`nft_balance_${collAddr}_${currentOwner}`) || 0;
      setState(`nft_balance_${collAddr}_${currentOwner}`, Math.max(0, fromBal - 1));
      const toBal = getState(`nft_balance_${collAddr}_${to}`) || 0;
      setState(`nft_balance_${collAddr}_${to}`, toBal + 1);

      emit('NFTTransferred', { collAddr, tokenId, from: currentOwner, to });
      return true;
    },

    /** Approve address to transfer a token */
    approve(args) {
      const { collAddr, tokenId, approved } = args;
      const owner = getState(`nft_owner_${collAddr}_${tokenId}`);
      require(owner === msg.sender, 'Only token owner can approve');
      setState(`nft_approved_${collAddr}_${tokenId}`, approved);
      emit('NFTApproval', { collAddr, tokenId, owner, approved });
      return true;
    },

    /** Enable/disable open minting for a collection */
    setOpenMint(args) {
      const { collAddr, enabled } = args;
      const owner = getState('coll_owner_' + collAddr);
      require(msg.sender === owner, 'Only collection owner can set open minting');
      setState('coll_openMint_' + collAddr, !!enabled);
      return true;
    },

    /** Query NFT owner */
    ownerOf(args) {
      return getState(`nft_owner_${args.collAddr}_${args.tokenId}`) || null;
    },

    /** Query NFT URI */
    tokenURI(args) {
      return getState(`nft_uri_${args.collAddr}_${args.tokenId}`) || null;
    },

    /** Query balance of an address in a collection */
    balanceOf(args) {
      return getState(`nft_balance_${args.collAddr}_${args.address}`) || 0;
    },

    /** Get collection metadata */
    getCollection(args) {
      const c = args.collAddr;
      if (!getState('coll_exists_' + c)) return null;
      return {
        address:   c,
        name:      getState('coll_name_'      + c),
        symbol:    getState('coll_symbol_'    + c),
        maxSupply: getState('coll_maxSupply_' + c),
        supply:    getState('coll_supply_'    + c),
        owner:     getState('coll_owner_'     + c),
        baseURI:   getState('coll_baseURI_'   + c),
        openMint:  getState('coll_openMint_'  + c) || false,
      };
    },

    /** List all collections */
    listCollections(_args) {
      return getState('all_collections') || [];
    },
  }
};
