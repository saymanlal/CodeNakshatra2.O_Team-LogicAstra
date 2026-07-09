// contracts/nft.js
// NFT (ERC-721 equivalent) Contract for SAYMAN Blockchain
// Deploy: Transaction.createContractDeploy(from, { name: 'SAYMANNFT', version: '1.0.0', code: <this file> })

const contract = {
  methods: {
    // Mint a new NFT
    mint(args) {
      const owner = getState('owner');
      require(msg.sender === owner || !owner, 'Only owner can mint');
      if (!owner) {
        setState('owner', msg.sender);
      }

      const { to, tokenId, tokenURI } = args;
      require(to, 'Recipient address is required');
      require(tokenId !== undefined && tokenId !== null, 'Token ID is required');
      require(tokenURI, 'Token URI is required');

      // Verify token doesn't already exist
      const existingOwner = getState('ownerOf_' + tokenId);
      require(!existingOwner, 'Token ID already minted');

      // Set owner of the token
      setState('ownerOf_' + tokenId, to);
      // Set metadata URI
      setState('uri_' + tokenId, tokenURI);

      // Increment recipient balance
      const balance = getState('balanceOf_' + to) || 0;
      setState('balanceOf_' + to, balance + 1);

      // Increment total supply
      const supply = (getState('totalSupply') || 0) + 1;
      setState('totalSupply', supply);

      emit('Transfer', { from: '0000000000000000000000000000000000000000', to, tokenId });
      emit('Mint', { to, tokenId, tokenURI });
      return tokenId;
    },

    // Transfer NFT ownership
    transfer(args) {
      const from = msg.sender;
      const { to, tokenId } = args;

      require(to, 'Recipient address is required');
      require(tokenId !== undefined && tokenId !== null, 'Token ID is required');

      const currentOwner = getState('ownerOf_' + tokenId);
      require(currentOwner === from, 'Only the token owner can transfer it');

      // Update owner
      setState('ownerOf_' + tokenId, to);

      // Decrement sender balance
      const balanceFrom = getState('balanceOf_' + from) || 0;
      setState('balanceOf_' + from, Math.max(0, balanceFrom - 1));

      // Increment recipient balance
      const balanceTo = getState('balanceOf_' + to) || 0;
      setState('balanceOf_' + to, balanceTo + 1);

      // Clear any approvals for this token
      setState('approved_' + tokenId, null);

      emit('Transfer', { from, to, tokenId });
      return true;
    },

    // Approve an address to transfer a token
    approve(args) {
      const { approved, tokenId } = args;
      const owner = getState('ownerOf_' + tokenId);
      require(owner === msg.sender, 'Only the token owner can approve');

      setState('approved_' + tokenId, approved);
      emit('Approval', { owner, approved, tokenId });
      return true;
    },

    // Transfer token using approval
    transferFrom(args) {
      const spender = msg.sender;
      const { from, to, tokenId } = args;

      require(to, 'Recipient address is required');
      const owner = getState('ownerOf_' + tokenId);
      require(owner === from, 'From address is not the owner');

      const approved = getState('approved_' + tokenId);
      require(approved === spender || owner === spender, 'Spender is not approved');

      // Update owner
      setState('ownerOf_' + tokenId, to);

      // Decrement sender balance
      const balanceFrom = getState('balanceOf_' + from) || 0;
      setState('balanceOf_' + from, Math.max(0, balanceFrom - 1));

      // Increment recipient balance
      const balanceTo = getState('balanceOf_' + to) || 0;
      setState('balanceOf_' + to, balanceTo + 1);

      // Clear approval
      setState('approved_' + tokenId, null);

      emit('Transfer', { from, to, tokenId });
      return true;
    },

    // Query token owner
    ownerOf(args) {
      return getState('ownerOf_' + args.tokenId) || null;
    },

    // Query balance of address
    balanceOf(args) {
      return getState('balanceOf_' + args.address) || 0;
    },

    // Query token URI
    tokenURI(args) {
      return getState('uri_' + args.tokenId) || null;
    },

    // Query total supply
    totalSupply(_args) {
      return getState('totalSupply') || 0;
    },

    // Transfer contract ownership
    setOwner(args) {
      const owner = getState('owner');
      require(!owner || msg.sender === owner, 'Not authorized');
      setState('owner', args.owner);
      emit('OwnerSet', { owner: args.owner });
      return true;
    }
  }
};
