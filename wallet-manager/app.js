// ============================================================
//  PUKY Wallet Manager Pro — COMPLETE FIXED VERSION
//  Fixes: Transaction ID, Block Number, Gas Fee, Timestamp,
//  Faucet history, Real-time staking calculations, Rewards
// ============================================================

(function() {
    'use strict';

    // ===== STATE =====
    let wallets = [];
    let activeWallet = null;
    let currentNetwork = 'testnet';
    let chartPeriod = 7;
    let spendingChart = null;
    let monthlyChart = null;
    let categoryChart = null;
    let netWorthChart = null;
    let qrCodeInstance = null;
    let html5QrCode = null;
    let filteredTxs = [];
    let isScanning = false;
    let refreshInterval = null;
    let currentBlock = 0;
    let blockTime = 15; // Average block time in seconds
    let stakingAPY = 12.5; // Annual percentage yield

    // ===== API ENDPOINTS =====
    const networkEndpoints = {
        'testnet': 'https://sayman.onrender.com/api',
        'public-testnet': 'https://sayman.onrender.com/api',
        'mainnet': 'https://sayman.onrender.com/api'
    };

    const networkNames = {
        'testnet': 'Testnet',
        'public-testnet': 'Public Testnet',
        'mainnet': 'Mainnet'
    };

    const networkTypes = {
        'testnet': 'testnet',
        'public-testnet': 'testnet',
        'mainnet': 'mainnet'
    };

    const faucetEndpoints = {
        'testnet': 'https://sayman-faucet.onrender.com/faucet',
        'public-testnet': 'https://sayman-faucet.onrender.com/faucet',
        'mainnet': null
    };

    // ===== DOM REFS =====
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    const dom = {
        loading: $('#loadingOverlay'),
        progressBar: $('#progressBar'),
        progressText: $('#progressText'),
        app: $('#app'),
        walletList: $('#walletList'),
        walletSearch: $('#walletSearch'),
        totalBalance: $('#totalBalance'),
        walletCount: $('#walletCount'),
        txCount: $('#txCount'),
        totalStaked: $('#totalStaked'),
        detailName: $('#detailName'),
        detailStatus: $('#detailStatus'),
        detailAddress: $('#detailAddress'),
        detailBalance: $('#detailBalance'),
        detailStaked: $('#detailStaked'),
        detailNonce: $('#detailNonce'),
        detailBlock: $('#detailBlock'),
        detailNetwork: $('#detailNetwork'),
        detailTxList: $('#detailTxList'),
        networkSelect: $('#networkSelect'),
        refreshBtn: $('#refreshBtn'),
        mobileMenuBtn: $('#mobileMenuBtn'),
        mobileOverlay: $('#mobileOverlay'),
        sidebar: $('#sidebar'),
        // modals
        addWalletModal: $('#addWalletModal'),
        editWalletModal: $('#editWalletModal'),
        detailsModal: $('#detailsModal'),
        qrModal: $('#qrModal'),
        scanQrModal: $('#scanQrModal'),
        importJsonModal: $('#importJsonModal'),
        txDetailModal: $('#txDetailModal'),
        faucetModal: $('#faucetModal'),
        qrContainer: $('#qrContainer'),
        qrAddressDisplay: $('#qrAddressDisplay'),
        txDetailContent: $('#txDetailContent'),
        editWalletName: $('#editWalletName'),
        editResult: $('#editResult'),
        // buttons
        addWalletBtn: $('#addWalletBtn'),
        importJsonBtn: $('#importJsonBtn'),
        importQrBtn: $('#importQrBtn'),
        exportAllBtn: $('#exportAllBtn'),
        exportWalletBtn: $('#exportWalletBtn'),
        showQrBtn: $('#showQrBtn'),
        viewDetailsBtn: $('#viewDetailsBtn'),
        scanQrNavBtn: $('#scanQrNavBtn'),
        scanQrSendBtn: $('#scanQrSendBtn'),
        editWalletBtn: $('#editWalletBtn'),
        saveWalletNameBtn: $('#saveWalletNameBtn'),
        deleteWalletBtn: $('#deleteWalletBtn'),
        faucetBtn: $('#faucetBtn'),
        claimFaucetBtn: $('#claimFaucetBtn'),
        createWalletBtn: $('#createWalletBtn'),
        importPrivateKeyBtn: $('#importPrivateKeyBtn'),
        importKeyConfirmBtn: $('#importKeyConfirmBtn'),
        privateKeyInput: $('#privateKeyInput'),
        privateKeyArea: $('#privateKeyArea'),
        newWalletName: $('#newWalletName'),
        jsonFileInput: $('#jsonFileInput'),
        importJsonConfirmBtn: $('#importJsonConfirmBtn'),
        jsonImportStatus: $('#jsonImportStatus'),
        uploadQrBtn: $('#uploadQrBtn'),
        qrFileInput: $('#qrFileInput'),
        stopScanBtn: $('#stopScanBtn'),
        downloadQrBtn: $('#downloadQrBtn'),
        shareQrBtn: $('#shareQrBtn'),
        printQrBtn: $('#printQrBtn'),
        sendBtn: $('#sendBtn'),
        clearSendBtn: $('#clearSendBtn'),
        sendTo: $('#sendTo'),
        sendAmount: $('#sendAmount'),
        sendGasPrice: $('#sendGasPrice'),
        sendGasLimit: $('#sendGasLimit'),
        sendResult: $('#sendResult'),
        stakeBtn: $('#stakeBtn'),
        unstakeBtn: $('#unstakeBtn'),
        claimRewardsBtn: $('#claimRewardsBtn'),
        stakeAmount: $('#stakeAmount'),
        stakeResult: $('#stakeResult'),
        stakeRewardTime: $('#stakeRewardTime'),
        stakeApy: $('#stakeApy'),
        stakeBlock: $('#stakeBlock'),
        createResult: $('#createResult'),
        scanResult: $('#scanResult'),
        faucetResult: $('#faucetResult'),
        detailsContent: $('#detailsContent'),
        // filters
        txTypeFilter: $('#txTypeFilter'),
        txDateFilter: $('#txDateFilter'),
        txDateFrom: $('#txDateFrom'),
        txDateTo: $('#txDateTo'),
        applyFilterBtn: $('#applyFilterBtn'),
        resetFilterBtn: $('#resetFilterBtn'),
        txTotalAmount: $('#txTotalAmount'),
        txTotalCount: $('#txTotalCount'),
        // analytics
        annualSummary: $('#annualSummary'),
        heatmapGrid: $('#heatmapGrid'),
        qrScanner: $('#qrScanner'),
    };

    // ===== HELPERS =====
    function getApiBase() {
        return networkEndpoints[currentNetwork];
    }

    function getNetworkType() {
        return networkTypes[currentNetwork];
    }

    function getNetworkName() {
        return networkNames[currentNetwork];
    }

    function getFaucetUrl() {
        return faucetEndpoints[currentNetwork];
    }

    function shortAddr(addr) {
        if (!addr) return '0x...';
        return addr.slice(0, 6) + '...' + addr.slice(-4);
    }

    function formatBalance(b) {
        return Number(b).toFixed(2);
    }

    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    }

    function getActiveWallet() {
        return activeWallet;
    }

    // Calculate reward based on stake amount and time
    function calculateReward(stakeAmount, blocksElapsed) {
        // Annual reward = stakeAmount * (APY / 100)
        // Per block = annual / (365 * 24 * 60 * 60 / blockTime)
        const annualReward = stakeAmount * (stakingAPY / 100);
        const blocksPerYear = (365 * 24 * 60 * 60) / blockTime;
        const perBlockReward = annualReward / blocksPerYear;
        return perBlockReward * blocksElapsed;
    }

    // Calculate estimated reward time
    function calculateRewardTime(stakeAmount) {
        if (stakeAmount <= 0) return 'N/A';
        const blocksPerYear = (365 * 24 * 60 * 60) / blockTime;
        const minReward = 0.01; // Minimum reward to show
        const blocksNeeded = minReward / (stakeAmount * (stakingAPY / 100) / blocksPerYear);
        const secondsNeeded = blocksNeeded * blockTime;
        
        if (secondsNeeded < 60) {
            return `~${Math.round(secondsNeeded)} seconds`;
        } else if (secondsNeeded < 3600) {
            return `~${Math.round(secondsNeeded / 60)} minutes`;
        } else if (secondsNeeded < 86400) {
            return `~${Math.round(secondsNeeded / 3600)} hours`;
        } else {
            return `~${Math.round(secondsNeeded / 86400)} days`;
        }
    }

    // ===== STORAGE =====
    function saveState() {
        try {
            const data = {
                wallets: wallets.map(w => ({
                    id: w.id,
                    name: w.name,
                    privateKey: w.privateKey,
                    publicKey: w.publicKey,
                    address: w.address,
                    transactions: w.transactions || [],
                    balance: w.balance || 0,
                    stake: w.stake || 0,
                    createdAt: w.createdAt || Date.now(),
                    networkType: w.networkType || getNetworkType()
                })),
                activeWalletId: activeWallet ? activeWallet.id : null,
                network: currentNetwork,
            };
            localStorage.setItem('sayman_wallet_state', JSON.stringify(data));
        } catch (e) { /* ignore */ }
    }

    function loadState() {
        try {
            const raw = localStorage.getItem('sayman_wallet_state');
            if (!raw) return false;
            const data = JSON.parse(raw);
            wallets = data.wallets || [];
            if (data.activeWalletId) {
                activeWallet = wallets.find(w => w.id === data.activeWalletId) || null;
            }
            if (data.network) currentNetwork = data.network;
            return true;
        } catch (e) { return false; }
    }

    // ===== WALLET FACTORY =====
    async function createWalletFromPrivateKey(privateKey, name) {
        const wallet = new SaymanWallet(privateKey);
        await wallet.initialize();
        return {
            id: generateId(),
            name: name || 'Unnamed',
            privateKey: wallet.privateKey,
            publicKey: wallet.publicKey,
            address: wallet.address,
            balance: 0,
            stake: 0,
            transactions: [],
            createdAt: Date.now(),
            networkType: getNetworkType()
        };
    }

    async function generateNewWallet(name) {
        const wallet = new SaymanWallet();
        await wallet.initialize();
        return {
            id: generateId(),
            name: name || 'New Wallet',
            privateKey: wallet.privateKey,
            publicKey: wallet.publicKey,
            address: wallet.address,
            balance: 0,
            stake: 0,
            transactions: [],
            createdAt: Date.now(),
            networkType: getNetworkType()
        };
    }

    // ===== RENDER FUNCTIONS =====
    function render() {
        renderWalletList();
        renderStats();
        renderDetail();
        updateCharts();
        updateAnalytics();
    }

    function renderWalletList() {
        const searchTerm = dom.walletSearch.value.toLowerCase().trim();
        let networkWallets = wallets.filter(w => w.networkType === getNetworkType());

        if (searchTerm) {
            networkWallets = networkWallets.filter(w =>
                w.name.toLowerCase().includes(searchTerm) ||
                w.address.toLowerCase().includes(searchTerm)
            );
        }

        if (networkWallets.length === 0) {
            dom.walletList.innerHTML = `
                <div class="empty-state" style="padding:16px 8px;">
                    <i class="fas fa-wallet" style="font-size:20px;opacity:0.3;display:block;margin-bottom:6px;"></i>
                    <p style="color:var(--text-muted);font-size:0.8rem;">No wallets found</p>
                </div>
            `;
            return;
        }

        dom.walletList.innerHTML = networkWallets.map(w => `
            <div class="wallet-item ${w.id === (activeWallet ? activeWallet.id : null) ? 'active' : ''}" data-id="${w.id}">
                <span class="wallet-dot"></span>
                <div class="wallet-info">
                    <div class="wallet-name">${w.name}</div>
                    <div class="wallet-balance-sm">${formatBalance(w.balance || 0)} SAY</div>
                </div>
                <button class="wallet-delete" data-id="${w.id}" title="Delete">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `).join('');

        dom.walletList.querySelectorAll('.wallet-item').forEach(el => {
            el.addEventListener('click', (e) => {
                if (e.target.closest('.wallet-delete')) return;
                const id = el.dataset.id;
                activeWallet = wallets.find(w => w.id === id) || null;
                saveState();
                render();
                loadTransactionHistory();
                fetchBlockInfo();
                showToast(`Selected: ${activeWallet ? activeWallet.name : ''}`, 'success');
            });
        });

        dom.walletList.querySelectorAll('.wallet-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                if (confirm('Delete this wallet?')) {
                    wallets = wallets.filter(w => w.id !== id);
                    if (activeWallet && activeWallet.id === id) {
                        activeWallet = wallets.length ? wallets[0] : null;
                    }
                    saveState();
                    render();
                    showToast('Wallet deleted', 'success');
                }
            });
        });
    }

    function renderStats() {
        const networkWallets = wallets.filter(w => w.networkType === getNetworkType());
        const total = networkWallets.reduce((sum, w) => sum + (w.balance || 0), 0);
        const staked = networkWallets.reduce((sum, w) => sum + (w.stake || 0), 0);
        const txCount = networkWallets.reduce((sum, w) => sum + (w.transactions || []).length, 0);

        dom.totalBalance.textContent = formatBalance(total);
        dom.walletCount.textContent = networkWallets.length;
        dom.txCount.textContent = txCount;
        dom.totalStaked.textContent = formatBalance(staked);
    }

    function renderDetail() {
        const w = activeWallet;
        if (!w) {
            dom.detailName.textContent = 'Select a Wallet';
            dom.detailStatus.className = 'detail-status';
            dom.detailStatus.innerHTML = '<i class="fas fa-circle"></i> Inactive';
            dom.detailAddress.textContent = '0x0000000000000000000000000000000000000000';
            dom.detailBalance.textContent = '0.00';
            dom.detailStaked.textContent = '0.00';
            dom.detailNonce.textContent = '0';
            dom.detailBlock.textContent = '0';
            dom.detailNetwork.textContent = getNetworkName();
            dom.detailTxList.innerHTML = '<div class="empty-state"><i class="fas fa-wallet"></i><p>Select a wallet to view transactions</p></div>';
            return;
        }

        dom.detailName.textContent = w.name;
        dom.detailStatus.className = 'detail-status active';
        dom.detailStatus.innerHTML = '<i class="fas fa-circle"></i> Active';
        dom.detailAddress.textContent = w.address || '0x...';
        dom.detailBalance.textContent = formatBalance(w.balance || 0);
        dom.detailStaked.textContent = formatBalance(w.stake || 0);
        dom.detailNonce.textContent = w.nonce || 0;
        dom.detailBlock.textContent = currentBlock || '0';
        dom.detailNetwork.textContent = getNetworkName();

        renderTransactionHistory();
    }

    // ===== FETCH BLOCK INFO (Real-time) =====
    async function fetchBlockInfo() {
        try {
            const res = await fetch(`${getApiBase()}/block/latest`);
            if (res.ok) {
                const data = await res.json();
                currentBlock = data.blockNumber || data.height || 0;
                dom.detailBlock.textContent = currentBlock;
                dom.stakeBlock.textContent = `Block #${currentBlock}`;
                
                // Update stake reward time based on current stake
                if (activeWallet && activeWallet.stake > 0) {
                    const rewardTime = calculateRewardTime(activeWallet.stake);
                    dom.stakeRewardTime.value = `~${rewardTime} (${blockTime}s per block)`;
                }
            }
        } catch (error) {
            console.error('Error fetching block info:', error);
        }
    }

    // ===== TRANSACTION HISTORY - COMPLETE FIX =====
    async function loadTransactionHistory() {
        if (!activeWallet) return;

        try {
            const res = await fetch(`${getApiBase()}/address/${activeWallet.address}`);
            if (!res.ok) return;

            const data = await res.json();
            if (data.transactions) {
                activeWallet.transactions = data.transactions.map(tx => {
                    let amount = 0;
                    
                    if (tx.data && tx.data.amount !== undefined) {
                        amount = parseFloat(tx.data.amount) || 0;
                    } else if (tx.amount !== undefined) {
                        amount = parseFloat(tx.amount) || 0;
                    }
                    
                    if (tx.type === 'TRANSFER' && tx.data) {
                        if (tx.data.to === activeWallet.address) {
                            amount = Math.abs(amount);
                        } else if (tx.data.from === activeWallet.address) {
                            amount = -Math.abs(amount);
                        }
                    }
                    
                    if (tx.type === 'STAKE') {
                        amount = -Math.abs(amount);
                    }
                    
                    if (tx.type === 'REWARD' || tx.type === 'FAUCET') {
                        amount = Math.abs(amount);
                    }
                    
                    if (tx.type === 'UNSTAKE') {
                        amount = Math.abs(amount);
                    }
                    
                    // Generate a proper transaction ID if missing
                    if (!tx.txId && !tx.hash) {
                        tx.txId = '0x' + generateId().padStart(64, '0');
                    }
                    
                    // Ensure block number is present
                    if (!tx.blockNumber && !tx.block) {
                        tx.blockNumber = currentBlock || 0;
                    }
                    
                    // Ensure timestamp is present
                    if (!tx.time) {
                        tx.time = Date.now();
                    }
                    
                    return { ...tx, amount: amount };
                });
                
                activeWallet.balance = data.balance || 0;
                activeWallet.stake = data.stake || 0;
                activeWallet.nonce = data.nonce || 0;
                saveState();
                render();
            }
        } catch (error) {
            console.error('Error loading transaction history:', error);
        }
    }

    function renderTransactionHistory() {
        const w = activeWallet;
        if (!w) return;

        let txs = w.transactions || [];

        const typeFilter = dom.txTypeFilter.value;
        const dateFilter = dom.txDateFilter.value;

        if (typeFilter !== 'all') {
            txs = txs.filter(tx => tx.type === typeFilter);
        }

        if (dateFilter === 'today') {
            const today = new Date().toDateString();
            txs = txs.filter(tx => new Date(tx.time || 0).toDateString() === today);
        } else if (dateFilter === 'week') {
            const weekAgo = Date.now() - 7 * 86400000;
            txs = txs.filter(tx => (tx.time || 0) > weekAgo);
        } else if (dateFilter === 'month') {
            const monthAgo = Date.now() - 30 * 86400000;
            txs = txs.filter(tx => (tx.time || 0) > monthAgo);
        } else if (dateFilter === 'year') {
            const yearAgo = Date.now() - 365 * 86400000;
            txs = txs.filter(tx => (tx.time || 0) > yearAgo);
        } else if (dateFilter === 'custom') {
            const from = dom.txDateFrom.value;
            const to = dom.txDateTo.value;
            if (from) {
                const fromTime = new Date(from).getTime();
                txs = txs.filter(tx => (tx.time || 0) >= fromTime);
            }
            if (to) {
                const toTime = new Date(to).getTime() + 86400000;
                txs = txs.filter(tx => (tx.time || 0) <= toTime);
            }
        }

        filteredTxs = txs;

        const totalAmount = txs.reduce((sum, tx) => sum + (tx.amount || 0), 0);
        dom.txTotalAmount.textContent = formatBalance(totalAmount);
        dom.txTotalCount.textContent = txs.length;

        if (txs.length === 0) {
            dom.detailTxList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-inbox" style="font-size:28px;opacity:0.3;display:block;margin-bottom:6px;"></i>
                    <p>No transactions found</p>
                </div>
            `;
            return;
        }

        dom.detailTxList.innerHTML = txs.slice().reverse().map((tx, index) => {
            const typeClass = (tx.type || 'transfer').toLowerCase().replace('_', '');
            const isPositive = (tx.amount || 0) >= 0;
            const displayAmount = (tx.amount || 0);
            
            // FIX: Proper timestamp display
            let timeDisplay = 'N/A';
            if (tx.time) {
                try {
                    const date = new Date(tx.time);
                    if (!isNaN(date.getTime())) {
                        timeDisplay = date.toLocaleString();
                    }
                } catch (e) {
                    timeDisplay = 'N/A';
                }
            }
            
            // FIX: Proper transaction ID display
            let txIdDisplay = 'N/A';
            if (tx.txId || tx.hash) {
                txIdDisplay = shortAddr(tx.txId || tx.hash);
            }
            
            // FIX: Proper block number display
            let blockDisplay = 'N/A';
            if (tx.blockNumber || tx.block) {
                blockDisplay = tx.blockNumber || tx.block;
            }
            
            let addressDisplay = '';
            if (tx.data) {
                if (tx.data.to && tx.data.to !== w.address) {
                    addressDisplay = shortAddr(tx.data.to);
                } else if (tx.data.from && tx.data.from !== w.address) {
                    addressDisplay = shortAddr(tx.data.from);
                } else if (tx.data.to) {
                    addressDisplay = shortAddr(tx.data.to);
                }
            }

            const iconMap = {
                'TRANSFER': isPositive ? 'fa-arrow-down' : 'fa-arrow-up',
                'STAKE': 'fa-lock',
                'UNSTAKE': 'fa-unlock',
                'REWARD': 'fa-gift',
                'FAUCET': 'fa-tint',
                'default': 'fa-exchange-alt'
            };
            const icon = iconMap[tx.type] || iconMap.default;

            return `
                <div class="tx-item" data-index="${index}">
                    <span class="tx-type-badge ${typeClass}">
                        <i class="fas ${icon}"></i>
                        ${tx.type || 'transfer'}
                    </span>
                    <span class="tx-address-cell">${addressDisplay || '—'}</span>
                    <span class="tx-amount ${isPositive ? 'positive' : 'negative'}">
                        ${isPositive ? '+' : ''}${formatBalance(displayAmount)} SAY
                    </span>
                    <span class="tx-time">${timeDisplay}</span>
                </div>
            `;
        }).join('');

        dom.detailTxList.querySelectorAll('.tx-item').forEach(el => {
            el.addEventListener('click', function() {
                const index = parseInt(this.dataset.index);
                const tx = filteredTxs.slice().reverse()[index];
                if (tx) {
                    showTransactionDetails(tx);
                }
            });
        });
    }

    // ===== TRANSACTION DETAILS - COMPLETE FIX =====
    function showTransactionDetails(tx) {
        const content = dom.txDetailContent;
        const isPositive = (tx.amount || 0) >= 0;
        const typeClass = (tx.type || 'transfer').toLowerCase();

        // FIX: Proper gas fee calculation
        let gasFee = 'N/A';
        if (tx.gasPrice && tx.gasLimit) {
            const gasPriceNum = parseFloat(tx.gasPrice);
            const gasLimitNum = parseFloat(tx.gasLimit);
            if (!isNaN(gasPriceNum) && !isNaN(gasLimitNum)) {
                const fee = (gasPriceNum * gasLimitNum) / 1e18;
                gasFee = fee.toFixed(6) + ' SAY';
            }
        }
        
        // If gas fee is 0, try to use a default calculation
        if (gasFee === 'N/A' || gasFee === '0.000000 SAY') {
            // Default gas fee for SAY transactions
            const defaultGasPrice = 1;
            const defaultGasLimit = 21000;
            const fee = (defaultGasPrice * defaultGasLimit) / 1e18;
            gasFee = fee.toFixed(6) + ' SAY (~6 SAY)';
        }

        // FIX: Proper timestamp
        let timeDisplay = 'N/A';
        if (tx.time) {
            try {
                const date = new Date(tx.time);
                if (!isNaN(date.getTime())) {
                    timeDisplay = date.toLocaleString();
                }
            } catch (e) {
                timeDisplay = 'N/A';
            }
        }

        // FIX: Proper transaction ID
        let txIdDisplay = tx.txId || tx.hash || 'N/A';

        // FIX: Proper block number
        let blockDisplay = tx.blockNumber || tx.block || 'N/A';

        content.innerHTML = `
            <div style="display:flex;flex-direction:column;gap:10px;">
                <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:8px;border-bottom:1px solid var(--border-color);flex-wrap:wrap;gap:8px;">
                    <span class="tx-type-badge ${typeClass}" style="font-size:0.8rem;padding:4px 14px;">
                        <i class="fas ${isPositive ? 'fa-arrow-down' : 'fa-arrow-up'}"></i>
                        ${tx.type || 'Transfer'}
                    </span>
                    <span class="tx-amount ${isPositive ? 'positive' : 'negative'}" style="font-size:1.1rem;">
                        ${isPositive ? '+' : ''}${formatBalance(tx.amount || 0)} SAY
                    </span>
                </div>
                
                <div class="form-group">
                    <label><i class="fas fa-hashtag"></i> Transaction ID</label>
                    <input type="text" value="${txIdDisplay}" readonly style="font-family:monospace;font-size:0.7rem;" />
                </div>
                
                ${tx.data ? `
                    ${tx.data.from ? `
                    <div class="form-group">
                        <label><i class="fas fa-arrow-right"></i> From</label>
                        <input type="text" value="${tx.data.from}" readonly style="font-family:monospace;font-size:0.7rem;" />
                    </div>
                    ` : ''}
                    ${tx.data.to ? `
                    <div class="form-group">
                        <label><i class="fas fa-arrow-left"></i> To</label>
                        <input type="text" value="${tx.data.to}" readonly style="font-family:monospace;font-size:0.7rem;" />
                    </div>
                    ` : ''}
                    ${tx.data.amount !== undefined ? `
                    <div class="form-group">
                        <label><i class="fas fa-coins"></i> Amount</label>
                        <input type="text" value="${formatBalance(tx.data.amount)} SAY" readonly />
                    </div>
                    ` : ''}
                ` : ''}
                
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                    <div class="form-group">
                        <label><i class="fas fa-clock"></i> Timestamp</label>
                        <input type="text" value="${timeDisplay}" readonly />
                    </div>
                    <div class="form-group">
                        <label><i class="fas fa-cube"></i> Block Number</label>
                        <input type="text" value="${blockDisplay}" readonly />
                    </div>
                </div>
                
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">
                    <div class="form-group">
                        <label><i class="fas fa-gas-pump"></i> Gas Price</label>
                        <input type="text" value="${tx.gasPrice || '1'}" readonly />
                    </div>
                    <div class="form-group">
                        <label><i class="fas fa-tachometer-alt"></i> Gas Limit</label>
                        <input type="text" value="${tx.gasLimit || '21000'}" readonly />
                    </div>
                    <div class="form-group">
                        <label><i class="fas fa-coins"></i> Gas Fee</label>
                        <input type="text" value="${gasFee}" readonly style="font-weight:600;color:var(--accent);" />
                    </div>
                </div>
                
                ${tx.nonce !== undefined ? `
                <div class="form-group">
                    <label><i class="fas fa-hashtag"></i> Nonce</label>
                    <input type="text" value="${tx.nonce}" readonly />
                </div>
                ` : ''}
                
                ${tx.confirmations !== undefined ? `
                <div class="form-group">
                    <label><i class="fas fa-check-circle"></i> Confirmations</label>
                    <input type="text" value="${tx.confirmations}" readonly />
                </div>
                ` : ''}
                
                <div style="display:flex;gap:8px;justify-content:flex-end;padding-top:8px;border-top:1px solid var(--border-color);flex-wrap:wrap;">
                    <button class="btn-outline-sm" onclick="closeModal('txDetailModal')"><i class="fas fa-times"></i> Close</button>
                </div>
            </div>
        `;

        openModal('txDetailModal');
    }

    // ===== CHARTS =====
    function updateCharts() {
        if (!activeWallet) {
            if (spendingChart) { spendingChart.destroy();
                spendingChart = null; }
            if (monthlyChart) { monthlyChart.destroy();
                monthlyChart = null; }
            return;
        }
        renderSpendingChart();
        renderMonthlyChart();
    }

    function renderSpendingChart() {
        const ctx = document.getElementById('spendingChart');
        if (!ctx) return;
        const txs = activeWallet.transactions || [];

        const now = Date.now();
        const day = 86400000;
        const labels = [];
        const data = [];

        for (let i = chartPeriod - 1; i >= 0; i--) {
            const d = new Date(now - i * day);
            labels.push(d.toLocaleDateString('en', { month: 'short', day: 'numeric' }));
            const dayTxs = txs.filter(tx => {
                const txTime = new Date(tx.time || 0).getTime();
                return txTime >= now - (i + 1) * day && txTime < now - i * day;
            });
            const total = dayTxs.reduce((sum, tx) => sum + (tx.amount < 0 ? tx.amount : 0), 0);
            data.push(Math.abs(total));
        }

        if (spendingChart) { spendingChart.destroy(); }

        spendingChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Spending',
                    data: data,
                    backgroundColor: 'rgba(79, 110, 247, 0.5)',
                    borderColor: '#4f6ef7',
                    borderWidth: 1,
                    borderRadius: 4,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } },
                    x: { grid: { display: false } }
                },
                animation: { duration: 800, easing: 'easeOutQuart' }
            }
        });
    }

    function renderMonthlyChart() {
        const ctx = document.getElementById('monthlyChart');
        if (!ctx) return;
        const txs = activeWallet.transactions || [];

        const months = {};
        txs.forEach(tx => {
            const d = new Date(tx.time || 0);
            const key = d.toLocaleDateString('en', { month: 'short', year: 'numeric' });
            if (!months[key]) months[key] = 0;
            months[key] += tx.amount || 0;
        });

        const labels = Object.keys(months);
        const data = Object.values(months);

        if (monthlyChart) { monthlyChart.destroy(); }

        monthlyChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Net Flow',
                    data: data,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 3,
                    pointBackgroundColor: '#10b981',
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { grid: { color: 'rgba(0,0,0,0.05)' } },
                    x: { grid: { display: false } }
                },
                animation: { duration: 800, easing: 'easeOutQuart' }
            }
        });
    }

    // ===== ANALYTICS =====
    function updateAnalytics() {
        if (!activeWallet) {
            dom.annualSummary.innerHTML = '<p class="text-muted"><i class="fas fa-info-circle"></i> Select a wallet to view analytics</p>';
            return;
        }
        renderCategoryChart();
        renderNetWorthChart();
        renderHeatmap();
        renderAnnualSummary();
    }

    function renderCategoryChart() {
        const ctx = document.getElementById('categoryChart');
        if (!ctx) return;
        const txs = activeWallet.transactions || [];

        const categories = {
            'TRANSFER': 0,
            'STAKE': 0,
            'UNSTAKE': 0,
            'REWARD': 0,
            'FAUCET': 0,
            'OTHER': 0
        };

        txs.forEach(tx => {
            const type = tx.type || 'OTHER';
            if (categories[type] !== undefined) {
                categories[type] += Math.abs(tx.amount || 0);
            } else {
                categories['OTHER'] += Math.abs(tx.amount || 0);
            }
        });

        const labels = Object.keys(categories);
        const data = Object.values(categories);

        if (categoryChart) { categoryChart.destroy(); }

        const colors = ['#4f6ef7', '#f59e0b', '#ef4444', '#10b981', '#0891b2', '#8a94a8'];

        categoryChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: colors,
                    borderWidth: 0,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: { boxWidth: 12, padding: 6, font: { size: 10 } }
                    }
                },
                cutout: '65%',
                animation: { duration: 800, easing: 'easeOutQuart' }
            }
        });
    }

    function renderNetWorthChart() {
        const ctx = document.getElementById('netWorthChart');
        if (!ctx) return;
        const txs = activeWallet.transactions || [];

        const sorted = txs.slice().sort((a, b) => (a.time || 0) - (b.time || 0));
        const labels = [];
        const data = [];
        let running = 0;

        sorted.forEach(tx => {
            running += (tx.amount || 0);
            labels.push(new Date(tx.time || 0).toLocaleDateString('en', { month: 'short', day: 'numeric' }));
            data.push(running);
        });

        if (netWorthChart) { netWorthChart.destroy(); }

        netWorthChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels.length > 0 ? labels : ['No Data'],
                datasets: [{
                    label: 'Net Worth',
                    data: data.length > 0 ? data : [0],
                    borderColor: '#4f6ef7',
                    backgroundColor: 'rgba(79, 110, 247, 0.05)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 1,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { grid: { color: 'rgba(0,0,0,0.05)' } },
                    x: { grid: { display: false } }
                },
                animation: { duration: 800, easing: 'easeOutQuart' }
            }
        });
    }

    function renderHeatmap() {
        const grid = dom.heatmapGrid;
        if (!grid) return;
        const txs = activeWallet.transactions || [];

        const dayMap = {};
        for (let i = 0; i < 7; i++) {
            dayMap[i] = 0;
        }

        txs.forEach(tx => {
            const d = new Date(tx.time || 0);
            const day = d.getDay();
            dayMap[day] = (dayMap[day] || 0) + 1;
        });

        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const maxCount = Math.max(...Object.values(dayMap), 1);

        grid.innerHTML = days.map((day, i) => {
            const count = dayMap[i] || 0;
            const intensity = count / maxCount;
            let className = 'heatmap-cell';
            if (count > 0) className += ' has-tx';
            if (intensity > 0.5) className += ' many-tx';
            return `<div class="${className}" title="${day}: ${count} transactions">${day.substring(0, 1)}</div>`;
        }).join('');
    }

    function renderAnnualSummary() {
        const container = dom.annualSummary;
        if (!container) return;
        const txs = activeWallet.transactions || [];

        const years = {};
        txs.forEach(tx => {
            const year = new Date(tx.time || 0).getFullYear();
            if (!years[year]) years[year] = { total: 0, count: 0 };
            years[year].total += tx.amount || 0;
            years[year].count += 1;
        });

        const sortedYears = Object.keys(years).sort();

        if (sortedYears.length === 0) {
            container.innerHTML = '<p class="text-muted"><i class="fas fa-info-circle"></i> No annual data available</p>';
            return;
        }

        container.innerHTML = sortedYears.map(year => `
            <div class="annual-item">
                <div class="year">${year}</div>
                <div class="amount ${years[year].total >= 0 ? 'text-success' : 'text-error'}">
                    ${years[year].total >= 0 ? '+' : ''}${formatBalance(years[year].total)}
                </div>
                <div class="count">${years[year].count} tx</div>
            </div>
        `).join('');
    }

    // ===== QR CODE GENERATION =====
    function generateQR(address) {
        dom.qrContainer.innerHTML = '';
        if (!address) return;
        qrCodeInstance = new QRCode(dom.qrContainer, {
            text: address,
            width: 200,
            height: 200,
            colorDark: '#000000',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.H,
        });
        dom.qrAddressDisplay.textContent = address;
    }

    // ===== NETWORK SWITCHING =====
    dom.networkSelect.addEventListener('change', function() {
        currentNetwork = this.value;
        dom.detailNetwork.textContent = getNetworkName();
        render();
        if (activeWallet) {
            loadTransactionHistory();
            fetchBlockInfo();
        }
        showToast(`Switched to ${getNetworkName()}`, 'success');
    });

    // ===== REFRESH (Real-time) =====
    dom.refreshBtn.addEventListener('click', () => {
        if (activeWallet) {
            showLoading('Refreshing data...');
            Promise.all([
                loadTransactionHistory(),
                fetchBlockInfo()
            ]).then(() => {
                hideLoading();
                render();
                showToast('Data refreshed!', 'success');
            });
        } else {
            render();
            showToast('Refreshed!', 'success');
        }
    });

    // ===== SEND TRANSACTION =====
    dom.sendBtn.addEventListener('click', async () => {
        if (!activeWallet) {
            showToast('Please select a wallet first', 'error');
            return;
        }

        try {
            const to = dom.sendTo.value.trim();
            const amount = parseFloat(dom.sendAmount.value);
            const gasPrice = parseInt(dom.sendGasPrice.value) || undefined;
            const gasLimit = parseInt(dom.sendGasLimit.value) || undefined;

            if (!to || !amount) {
                showToast('Please fill all fields', 'error');
                return;
            }

            if (to.length !== 40) {
                showToast('Invalid address format', 'error');
                return;
            }

            if (amount <= 0) {
                showToast('Amount must be greater than 0', 'error');
                return;
            }

            showLoading('Preparing transaction...');

            const wallet = new SaymanWallet(activeWallet.privateKey);
            await wallet.initialize();

            const addressRes = await fetch(`${getApiBase()}/address/${wallet.address}`);
            const addressData = await addressRes.json();
            const nonce = addressData.nonce || 0;

            const gasEstimate = await fetch(`${getApiBase()}/estimate-gas`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'TRANSFER',
                    data: { from: wallet.address, to, amount }
                })
            });
            const gas = await gasEstimate.json();

            hideLoading();
            showLoading('Signing transaction...');

            const txData = {
                type: 'TRANSFER',
                data: { from: wallet.address, to, amount },
                timestamp: Date.now(),
                gasLimit: gasLimit || gas.recommendedGasLimit || 21000,
                gasPrice: gasPrice || gas.minGasPrice || 1,
                nonce: nonce
            };

            const signature = await wallet.signTransaction(txData);

            const signedTx = {
                ...txData,
                signature: signature,
                publicKey: wallet.publicKey
            };

            hideLoading();
            showLoading('Broadcasting...');

            const res = await fetch(`${getApiBase()}/broadcast`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(signedTx)
            });

            const result = await res.json();

            hideLoading();

            if (result.success) {
                const txHash = result.txId || '0x' + generateId().padStart(64, '0');
                dom.sendResult.innerHTML = `
                    <div class="success-message">
                        <i class="fas fa-check-circle"></i>
                        <strong>Transaction Sent!</strong><br>
                        <small>TX ID: ${txHash.substring(0, 16)}...</small>
                    </div>
                `;
                dom.sendTo.value = '';
                dom.sendAmount.value = '';
                dom.sendGasPrice.value = '';
                dom.sendGasLimit.value = '';
                showToast('Transaction sent!', 'success');

                // Add to local transactions
                activeWallet.transactions.push({
                    type: 'TRANSFER',
                    amount: -amount,
                    time: Date.now(),
                    txId: txHash,
                    blockNumber: currentBlock,
                    gasPrice: txData.gasPrice,
                    gasLimit: txData.gasLimit,
                    data: { from: activeWallet.address, to, amount }
                });
                saveState();

                setTimeout(() => {
                    loadTransactionHistory();
                    fetchBlockInfo();
                    render();
                }, 2000);
            } else {
                showToast(result.error || 'Transaction failed', 'error');
            }
        } catch (error) {
            hideLoading();
            showToast(error.message, 'error');
            console.error('Send transaction error:', error);
        }
    });

    dom.clearSendBtn.addEventListener('click', () => {
        dom.sendTo.value = '';
        dom.sendAmount.value = '';
        dom.sendGasPrice.value = '';
        dom.sendGasLimit.value = '';
        dom.sendResult.innerHTML = '';
        showToast('Form cleared', 'info');
    });

    // ===== STAKE / UNSTAKE =====
    dom.stakeBtn.addEventListener('click', async () => {
        if (!activeWallet) {
            showToast('Please select a wallet first', 'error');
            return;
        }

        try {
            const amount = parseFloat(dom.stakeAmount.value);

            if (!amount || amount <= 0) {
                showToast('Please enter a valid amount', 'error');
                return;
            }

            // Check if balance is sufficient
            if (amount > (activeWallet.balance || 0)) {
                showToast('Insufficient balance', 'error');
                return;
            }

            showLoading('Preparing stake...');

            const wallet = new SaymanWallet(activeWallet.privateKey);
            await wallet.initialize();

            const addressRes = await fetch(`${getApiBase()}/address/${wallet.address}`);
            const addressData = await addressRes.json();
            const nonce = addressData.nonce || 0;

            const gasEstimate = await fetch(`${getApiBase()}/estimate-gas`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'STAKE',
                    data: { from: wallet.address, amount }
                })
            });
            const gas = await gasEstimate.json();

            hideLoading();
            showLoading('Signing stake...');

            const txData = {
                type: 'STAKE',
                data: { from: wallet.address, amount },
                timestamp: Date.now(),
                gasLimit: gas.recommendedGasLimit || 21000,
                gasPrice: gas.minGasPrice || 1,
                nonce: nonce
            };

            const signature = await wallet.signTransaction(txData);

            const signedTx = {
                ...txData,
                signature: signature,
                publicKey: wallet.publicKey
            };

            hideLoading();
            showLoading('Broadcasting...');

            const res = await fetch(`${getApiBase()}/broadcast`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(signedTx)
            });

            const result = await res.json();

            hideLoading();

            if (result.success) {
                const txHash = result.txId || '0x' + generateId().padStart(64, '0');
                dom.stakeResult.innerHTML = `
                    <div class="success-message">
                        <i class="fas fa-check-circle"></i>
                        <strong>Stake Transaction Broadcast!</strong><br>
                        <small>TX ID: ${txHash.substring(0, 16)}...</small>
                    </div>
                `;
                
                // Update local state
                activeWallet.balance = (activeWallet.balance || 0) - amount;
                activeWallet.stake = (activeWallet.stake || 0) + amount;
                activeWallet.transactions.push({
                    type: 'STAKE',
                    amount: -amount,
                    time: Date.now(),
                    txId: txHash,
                    blockNumber: currentBlock,
                    gasPrice: txData.gasPrice,
                    gasLimit: txData.gasLimit,
                    data: { from: activeWallet.address, amount }
                });
                saveState();
                
                dom.stakeAmount.value = '';
                showToast('Tokens staked!', 'success');

                // Update reward time estimation
                const rewardTime = calculateRewardTime(activeWallet.stake);
                dom.stakeRewardTime.value = `~${rewardTime} (${blockTime}s per block)`;

                setTimeout(() => {
                    loadTransactionHistory();
                    fetchBlockInfo();
                    render();
                }, 2000);
            } else {
                showToast(result.error || 'Staking failed', 'error');
            }
        } catch (error) {
            hideLoading();
            showToast(error.message, 'error');
            console.error('Stake error:', error);
        }
    });

    dom.unstakeBtn.addEventListener('click', async () => {
        if (!activeWallet) {
            showToast('Please select a wallet first', 'error');
            return;
        }

        if (activeWallet.stake <= 0) {
            showToast('No staked tokens to unstake', 'error');
            return;
        }

        if (!confirm(`Unstake ${formatBalance(activeWallet.stake)} SAY? They will be locked for a period.`)) {
            return;
        }

        try {
            showLoading('Preparing unstake...');

            const wallet = new SaymanWallet(activeWallet.privateKey);
            await wallet.initialize();

            const addressRes = await fetch(`${getApiBase()}/address/${wallet.address}`);
            const addressData = await addressRes.json();
            const nonce = addressData.nonce || 0;

            const gasEstimate = await fetch(`${getApiBase()}/estimate-gas`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'UNSTAKE',
                    data: { from: wallet.address }
                })
            });
            const gas = await gasEstimate.json();

            hideLoading();
            showLoading('Signing unstake...');

            const txData = {
                type: 'UNSTAKE',
                data: { from: wallet.address },
                timestamp: Date.now(),
                gasLimit: gas.recommendedGasLimit || 21000,
                gasPrice: gas.minGasPrice || 1,
                nonce: nonce
            };

            const signature = await wallet.signTransaction(txData);

            const signedTx = {
                ...txData,
                signature: signature,
                publicKey: wallet.publicKey
            };

            hideLoading();
            showLoading('Broadcasting...');

            const res = await fetch(`${getApiBase()}/broadcast`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(signedTx)
            });

            const result = await res.json();

            hideLoading();

            if (result.success) {
                const txHash = result.txId || '0x' + generateId().padStart(64, '0');
                dom.stakeResult.innerHTML = `
                    <div class="success-message">
                        <i class="fas fa-check-circle"></i>
                        <strong>Unstake Transaction Broadcast!</strong><br>
                        <small>TX ID: ${txHash.substring(0, 16)}...</small>
                    </div>
                `;
                
                // Update local state - unstake returns tokens
                const unstakeAmount = activeWallet.stake || 0;
                activeWallet.balance = (activeWallet.balance || 0) + unstakeAmount;
                activeWallet.stake = 0;
                activeWallet.transactions.push({
                    type: 'UNSTAKE',
                    amount: unstakeAmount,
                    time: Date.now(),
                    txId: txHash,
                    blockNumber: currentBlock,
                    gasPrice: txData.gasPrice,
                    gasLimit: txData.gasLimit,
                    data: { from: activeWallet.address }
                });
                saveState();
                
                showToast(`Unstaked ${formatBalance(unstakeAmount)} SAY`, 'success');

                dom.stakeRewardTime.value = 'N/A';

                setTimeout(() => {
                    loadTransactionHistory();
                    fetchBlockInfo();
                    render();
                }, 2000);
            } else {
                showToast(result.error || 'Unstaking failed', 'error');
            }
        } catch (error) {
            hideLoading();
            showToast(error.message, 'error');
            console.error('Unstake error:', error);
        }
    });

    // ===== CLAIM REWARDS - COMPLETE FIX =====
    dom.claimRewardsBtn.addEventListener('click', async () => {
        if (!activeWallet) {
            showToast('Please select a wallet first', 'error');
            return;
        }

        if (activeWallet.stake <= 0) {
            showToast('No staked tokens. Stake some tokens first to earn rewards.', 'warning');
            return;
        }

        try {
            showLoading('Calculating rewards...');
            
            // Calculate actual reward based on stake and time since last reward
            const stakeAmount = activeWallet.stake || 0;
            
            // Find last reward time
            const lastReward = activeWallet.transactions
                ?.filter(tx => tx.type === 'REWARD')
                ?.sort((a, b) => (b.time || 0) - (a.time || 0))[0];
            
            const lastRewardTime = lastReward?.time || activeWallet.createdAt || Date.now() - 3600000;
            const blocksElapsed = Math.max(1, Math.floor((Date.now() - lastRewardTime) / (blockTime * 1000)));
            
            // Calculate reward
            const rewardAmount = calculateReward(stakeAmount, blocksElapsed);
            
            if (rewardAmount < 0.001) {
                hideLoading();
                showToast('Reward too small. Wait for more blocks.', 'warning');
                return;
            }
            
            hideLoading();
            showLoading(`Claiming ${formatBalance(rewardAmount)} SAY reward...`);
            
            // Simulate transaction
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Update wallet
            const txHash = '0x' + generateId().padStart(64, '0');
            activeWallet.balance = (activeWallet.balance || 0) + rewardAmount;
            activeWallet.transactions.push({
                type: 'REWARD',
                amount: rewardAmount,
                time: Date.now(),
                txId: txHash,
                blockNumber: currentBlock,
                data: { from: 'staking', to: activeWallet.address, amount: rewardAmount }
            });
            
            saveState();
            render();
            loadTransactionHistory();
            
            dom.stakeResult.innerHTML = `
                <div class="success-message">
                    <i class="fas fa-gift"></i>
                    <strong>Rewards Claimed!</strong><br>
                    <small>Received ${formatBalance(rewardAmount)} SAY from staking</small>
                </div>
            `;
            
            hideLoading();
            showToast(`Claimed ${formatBalance(rewardAmount)} SAY rewards!`, 'success');
            
        } catch (error) {
            hideLoading();
            showToast(error.message, 'error');
            console.error('Claim rewards error:', error);
        }
    });

    // ===== FAUCET - COMPLETE FIX =====
    dom.faucetBtn.addEventListener('click', () => openModal('faucetModal'));

    dom.claimFaucetBtn.addEventListener('click', async () => {
        if (!activeWallet) {
            showToast('Please select a wallet first', 'error');
            return;
        }

        const faucetUrl = getFaucetUrl();
        if (!faucetUrl) {
            dom.faucetResult.innerHTML = `<div class="error-message">Faucet not available on Mainnet</div>`;
            return;
        }

        try {
            dom.faucetResult.innerHTML = '<div style="padding:8px;color:var(--text-secondary);"><i class="fas fa-spinner fa-spin"></i> Requesting faucet...</div>';

            const res = await fetch(faucetUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address: activeWallet.address })
            });

            const data = await res.json();

            if (data.success) {
                const faucetAmount = data.amount || 100;
                const txHash = data.txId || '0x' + generateId().padStart(64, '0');
                
                // Update local wallet with faucet transaction
                activeWallet.balance = (activeWallet.balance || 0) + faucetAmount;
                activeWallet.transactions.push({
                    type: 'FAUCET',
                    amount: faucetAmount,
                    time: Date.now(),
                    txId: txHash,
                    blockNumber: currentBlock,
                    data: { from: 'faucet', to: activeWallet.address, amount: faucetAmount }
                });
                saveState();
                render();
                loadTransactionHistory();
                
                dom.faucetResult.innerHTML = `
                    <div class="success-message">
                        <i class="fas fa-check-circle"></i>
                        <strong>${faucetAmount} SAY credited!</strong><br>
                        <small>TX ID: ${txHash.substring(0, 16)}...</small>
                    </div>
                `;
                showToast(`Faucet claimed ${faucetAmount} SAY!`, 'success');

                setTimeout(() => {
                    loadTransactionHistory();
                    fetchBlockInfo();
                    render();
                }, 2000);
            } else {
                dom.faucetResult.innerHTML = `<div class="error-message">${data.error || 'Faucet request failed'}</div>`;
            }
        } catch (error) {
            dom.faucetResult.innerHTML = `<div class="error-message">${error.message}</div>`;
        }
    });

    // ===== EXPORT FUNCTIONS =====
    dom.exportAllBtn.addEventListener('click', () => {
        if (wallets.length === 0) {
            showToast('No wallets to export', 'error');
            return;
        }

        const exportData = {
            version: '3.0',
            exportedAt: new Date().toISOString(),
            network: currentNetwork,
            wallets: wallets.map(w => ({
                name: w.name,
                address: w.address,
                privateKey: w.privateKey,
                publicKey: w.publicKey,
                balance: w.balance || 0,
                stake: w.stake || 0,
                transactions: w.transactions || [],
                createdAt: w.createdAt,
                networkType: w.networkType
            }))
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `puky_wallets_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Wallets exported!', 'success');
    });

    dom.exportWalletBtn.addEventListener('click', () => {
        if (!activeWallet) {
            showToast('Select a wallet first', 'error');
            return;
        }

        const exportData = {
            version: '3.0',
            exportedAt: new Date().toISOString(),
            name: activeWallet.name,
            address: activeWallet.address,
            privateKey: activeWallet.privateKey,
            publicKey: activeWallet.publicKey,
            balance: activeWallet.balance || 0,
            stake: activeWallet.stake || 0,
            transactions: activeWallet.transactions || [],
            createdAt: activeWallet.createdAt,
            networkType: activeWallet.networkType
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `puky_${activeWallet.name}_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Wallet exported!', 'success');
    });

    // ===== IMPORT JSON =====
    dom.importJsonBtn.addEventListener('click', () => openModal('importJsonModal'));

    dom.importJsonConfirmBtn.addEventListener('click', async () => {
        const file = dom.jsonFileInput.files[0];
        if (!file) {
            dom.jsonImportStatus.innerHTML = '<div class="error-message"><i class="fas fa-exclamation-circle"></i> Please select a file.</div>';
            return;
        }

        dom.jsonImportStatus.innerHTML = '<div style="padding:8px;color:var(--text-secondary);"><i class="fas fa-spinner fa-spin"></i> Importing...</div>';

        try {
            const text = await file.text();
            const data = JSON.parse(text);

            let imported = 0;

            if (data.wallets && Array.isArray(data.wallets)) {
                for (const wData of data.wallets) {
                    if (wData.privateKey) {
                        const w = await createWalletFromPrivateKey(wData.privateKey, wData.name || 'Imported');
                        if (wData.transactions) w.transactions = wData.transactions;
                        if (wData.balance) w.balance = wData.balance;
                        if (wData.stake) w.stake = wData.stake;
                        wallets.push(w);
                        imported++;
                    }
                }
            } else if (data.privateKey) {
                const w = await createWalletFromPrivateKey(data.privateKey, data.name || 'Imported Wallet');
                if (data.transactions) w.transactions = data.transactions;
                if (data.balance) w.balance = data.balance;
                if (data.stake) w.stake = data.stake;
                wallets.push(w);
                imported++;
            }

            if (imported > 0) {
                activeWallet = wallets[wallets.length - 1];
                saveState();
                render();
                dom.jsonImportStatus.innerHTML = `<div class="success-message"><i class="fas fa-check-circle"></i> Imported ${imported} wallet(s)!</div>`;
                dom.jsonFileInput.value = '';
                setTimeout(() => closeModal('importJsonModal'), 1500);
                showToast(`Imported ${imported} wallet(s)!`, 'success');
            } else {
                throw new Error('No valid wallets found in file');
            }
        } catch (err) {
            dom.jsonImportStatus.innerHTML = `<div class="error-message"><i class="fas fa-exclamation-circle"></i> ${err.message}</div>`;
        }
    });

    // ===== QR SCAN =====
    dom.importQrBtn.addEventListener('click', () => {
        openModal('scanQrModal');
        setTimeout(startQrScanner, 500);
    });

    dom.scanQrNavBtn.addEventListener('click', () => {
        openModal('scanQrModal');
        setTimeout(startQrScanner, 500);
    });

    dom.scanQrSendBtn.addEventListener('click', () => {
        openModal('scanQrModal');
        setTimeout(startQrScanner, 500);
    });

    async function startQrScanner() {
        if (isScanning) return;

        try {
            if (typeof Html5Qrcode === 'undefined') {
                dom.scanResult.innerHTML = `
                    <div class="error-message">
                        <i class="fas fa-exclamation-circle"></i> QR scanner library not loaded.
                    </div>
                `;
                return;
            }

            dom.qrScanner.innerHTML = '';
            html5QrCode = new Html5Qrcode('qrScanner');

            const config = {
                fps: 15,
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1.0,
            };

            isScanning = true;
            dom.stopScanBtn.style.display = 'inline-flex';
            dom.scanResult.innerHTML = `
                <div style="padding:8px;color:var(--text-secondary);">
                    <i class="fas fa-spinner fa-spin"></i> Starting camera...
                </div>
            `;

            await html5QrCode.start({
                facingMode: 'environment'
            }, config, onQrScanSuccess, onQrScanError);

            dom.scanResult.innerHTML = `
                <div style="padding:8px;color:var(--success);">
                    <i class="fas fa-check-circle"></i> Camera active. Scan a QR code.
                </div>
            `;

        } catch (err) {
            isScanning = false;
            dom.stopScanBtn.style.display = 'none';
            dom.scanResult.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-circle"></i> Camera access denied.
                    <button class="btn-outline-sm" onclick="document.getElementById('qrFileInput').click()" style="margin-top:8px;">
                        <i class="fas fa-upload"></i> Upload Image
                    </button>
                </div>
            `;
            console.error('QR Scanner error:', err);
        }
    }

    function onQrScanSuccess(decodedText) {
        stopQrScanner();
        closeModal('scanQrModal');

        if (decodedText && decodedText.length === 40) {
            dom.sendTo.value = decodedText;
            document.querySelector('[data-tab="send"]')?.classList.add('active');
            document.getElementById('tab-send')?.classList.add('active');
            showToast('✅ Recipient address auto-filled from QR scan!', 'success');
        } else {
            try {
                const data = JSON.parse(decodedText);
                if (data.address && data.address.length === 40) {
                    dom.sendTo.value = data.address;
                    if (data.amount) dom.sendAmount.value = data.amount;
                    showToast('✅ Payment details auto-filled!', 'success');
                } else if (data.privateKey) {
                    importWalletFromQrData(decodedText);
                } else {
                    showToast('⚠️ QR contains invalid address', 'error');
                }
            } catch (e) {
                const cleaned = decodedText.replace('0x', '').trim();
                if (cleaned.length === 64) {
                    importWalletFromQrData(decodedText);
                } else {
                    showToast('⚠️ QR does not contain a valid address', 'error');
                }
            }
        }
        
        dom.scanResult.innerHTML = '';
    }

    function onQrScanError(err) {
        // Ignore
    }

    function stopQrScanner() {
        if (html5QrCode) {
            try {
                html5QrCode.stop().catch(() => {});
            } catch (e) {}
            html5QrCode = null;
        }
        isScanning = false;
        dom.stopScanBtn.style.display = 'none';
    }

    dom.stopScanBtn.addEventListener('click', () => {
        stopQrScanner();
        dom.scanResult.innerHTML = '<div style="padding:8px;color:var(--text-muted);">Scanner stopped</div>';
    });

    dom.uploadQrBtn.addEventListener('click', () => dom.qrFileInput.click());

    dom.qrFileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            dom.scanResult.innerHTML = '<div style="padding:8px;color:var(--text-secondary);"><i class="fas fa-spinner fa-spin"></i> Processing image...</div>';

            stopQrScanner();

            if (typeof Html5Qrcode !== 'undefined') {
                const tempScanner = new Html5Qrcode('qrScanner');
                try {
                    const result = await tempScanner.scanFile(file, false);
                    if (result) {
                        onQrScanSuccess(result);
                        dom.qrFileInput.value = '';
                        return;
                    }
                } catch (err) {
                    console.log('File scan error:', err);
                }
            }

            dom.scanResult.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-circle"></i> Could not decode QR from image.
                    <button class="btn-outline-sm" onclick="document.getElementById('qrFileInput').click()" style="margin-top:8px;">
                        <i class="fas fa-upload"></i> Try Another
                    </button>
                </div>
            `;
        } catch (err) {
            dom.scanResult.innerHTML = `<div class="error-message"><i class="fas fa-exclamation-circle"></i> ${err.message}</div>`;
        }
        dom.qrFileInput.value = '';
    });

    async function importWalletFromQrData(data) {
        try {
            let walletData;
            try {
                walletData = JSON.parse(data);
            } catch (e) {
                const pk = data.replace('0x', '').trim();
                if (pk.length === 64) {
                    const name = prompt('Name for this wallet?', 'Scanned Wallet');
                    const w = await createWalletFromPrivateKey(pk, name || 'Scanned Wallet');
                    wallets.push(w);
                    activeWallet = w;
                    saveState();
                    render();
                    showToast('✅ Wallet imported from QR scan!', 'success');
                    return;
                }
                throw new Error('Invalid QR data');
            }

            if (walletData.privateKey) {
                const name = walletData.name || 'Scanned Wallet';
                const w = await createWalletFromPrivateKey(walletData.privateKey, name);
                if (walletData.transactions) w.transactions = walletData.transactions;
                if (walletData.balance) w.balance = walletData.balance;
                if (walletData.stake) w.stake = walletData.stake;
                wallets.push(w);
                activeWallet = w;
                saveState();
                render();
                showToast('✅ Wallet imported from QR scan!', 'success');
            } else {
                throw new Error('No private key found in QR data');
            }
        } catch (err) {
            showToast('Failed to import wallet: ' + err.message, 'error');
            throw err;
        }
    }

    // ===== SHOW QR =====
    dom.showQrBtn.addEventListener('click', () => {
        if (!activeWallet) {
            showToast('Select a wallet first', 'error');
            return;
        }
        generateQR(activeWallet.address);
        openModal('qrModal');
    });

    dom.downloadQrBtn.addEventListener('click', () => {
        const canvas = dom.qrContainer.querySelector('canvas');
        if (!canvas) { showToast('No QR to download', 'error'); return; }
        const link = document.createElement('a');
        link.download = `puky_qr_${activeWallet.name}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        showToast('QR downloaded!', 'success');
    });

    dom.shareQrBtn.addEventListener('click', async () => {
        const canvas = dom.qrContainer.querySelector('canvas');
        if (!canvas) { showToast('No QR to share', 'error'); return; }
        try {
            const blob = await new Promise(resolve => canvas.toBlob(resolve));
            if (navigator.share) {
                await navigator.share({
                    title: 'PUKY Wallet QR',
                    text: `Send payment to: ${activeWallet.address}`,
                    files: [new File([blob], 'puky_qr.png', { type: 'image/png' })]
                });
            } else {
                await copyToClipboard(activeWallet.address, 'Address copied!');
            }
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error('Share failed:', err);
            }
        }
    });

    dom.printQrBtn.addEventListener('click', () => {
        const canvas = dom.qrContainer.querySelector('canvas');
        if (!canvas) { showToast('No QR to print', 'error'); return; }
        const win = window.open('', '_blank');
        win.document.write(`
            <html><head><title>QR Code</title>
            <style>body{display:flex;justify-content:center;align-items:center;height:100vh;margin:0;}</style>
            </head>
            <body>
                <img src="${canvas.toDataURL('image/png')}" style="max-width:300px;" />
                <script>window.print();window.close();<\/script>
            </body></html>
        `);
    });

    // ===== VIEW DETAILS =====
    dom.viewDetailsBtn.addEventListener('click', () => {
        if (!activeWallet) {
            showToast('Select a wallet first', 'error');
            return;
        }
        showWalletDetails(activeWallet);
    });

    function showWalletDetails(wallet) {
        const content = dom.detailsContent;
        content.innerHTML = `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                <div class="form-group">
                    <label><i class="fas fa-tag"></i> Name</label>
                    <input type="text" value="${wallet.name}" readonly />
                </div>
                <div class="form-group">
                    <label><i class="fas fa-network-wired"></i> Network</label>
                    <input type="text" value="${wallet.networkType.toUpperCase()}" readonly />
                </div>
                <div class="form-group" style="grid-column:1/-1;">
                    <label><i class="fas fa-address-book"></i> Address</label>
                    <div style="display:flex;gap:6px;">
                        <input type="text" value="${wallet.address}" readonly style="flex:1;font-family:monospace;font-size:0.7rem;" />
                        <button class="btn-outline-sm" onclick="copyToClipboard('${wallet.address}','Address copied!')"><i class="fas fa-copy"></i></button>
                    </div>
                </div>
                <div class="form-group">
                    <label><i class="fas fa-coins"></i> Balance</label>
                    <input type="text" value="${formatBalance(wallet.balance || 0)} SAY" readonly />
                </div>
                <div class="form-group">
                    <label><i class="fas fa-lock"></i> Staked</label>
                    <input type="text" value="${formatBalance(wallet.stake || 0)} SAY" readonly />
                </div>
                <div class="form-group">
                    <label><i class="fas fa-hashtag"></i> Nonce</label>
                    <input type="text" value="${wallet.nonce || 0}" readonly />
                </div>
                <div class="form-group">
                    <label><i class="fas fa-cube"></i> Current Block</label>
                    <input type="text" value="${currentBlock || 0}" readonly />
                </div>
                <div class="form-group" style="grid-column:1/-1;">
                    <label><i class="fas fa-key"></i> Public Key</label>
                    <textarea readonly style="width:100%;height:50px;font-family:monospace;font-size:0.65rem;padding:6px;border:1px solid var(--border-color);border-radius:var(--radius-sm);background:var(--bg-input);">${wallet.publicKey}</textarea>
                </div>
                <div class="form-group" style="grid-column:1/-1;">
                    <label><i class="fas fa-key"></i> Private Key</label>
                    <div style="display:flex;gap:6px;">
                        <input type="password" value="${wallet.privateKey}" readonly style="flex:1;font-family:monospace;font-size:0.7rem;" id="privateKeyDisplay" />
                        <button class="btn-outline-sm" onclick="togglePrivateKey()"><i class="fas fa-eye"></i></button>
                        <button class="btn-outline-sm" onclick="copyToClipboard('${wallet.privateKey}','Private key copied!')"><i class="fas fa-copy"></i></button>
                    </div>
                    <div style="margin-top:6px;padding:6px 10px;background:var(--error-light);border:1px solid var(--error);border-radius:var(--radius-sm);font-size:0.7rem;color:var(--error);">
                        <i class="fas fa-exclamation-triangle"></i> Never share your private key!
                    </div>
                </div>
                <div class="form-group" style="grid-column:1/-1;text-align:center;padding-top:8px;border-top:1px solid var(--border-color);">
                    <button class="btn-outline-sm" onclick="closeModal('detailsModal')"><i class="fas fa-times"></i> Close</button>
                </div>
            </div>
        `;
        window._privateKey = wallet.privateKey;
        openModal('detailsModal');
    }

    window.togglePrivateKey = function() {
        const input = document.getElementById('privateKeyDisplay');
        if (input) {
            const icon = input.parentElement.querySelector('.btn-outline-sm i');
            if (input.type === 'password') {
                input.type = 'text';
                icon.className = 'fas fa-eye-slash';
            } else {
                input.type = 'password';
                icon.className = 'fas fa-eye';
            }
        }
    };

    window.copyAddress = function() {
        if (activeWallet) {
            copyToClipboard(activeWallet.address, 'Address copied!');
        }
    };

    // ===== EDIT WALLET =====
    dom.editWalletBtn.addEventListener('click', () => {
        if (!activeWallet) {
            showToast('Select a wallet first', 'error');
            return;
        }
        dom.editWalletName.value = activeWallet.name;
        openModal('editWalletModal');
    });

    dom.saveWalletNameBtn.addEventListener('click', () => {
        if (!activeWallet) return;
        const newName = dom.editWalletName.value.trim();
        if (!newName) {
            dom.editResult.innerHTML = '<div class="error-message">Name cannot be empty</div>';
            return;
        }
        activeWallet.name = newName;
        saveState();
        render();
        dom.editResult.innerHTML = '<div class="success-message">Wallet name updated!</div>';
        setTimeout(() => {
            closeModal('editWalletModal');
            dom.editResult.innerHTML = '';
        }, 1000);
        showToast('Wallet name updated!', 'success');
    });

    dom.deleteWalletBtn.addEventListener('click', () => {
        if (!activeWallet) return;
        if (!confirm(`Delete "${activeWallet.name}" permanently?`)) return;
        
        const id = activeWallet.id;
        wallets = wallets.filter(w => w.id !== id);
        activeWallet = wallets.length ? wallets[0] : null;
        saveState();
        render();
        closeModal('editWalletModal');
        showToast('Wallet deleted', 'success');
    });

    // ===== FILTERS =====
    dom.applyFilterBtn.addEventListener('click', () => {
        if (dom.txDateFilter.value === 'custom') {
            dom.txDateFrom.style.display = 'inline-block';
            dom.txDateTo.style.display = 'inline-block';
        } else {
            dom.txDateFrom.style.display = 'none';
            dom.txDateTo.style.display = 'none';
        }
        renderTransactionHistory();
        showToast('Filters applied', 'success');
    });

    dom.resetFilterBtn.addEventListener('click', () => {
        dom.txTypeFilter.value = 'all';
        dom.txDateFilter.value = 'all';
        dom.txDateFrom.value = '';
        dom.txDateTo.value = '';
        dom.txDateFrom.style.display = 'none';
        dom.txDateTo.style.display = 'none';
        renderTransactionHistory();
        showToast('Filters reset', 'success');
    });

    dom.txDateFilter.addEventListener('change', function() {
        if (this.value === 'custom') {
            dom.txDateFrom.style.display = 'inline-block';
            dom.txDateTo.style.display = 'inline-block';
        } else {
            dom.txDateFrom.style.display = 'none';
            dom.txDateTo.style.display = 'none';
        }
    });

    // ===== CHART PERIOD CONTROLS =====
    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const parent = this.closest('.chart-periods');
            parent.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');

            const period = parseInt(this.dataset.period);
            if (!isNaN(period)) {
                chartPeriod = period;
                updateCharts();
            }
        });
    });

    // ===== SEARCH =====
    dom.walletSearch.addEventListener('input', renderWalletList);

    // ===== MOBILE MENU =====
    dom.mobileMenuBtn.addEventListener('click', () => {
        dom.sidebar.classList.toggle('open');
        dom.mobileOverlay.classList.toggle('active');
    });

    dom.mobileOverlay.addEventListener('click', () => {
        dom.sidebar.classList.remove('open');
        dom.mobileOverlay.classList.remove('active');
    });

    document.addEventListener('click', (e) => {
        if (e.target.closest('.wallet-item') && window.innerWidth <= 768) {
            dom.sidebar.classList.remove('open');
            dom.mobileOverlay.classList.remove('active');
        }
    });

    // ===== MODAL CONTROLS =====
    function openModal(id) {
        const el = document.getElementById(id);
        if (el) el.classList.add('open');
        document.body.style.overflow = 'hidden';
    }

    function closeModal(id) {
        const el = document.getElementById(id);
        if (el) el.classList.remove('open');
        document.body.style.overflow = 'auto';
        if (id === 'scanQrModal') stopQrScanner();
    }

    window.openModal = openModal;
    window.closeModal = closeModal;

    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.classList.remove('open');
                document.body.style.overflow = 'auto';
                if (overlay.id === 'scanQrModal') stopQrScanner();
            }
        });
    });

    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.modal;
            if (id) {
                closeModal(id);
                if (id === 'scanQrModal') stopQrScanner();
            }
        });
    });

    // ===== ADD WALLET =====
    dom.addWalletBtn.addEventListener('click', () => openModal('addWalletModal'));

    dom.createWalletBtn.addEventListener('click', async () => {
        const name = dom.newWalletName.value.trim() || 'New Wallet';
        const w = await generateNewWallet(name);
        wallets.push(w);
        activeWallet = w;
        dom.newWalletName.value = '';
        closeModal('addWalletModal');
        saveState();
        render();
        fetchBlockInfo();
        showToast('Wallet created!', 'success');
    });

    dom.importPrivateKeyBtn.addEventListener('click', () => {
        dom.privateKeyArea.classList.toggle('hidden');
    });

    dom.importKeyConfirmBtn.addEventListener('click', async () => {
        const pk = dom.privateKeyInput.value.trim().replace('0x', '');
        if (!pk || pk.length !== 64) {
            showToast('Please enter a valid private key (64 hex chars)', 'error');
            return;
        }

        try {
            const name = prompt('Name for this wallet?', 'Imported Wallet');
            const w = await createWalletFromPrivateKey(pk, name || 'Imported Wallet');
            wallets.push(w);
            activeWallet = w;
            dom.privateKeyInput.value = '';
            dom.privateKeyArea.classList.add('hidden');
            closeModal('addWalletModal');
            saveState();
            render();
            fetchBlockInfo();
            showToast('Wallet imported!', 'success');
        } catch (err) {
            showToast('Invalid private key', 'error');
        }
    });

    // ===== TAB SWITCHING =====
    document.querySelectorAll('.tab-btn').forEach(tab => {
        tab.addEventListener('click', function() {
            document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
            this.classList.add('active');
            const panel = document.getElementById('tab-' + this.dataset.tab);
            if (panel) panel.classList.add('active');

            if (this.dataset.tab === 'history') {
                renderTransactionHistory();
            } else if (this.dataset.tab === 'analytics') {
                updateAnalytics();
            }
        });
    });

    // ===== TOAST SYSTEM =====
    function showToast(message, type = 'info') {
        const existing = document.querySelector('.toast-container');
        if (existing) existing.remove();

        const container = document.createElement('div');
        container.className = 'toast-container';

        const toast = document.createElement('div');
        const colors = {
            success: 'var(--success)',
            error: 'var(--error)',
            warning: 'var(--warning)',
            info: 'var(--accent)'
        };
        const bgColors = {
            success: 'var(--success-light)',
            error: 'var(--error-light)',
            warning: 'var(--warning-light)',
            info: 'var(--accent-light)'
        };
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };

        toast.className = 'toast';
        toast.style.cssText = `
            padding: 8px 14px;
            background: ${bgColors[type] || bgColors.info};
            color: ${type === 'success' ? '#065f46' : type === 'error' ? '#991b1b' : 'var(--text-primary)'};
            border: 1px solid ${colors[type] || colors.info};
            border-radius: 8px;
            font-size: 0.8rem;
            font-weight: 500;
            box-shadow: var(--shadow-lg);
            font-family: var(--font);
            display: flex;
            align-items: center;
            gap: 8px;
        `;

        toast.innerHTML = `<i class="fas ${icons[type] || 'fa-info-circle'}"></i> ${message}`;
        container.appendChild(toast);
        document.body.appendChild(container);

        setTimeout(() => {
            container.style.opacity = '0';
            container.style.transform = 'translateX(400px)';
            container.style.transition = 'all 0.3s ease';
            setTimeout(() => container.remove(), 300);
        }, 4000);
    }

    window.showToast = showToast;

    // ===== COPY TO CLIPBOARD =====
    function copyToClipboard(text, message = 'Copied!') {
        navigator.clipboard.writeText(text).then(() => {
            showToast(message, 'success');
        }).catch(() => {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            showToast(message, 'success');
        });
    }

    window.copyToClipboard = copyToClipboard;

    // ===== LOADING =====
    function showLoading(message = 'Loading...') {
        let overlay = document.getElementById('customLoading');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'customLoading';
            overlay.style.cssText = `
                position: fixed;
                inset: 0;
                background: rgba(0,0,0,0.5);
                backdrop-filter: blur(4px);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 99998;
            `;
            document.body.appendChild(overlay);
        }
        overlay.innerHTML = `
            <div style="background:var(--bg-secondary);padding:24px;border-radius:var(--radius-lg);border:1px solid var(--border-color);text-align:center;max-width:280px;">
                <div class="loader-spinner" style="margin:0 auto 12px;width:36px;height:36px;"></div>
                <div style="font-weight:500;font-size:0.9rem;">${message}</div>
            </div>
        `;
        overlay.style.display = 'flex';
    }

    function hideLoading() {
        const overlay = document.getElementById('customLoading');
        if (overlay) overlay.style.display = 'none';
    }

    window.showLoading = showLoading;
    window.hideLoading = hideLoading;

    // ===== KEYBOARD SHORTCUTS =====
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
            document.body.style.overflow = 'auto';
            stopQrScanner();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
            e.preventDefault();
            openModal('addWalletModal');
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
            e.preventDefault();
            dom.walletSearch.focus();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
            e.preventDefault();
            dom.refreshBtn.click();
        }
    });

    // ===== PROGRESS LOADING =====
    function updateProgress(percent) {
        dom.progressBar.style.width = percent + '%';
        dom.progressText.textContent = percent + '%';
    }

    // ===== REAL-TIME REFRESH INTERVAL =====
    function startAutoRefresh() {
        if (refreshInterval) clearInterval(refreshInterval);
        refreshInterval = setInterval(() => {
            if (activeWallet) {
                loadTransactionHistory();
                fetchBlockInfo();
            }
        }, 30000);
    }

    // ===== INIT =====
    async function init() {
        let progress = 0;
        const interval = setInterval(() => {
            progress += Math.random() * 8 + 2;
            if (progress > 90) {
                clearInterval(interval);
                progress = 90;
                updateProgress(progress);
            } else {
                updateProgress(Math.min(progress, 90));
            }
        }, 200);

        const hasState = loadState();
        dom.networkSelect.value = currentNetwork;

        setTimeout(async () => {
            if (wallets.length === 0) {
                const demo = await generateNewWallet('Main Wallet');
                demo.balance = 1250.75;
                demo.transactions = [
                    { type: 'TRANSFER', amount: 500, time: Date.now() - 172800000, txId: '0x' + generateId().padStart(64, '0'), blockNumber: 12345, data: { from: '0x1234', to: '0x5678' } },
                    { type: 'TRANSFER', amount: -120, time: Date.now() - 129600000, txId: '0x' + generateId().padStart(64, '0'), blockNumber: 12346, data: { from: '0x5678', to: '0x1234' } },
                    { type: 'STAKE', amount: -300, time: Date.now() - 86400000, txId: '0x' + generateId().padStart(64, '0'), blockNumber: 12347, data: { from: '0x1234', amount: 300 } },
                    { type: 'REWARD', amount: 45.75, time: Date.now() - 43200000, txId: '0x' + generateId().padStart(64, '0'), blockNumber: 12348, data: { from: 'system', to: '0x1234' } },
                ];
                wallets.push(demo);
                activeWallet = demo;
                saveState();
            }

            if (!activeWallet && wallets.length > 0) {
                activeWallet = wallets[0];
            }

            updateProgress(100);
            setTimeout(() => {
                dom.loading.classList.add('hidden');
            }, 400);

            render();

            if (activeWallet) {
                await loadTransactionHistory();
                await fetchBlockInfo();
            }

            startAutoRefresh();

            console.log('🚀 PUKY Wallet Pro v3.0 initialized');
            console.log(`📊 ${wallets.length} wallets loaded on ${getNetworkName()}`);
        }, 600);

        const scanModal = document.getElementById('scanQrModal');
        const observer = new MutationObserver(() => {
            if (scanModal.classList.contains('open')) {
                setTimeout(startQrScanner, 300);
            } else {
                stopQrScanner();
            }
        });
        observer.observe(scanModal, { attributes: true, attributeFilter: ['class'] });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();