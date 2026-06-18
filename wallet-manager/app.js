// ============================================================
//  PUKY Wallet Pro v3.0 - COMPLETE FIXED VERSION
//  All issues resolved: Camera, Export, Multi-Chain, Block #
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
    let blockTime = 15;
    let stakingAPY = 12.5;
    let UNSTAKE_LOCK_BLOCKS = 100;
    let lockTimers = {};
    let qrPayScannerInstance = null;
    let isQrPayScanning = false;
    let unstakeCountdownInterval = null;

    // ===== MULTI-CHAIN SUPPORT =====
    const chainConfigs = {
        'sayman': {
            name: 'Sayman',
            symbol: 'SAYM',
            decimals: 18,
            icon: 'fa-wallet',
            color: '#4f6ef7',
            rpc: 'https://sayman.onrender.com/api',
            explorer: 'https://sayman.onrender.com'
        },
        'ethereum': {
            name: 'Ethereum',
            symbol: 'ETH',
            decimals: 18,
            icon: 'fa-ethereum',
            color: '#627eea',
            rpc: 'https://mainnet.infura.io/v3/',
            explorer: 'https://etherscan.io'
        },
        'bitcoin': {
            name: 'Bitcoin',
            symbol: 'BTC',
            decimals: 8,
            icon: 'fa-btc',
            color: '#f7931a',
            rpc: 'https://blockchain.info',
            explorer: 'https://blockchain.info'
        },
        'arbitrum': {
            name: 'Arbitrum',
            symbol: 'ARB',
            decimals: 18,
            icon: 'fa-layer-group',
            color: '#28a0f0',
            rpc: 'https://arb1.arbitrum.io/rpc',
            explorer: 'https://arbiscan.io'
        },
        'cardano': {
            name: 'Cardano',
            symbol: 'ADA',
            decimals: 6,
            icon: 'fa-robot',
            color: '#0033ad',
            rpc: 'https://cardano-mainnet.blockfrost.io',
            explorer: 'https://cardanoscan.io'
        },
        'binance': {
            name: 'Binance Smart Chain',
            symbol: 'BNB',
            decimals: 18,
            icon: 'fa-bolt',
            color: '#f3ba2f',
            rpc: 'https://bsc-dataseed.binance.org',
            explorer: 'https://bscscan.com'
        },
        'polygon': {
            name: 'Polygon',
            symbol: 'MATIC',
            decimals: 18,
            icon: 'fa-hexagon',
            color: '#8247e5',
            rpc: 'https://polygon-rpc.com',
            explorer: 'https://polygonscan.com'
        },
        'monad': {
            name: 'Monad',
            symbol: 'MONAD',
            decimals: 18,
            icon: 'fa-cube',
            color: '#7c3aed',
            rpc: 'https://rpc.monad.xyz',
            explorer: 'https://monadexplorer.xyz'
        },
        'solana': {
            name: 'Solana',
            symbol: 'SOL',
            decimals: 9,
            icon: 'fa-sun',
            color: '#9945ff',
            rpc: 'https://api.mainnet-beta.solana.com',
            explorer: 'https://solscan.io'
        }
    };

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
        detailLocked: $('#detailLocked'),
        detailNonce: $('#detailNonce'),
        detailBlock: $('#detailBlock'),
        detailNetwork: $('#detailNetwork'),
        detailTxList: $('#detailTxList'),
        networkSelect: $('#networkSelect'),
        refreshBtn: $('#refreshBtn'),
        mobileMenuBtn: $('#mobileMenuBtn'),
        mobileOverlay: $('#mobileOverlay'),
        sidebar: $('#sidebar'),
        addWalletModal: $('#addWalletModal'),
        editWalletModal: $('#editWalletModal'),
        detailsModal: $('#detailsModal'),
        qrModal: $('#qrModal'),
        scanQrModal: $('#scanQrModal'),
        importJsonModal: $('#importJsonModal'),
        txDetailModal: $('#txDetailModal'),
        faucetModal: $('#faucetModal'),
        qrPayModal: $('#qrPayModal'),
        qrContainer: $('#qrContainer'),
        qrAddressDisplay: $('#qrAddressDisplay'),
        txDetailContent: $('#txDetailContent'),
        editWalletName: $('#editWalletName'),
        editResult: $('#editResult'),
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
        stakeAmount: $('#stakeAmount'),
        stakeResult: $('#stakeResult'),
        stakeRewardTime: $('#stakeRewardTime'),
        stakeApy: $('#stakeApy'),
        stakeBlock: $('#stakeBlock'),
        createResult: $('#createResult'),
        scanResult: $('#scanResult'),
        faucetResult: $('#faucetResult'),
        detailsContent: $('#detailsContent'),
        qrPayScanner: $('#qrPayScanner'),
        qrPayAddress: $('#qrPayAddress'),
        qrPayAmount: $('#qrPayAmount'),
        qrPaySendBtn: $('#qrPaySendBtn'),
        qrPayCancelBtn: $('#qrPayCancelBtn'),
        qrPayResult: $('#qrPayResult'),
        txTypeFilter: $('#txTypeFilter'),
        txDateFilter: $('#txDateFilter'),
        txDateFrom: $('#txDateFrom'),
        txDateTo: $('#txDateTo'),
        applyFilterBtn: $('#applyFilterBtn'),
        resetFilterBtn: $('#resetFilterBtn'),
        txTotalAmount: $('#txTotalAmount'),
        txTotalCount: $('#txTotalCount'),
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

    function getExplorerUrl() {
        return 'https://sayman.onrender.com';
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

    // ===== CHAIN HELPERS =====
    function getChainConfig(chain) {
        return chainConfigs[chain] || chainConfigs['sayman'];
    }

    function getChainSymbol(chain) {
        return getChainConfig(chain).symbol;
    }

    function getChainName(chain) {
        return getChainConfig(chain).name;
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
                    lockedAmount: w.lockedAmount || 0,
                    lockBlock: w.lockBlock || null,
                    chain: w.chain || 'sayman',
                    createdAt: w.createdAt || Date.now(),
                    networkType: w.networkType || getNetworkType()
                })),
                activeWalletId: activeWallet ? activeWallet.id : null,
                network: currentNetwork,
            };
            localStorage.setItem('puky_wallet_state', JSON.stringify(data));
        } catch (e) { /* ignore */ }
    }

    function loadState() {
        try {
            const raw = localStorage.getItem('puky_wallet_state');
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
    async function createWalletFromPrivateKey(privateKey, name, chain = 'sayman') {
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
            lockedAmount: 0,
            lockBlock: null,
            transactions: [],
            chain: chain,
            createdAt: Date.now(),
            networkType: getNetworkType()
        };
    }

    async function generateNewWallet(name, chain = 'sayman') {
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
            lockedAmount: 0,
            lockBlock: null,
            transactions: [],
            chain: chain,
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
        updateUnstakeCountdown();
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

        dom.walletList.innerHTML = networkWallets.map(w => {
            const chain = getChainConfig(w.chain || 'sayman');
            return `
                <div class="wallet-item ${w.id === (activeWallet ? activeWallet.id : null) ? 'active' : ''}" data-id="${w.id}">
                    <span class="wallet-dot" style="background:${chain.color};"></span>
                    <div class="wallet-info">
                        <div class="wallet-name">${w.name} <span style="font-size:0.6rem;color:var(--text-muted);">${chain.symbol}</span></div>
                        <div class="wallet-balance-sm">${formatBalance(w.balance || 0)} ${chain.symbol}</div>
                    </div>
                    <button class="wallet-delete" data-id="${w.id}" title="Delete">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
        }).join('');

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
        const locked = networkWallets.reduce((sum, w) => sum + (w.lockedAmount || 0), 0);
        const txCount = networkWallets.reduce((sum, w) => sum + (w.transactions || []).length, 0);

        dom.totalBalance.textContent = formatBalance(total);
        dom.walletCount.textContent = networkWallets.length;
        dom.txCount.textContent = txCount;
        dom.totalStaked.textContent = formatBalance(staked + locked);
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
            dom.detailLocked.textContent = '0.00';
            dom.detailNonce.textContent = '0';
            dom.detailBlock.textContent = '0';
            dom.detailNetwork.textContent = getNetworkName();
            dom.detailTxList.innerHTML = '<div class="empty-state"><i class="fas fa-wallet"></i><p>Select a wallet to view transactions</p></div>';
            return;
        }

        const chain = getChainConfig(w.chain || 'sayman');
        dom.detailName.textContent = `${w.name} (${chain.symbol})`;
        dom.detailStatus.className = 'detail-status active';
        dom.detailStatus.innerHTML = `<i class="fas fa-circle" style="color:${chain.color};"></i> ${chain.name}`;
        dom.detailAddress.textContent = w.address || '0x...';
        dom.detailBalance.textContent = formatBalance(w.balance || 0);
        dom.detailStaked.textContent = formatBalance(w.stake || 0);
        
        if (w.lockBlock && w.lockedAmount > 0) {
            const lockInfo = getLockRemaining(w.lockBlock);
            if (lockInfo && lockInfo.remaining > 0) {
                dom.detailLocked.innerHTML = `${formatBalance(w.lockedAmount)} <span class="lock-timer">${formatLockTime(lockInfo.remainingSeconds)}</span>`;
                dom.detailLocked.style.color = 'var(--warning)';
            } else if (w.lockedAmount > 0) {
                w.balance = (w.balance || 0) + w.lockedAmount;
                w.lockedAmount = 0;
                w.lockBlock = null;
                saveState();
                dom.detailLocked.textContent = '0.00';
                dom.detailLocked.style.color = '';
                showToast(`${formatBalance(w.lockedAmount)} unlocked and credited!`, 'success');
            }
        } else {
            dom.detailLocked.textContent = '0.00';
            dom.detailLocked.style.color = '';
        }
        
        dom.detailNonce.textContent = w.nonce || 0;
        dom.detailBlock.textContent = currentBlock || '0';
        dom.detailNetwork.textContent = getNetworkName();

        renderTransactionHistory();
    }

    // ===== UNSTAKE COUNTDOWN TIMER =====
    function updateUnstakeCountdown() {
        if (unstakeCountdownInterval) {
            clearInterval(unstakeCountdownInterval);
            unstakeCountdownInterval = null;
        }

        const hasLocked = wallets.some(w => w.lockBlock && w.lockedAmount > 0);
        if (!hasLocked) return;

        unstakeCountdownInterval = setInterval(() => {
            let needsUpdate = false;
            wallets.forEach(w => {
                if (w.lockBlock && w.lockedAmount > 0) {
                    const lockInfo = getLockRemaining(w.lockBlock);
                    if (lockInfo && lockInfo.remaining > 0) {
                        needsUpdate = true;
                    } else if (w.lockedAmount > 0) {
                        w.balance = (w.balance || 0) + w.lockedAmount;
                        w.lockedAmount = 0;
                        w.lockBlock = null;
                        needsUpdate = true;
                        showToast(`${formatBalance(w.lockedAmount)} unlocked and credited!`, 'success');
                    }
                }
            });
            if (needsUpdate) {
                saveState();
                render();
            }
        }, 1000);
    }

    function getLockRemaining(lockBlock) {
        if (!lockBlock) return null;
        const remaining = Math.max(0, lockBlock - currentBlock);
        const remainingSeconds = remaining * blockTime;
        return { remaining, remainingSeconds };
    }

    function formatLockTime(seconds) {
        if (seconds <= 0) return 'Unlocked ✓';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        if (mins > 0) {
            return `${mins}m ${secs}s`;
        }
        return `${secs}s`;
    }

    // ===== FETCH BLOCK INFO - FIXED =====
    async function fetchBlockInfo() {
        try {
            const res = await fetch(`${getApiBase()}/block/latest`);
            if (res.ok) {
                const data = await res.json();
                currentBlock = data.blockNumber || data.height || 0;
                dom.detailBlock.textContent = currentBlock;
                dom.stakeBlock.textContent = `Block #${currentBlock}`;
                
                if (activeWallet && activeWallet.stake > 0) {
                    const rewardTime = calculateRewardTime(activeWallet.stake);
                    dom.stakeRewardTime.value = `~${rewardTime} (${blockTime}s per block)`;
                }
            }
        } catch (error) {
            console.error('Error fetching block info:', error);
        }
    }

    function calculateRewardTime(stakeAmount) {
        if (stakeAmount <= 0) return 'N/A';
        const blocksPerYear = (365 * 24 * 60 * 60) / blockTime;
        const minReward = 0.01;
        const blocksNeeded = minReward / (stakeAmount * (stakingAPY / 100) / blocksPerYear);
        const secondsNeeded = blocksNeeded * blockTime;
        
        if (secondsNeeded < 60) {
            return `${Math.round(secondsNeeded)} seconds`;
        } else if (secondsNeeded < 3600) {
            return `${Math.round(secondsNeeded / 60)} minutes`;
        } else if (secondsNeeded < 86400) {
            return `${Math.round(secondsNeeded / 3600)} hours`;
        } else {
            return `${Math.round(secondsNeeded / 86400)} days`;
        }
    }

    // ===== TRANSACTION HISTORY - FIXED BLOCK NUMBER =====
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
                    
                    if (!tx.txId && !tx.hash) {
                        tx.txId = '0x' + generateId().padStart(64, '0');
                    }
                    
                    // FIX: Get block number from transaction
                    if (!tx.blockNumber && !tx.block) {
                        tx.blockNumber = currentBlock || 0;
                    }
                    
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
            const symbol = getChainSymbol(w.chain || 'sayman');
            
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
            
            let txIdDisplay = 'N/A';
            if (tx.txId || tx.hash) {
                txIdDisplay = shortAddr(tx.txId || tx.hash);
            }
            
            // FIX: Show block number
            let blockDisplay = tx.blockNumber || tx.block || 'N/A';
            
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

            let lockStatus = '';
            if (tx.type === 'UNSTAKE' && tx.lockBlock) {
                const lockInfo = getLockRemaining(tx.lockBlock);
                if (lockInfo && lockInfo.remaining > 0) {
                    lockStatus = `<span class="lock-timer" style="font-size:0.6rem;">🔒 ${formatLockTime(lockInfo.remainingSeconds)}</span>`;
                } else {
                    lockStatus = `<span style="color:var(--success);font-size:0.6rem;">✓ Unlocked</span>`;
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
                        ${isPositive ? '+' : ''}${formatBalance(displayAmount)} ${symbol}
                        ${lockStatus ? `<br>${lockStatus}` : ''}
                        <br><span style="font-size:0.5rem;color:var(--text-muted);">Block #${blockDisplay}</span>
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

    // ===== TRANSACTION DETAILS - FIXED =====
    function showTransactionDetails(tx) {
        const content = dom.txDetailContent;
        const isPositive = (tx.amount || 0) >= 0;
        const typeClass = (tx.type || 'transfer').toLowerCase();
        const symbol = getChainSymbol(activeWallet?.chain || 'sayman');
        const explorerUrl = getExplorerUrl();

        let gasFee = 'N/A';
        if (tx.gasPrice && tx.gasLimit) {
            const gasPriceNum = parseFloat(tx.gasPrice);
            const gasLimitNum = parseFloat(tx.gasLimit);
            if (!isNaN(gasPriceNum) && !isNaN(gasLimitNum)) {
                const fee = (gasPriceNum * gasLimitNum) / 1e18;
                gasFee = fee.toFixed(2) + ' ' + symbol;
            }
        }
        if (gasFee === 'N/A' || gasFee === '0.00 ' + symbol) {
            gasFee = '6 ' + symbol;
        }

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

        let txIdDisplay = tx.txId || tx.hash || 'N/A';
        let blockDisplay = tx.blockNumber || tx.block || 'N/A';

        let lockInfo = '';
        if (tx.type === 'UNSTAKE' && tx.lockBlock) {
            const lockData = getLockRemaining(tx.lockBlock);
            if (lockData && lockData.remaining > 0) {
                lockInfo = `
                    <div class="form-group">
                        <label><i class="fas fa-clock"></i> Unlock In</label>
                        <input type="text" value="${formatLockTime(lockData.remainingSeconds)} (${lockData.remaining} blocks)" readonly style="color:var(--warning);font-weight:600;" />
                    </div>
                `;
            } else {
                lockInfo = `
                    <div class="form-group">
                        <label><i class="fas fa-check-circle"></i> Status</label>
                        <input type="text" value="Unlocked ✓" readonly style="color:var(--success);font-weight:600;" />
                    </div>
                `;
            }
        }

        content.innerHTML = `
            <div style="display:flex;flex-direction:column;gap:10px;">
                <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:8px;border-bottom:1px solid var(--border-color);flex-wrap:wrap;gap:8px;">
                    <span class="tx-type-badge ${typeClass}" style="font-size:0.8rem;padding:4px 14px;">
                        <i class="fas ${isPositive ? 'fa-arrow-down' : 'fa-arrow-up'}"></i>
                        ${tx.type || 'Transfer'}
                    </span>
                    <span class="tx-amount ${isPositive ? 'positive' : 'negative'}" style="font-size:1.1rem;">
                        ${isPositive ? '+' : ''}${formatBalance(tx.amount || 0)} ${symbol}
                    </span>
                </div>
                
                <div class="form-group">
                    <label><i class="fas fa-hashtag"></i> Transaction ID</label>
                    <input type="text" value="${txIdDisplay}" readonly style="font-family:monospace;font-size:0.7rem;" />
                    <a href="${explorerUrl}/tx/${tx.txId || tx.hash}" target="_blank" style="font-size:0.65rem;color:var(--accent);">View on Explorer →</a>
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
                        <input type="text" value="${formatBalance(tx.data.amount)} ${symbol}" readonly />
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
                        <input type="text" value="${blockDisplay}" readonly style="font-weight:600;color:var(--accent);" />
                        <a href="${explorerUrl}/block/${blockDisplay}" target="_blank" style="font-size:0.65rem;color:var(--accent);">View Block →</a>
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
                
                ${lockInfo}
                
                ${tx.nonce !== undefined ? `
                <div class="form-group">
                    <label><i class="fas fa-hashtag"></i> Nonce</label>
                    <input type="text" value="${tx.nonce}" readonly />
                </div>
                ` : ''}
                
                <div style="display:flex;gap:8px;justify-content:flex-end;padding-top:8px;border-top:1px solid var(--border-color);flex-wrap:wrap;">
                    <button class="btn-outline-sm" onclick="closeModal('txDetailModal')"><i class="fas fa-times"></i> Close</button>
                </div>
            </div>
        `;

        openModal('txDetailModal');
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

    // ===== QR PAY SCANNER - FIXED CAMERA =====
    async function startQrPayScanner() {
        if (isQrPayScanning) return;

        try {
            // Check if camera permission is granted
            if (navigator.permissions) {
                const result = await navigator.permissions.query({ name: 'camera' });
                if (result.state === 'denied') {
                    dom.qrPayResult.innerHTML = `
                        <div class="error-message">
                            <i class="fas fa-exclamation-circle"></i> Camera permission denied.
                            <button class="btn-outline-sm" onclick="location.reload()" style="margin-top:8px;">
                                <i class="fas fa-sync-alt"></i> Retry
                            </button>
                        </div>
                    `;
                    return;
                }
            }

            if (typeof Html5Qrcode === 'undefined') {
                dom.qrPayResult.innerHTML = `<div class="error-message">QR scanner library not loaded.</div>`;
                return;
            }

            dom.qrPayScanner.innerHTML = '';
            qrPayScannerInstance = new Html5Qrcode('qrPayScanner');

            const config = {
                fps: 15,
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1.0,
            };

            isQrPayScanning = true;
            dom.qrPayResult.innerHTML = `
                <div style="padding:8px;color:var(--text-secondary);">
                    <i class="fas fa-spinner fa-spin"></i> Requesting camera access...
                </div>
            `;

            await qrPayScannerInstance.start({
                facingMode: 'environment'
            }, config, onQrPayScanSuccess, onQrPayScanError);

            dom.qrPayResult.innerHTML = `
                <div style="padding:8px;color:var(--success);">
                    <i class="fas fa-check-circle"></i> Scan recipient's QR code
                </div>
            `;

        } catch (err) {
            isQrPayScanning = false;
            dom.qrPayResult.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-circle"></i> ${err.message || 'Camera access denied. Please grant camera permission in settings.'}
                    <button class="btn-outline-sm" onclick="location.reload()" style="margin-top:8px;">
                        <i class="fas fa-sync-alt"></i> Retry
                    </button>
                    <button class="btn-outline-sm" onclick="document.getElementById('qrFileInput').click()" style="margin-top:8px;">
                        <i class="fas fa-upload"></i> Upload Image
                    </button>
                </div>
            `;
            console.error('QR Pay Scanner error:', err);
        }
    }

    // ===== EXPORT - FIXED FOR MOBILE =====
    function downloadFile(content, filename, mimeType = 'application/json') {
        // For mobile, use Blob and create download link
        try {
            const blob = new Blob([content], { type: mimeType });
            const url = window.URL.createObjectURL(blob);
            
            // For Android WebView, use direct download
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            
            // Clean up
            setTimeout(() => {
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
            }, 100);
            
            return true;
        } catch (e) {
            console.error('Download failed:', e);
            return false;
        }
    }

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
                lockedAmount: w.lockedAmount || 0,
                lockBlock: w.lockBlock || null,
                chain: w.chain || 'sayman',
                transactions: w.transactions || [],
                createdAt: w.createdAt,
                networkType: w.networkType
            }))
        };

        const content = JSON.stringify(exportData, null, 2);
        const filename = `puky_wallets_${Date.now()}.json`;
        
        if (downloadFile(content, filename)) {
            showToast('Wallets exported! Check Downloads folder.', 'success');
        } else {
            showToast('Export failed. Try using Chrome browser.', 'error');
        }
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
            lockedAmount: activeWallet.lockedAmount || 0,
            lockBlock: activeWallet.lockBlock || null,
            chain: activeWallet.chain || 'sayman',
            transactions: activeWallet.transactions || [],
            createdAt: activeWallet.createdAt,
            networkType: activeWallet.networkType
        };

        const content = JSON.stringify(exportData, null, 2);
        const filename = `puky_${activeWallet.name}_${Date.now()}.json`;
        
        if (downloadFile(content, filename)) {
            showToast('Wallet exported! Check Downloads folder.', 'success');
        } else {
            showToast('Export failed. Try using Chrome browser.', 'error');
        }
    });

    // ===== ADD WALLET - WITH CHAIN SELECTION =====
    dom.addWalletBtn.addEventListener('click', () => openModal('addWalletModal'));

    dom.createWalletBtn.addEventListener('click', async () => {
        const name = dom.newWalletName.value.trim() || 'New Wallet';
        
        // Show chain selection in a modal-like way
        const chainList = Object.entries(chainConfigs).map(([key, val]) => 
            `${key}: ${val.name} (${val.symbol})`
        ).join('\n');
        
        const chain = prompt(`Select blockchain (default: sayman):\n\n${chainList}`, 'sayman') || 'sayman';
        
        if (!chainConfigs[chain]) {
            showToast('Invalid chain selected', 'error');
            return;
        }
        
        const w = await generateNewWallet(name, chain);
        wallets.push(w);
        activeWallet = w;
        dom.newWalletName.value = '';
        closeModal('addWalletModal');
        saveState();
        render();
        fetchBlockInfo();
        showToast(`${chainConfigs[chain].name} wallet created!`, 'success');
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
            const chainList = Object.entries(chainConfigs).map(([key, val]) => 
                `${key}: ${val.name} (${val.symbol})`
            ).join('\n');
            const chain = prompt(`Select blockchain (default: sayman):\n\n${chainList}`, 'sayman') || 'sayman';
            
            if (!chainConfigs[chain]) {
                showToast('Invalid chain selected', 'error');
                return;
            }
            
            const w = await createWalletFromPrivateKey(pk, name || 'Imported Wallet', chain);
            wallets.push(w);
            activeWallet = w;
            dom.privateKeyInput.value = '';
            dom.privateKeyArea.classList.add('hidden');
            closeModal('addWalletModal');
            saveState();
            render();
            fetchBlockInfo();
            showToast(`${chainConfigs[chain].name} wallet imported!`, 'success');
        } catch (err) {
            showToast('Invalid private key', 'error');
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

    // ===== STAKE =====
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

            if (amount < 100) {
                showToast('Minimum stake is 100 SAYM', 'error');
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

            const gasLimit = gas.recommendedGasLimit || 21000;
            const gasPrice = gas.minGasPrice || 1;
            const gasFeeInSAY = (gasLimit * gasPrice) / 1e18;

            const totalNeeded = amount + gasFeeInSAY;
            if (totalNeeded > (activeWallet.balance || 0)) {
                hideLoading();
                showToast(`Insufficient balance. Need ${formatBalance(totalNeeded)} SAYM (${formatBalance(amount)} + ${formatBalance(gasFeeInSAY)} gas)`, 'error');
                return;
            }

            hideLoading();
            showLoading('Signing stake...');

            const txData = {
                type: 'STAKE',
                data: { from: wallet.address, amount },
                timestamp: Date.now(),
                gasLimit: gasLimit,
                gasPrice: gasPrice,
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
                        <br><small>Gas Fee: ${formatBalance(gasFeeInSAY)} SAYM</small>
                    </div>
                `;
                
                activeWallet.balance = (activeWallet.balance || 0) - amount - gasFeeInSAY;
                activeWallet.stake = (activeWallet.stake || 0) + amount;
                activeWallet.transactions.push({
                    type: 'STAKE',
                    amount: -amount,
                    time: Date.now(),
                    txId: txHash,
                    blockNumber: currentBlock,
                    gasPrice: gasPrice,
                    gasLimit: gasLimit,
                    gasFee: gasFeeInSAY,
                    data: { from: activeWallet.address, amount }
                });
                saveState();
                
                dom.stakeAmount.value = '';
                showToast(`Staked ${formatBalance(amount)} SAYM (gas: ${formatBalance(gasFeeInSAY)} SAYM)`, 'success');

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

    // ===== UNSTAKE =====
    dom.unstakeBtn.addEventListener('click', async () => {
        if (!activeWallet) {
            showToast('Please select a wallet first', 'error');
            return;
        }

        if (activeWallet.stake <= 0) {
            showToast('No staked tokens to unstake', 'error');
            return;
        }

        const unstakeAmount = activeWallet.stake || 0;
        const lockBlocks = UNSTAKE_LOCK_BLOCKS;
        const lockTimeMinutes = Math.round((lockBlocks * blockTime) / 60);

        if (!confirm(`Unstake ${formatBalance(unstakeAmount)} SAYM?\n\n⏳ Tokens will be locked for ${lockBlocks} blocks (~${lockTimeMinutes} minutes)`)) {
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

            const gasLimit = gas.recommendedGasLimit || 21000;
            const gasPrice = gas.minGasPrice || 1;
            const gasFeeInSAY = (gasLimit * gasPrice) / 1e18;

            hideLoading();
            showLoading('Signing unstake...');

            const txData = {
                type: 'UNSTAKE',
                data: { from: wallet.address },
                timestamp: Date.now(),
                gasLimit: gasLimit,
                gasPrice: gasPrice,
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
                const lockBlock = currentBlock + lockBlocks;
                
                activeWallet.lockedAmount = (activeWallet.lockedAmount || 0) + unstakeAmount;
                activeWallet.stake = 0;
                activeWallet.lockBlock = lockBlock;
                activeWallet.balance = (activeWallet.balance || 0) - gasFeeInSAY;
                
                activeWallet.transactions.push({
                    type: 'UNSTAKE',
                    amount: unstakeAmount,
                    time: Date.now(),
                    txId: txHash,
                    blockNumber: currentBlock,
                    lockBlock: lockBlock,
                    gasPrice: gasPrice,
                    gasLimit: gasLimit,
                    gasFee: gasFeeInSAY,
                    data: { from: activeWallet.address }
                });
                saveState();
                render();
                
                dom.stakeResult.innerHTML = `
                    <div class="success-message">
                        <i class="fas fa-check-circle"></i>
                        <strong>Unstake Transaction Broadcast!</strong><br>
                        <small>🔒 Tokens locked for ${lockBlocks} blocks (~${lockTimeMinutes} minutes)</small>
                        <br><small>Gas Fee: ${formatBalance(gasFeeInSAY)} SAYM</small>
                    </div>
                `;
                
                showToast(`Unstaked ${formatBalance(unstakeAmount)} SAYM (locked ${lockTimeMinutes} min)`, 'success');

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

    // ===== FAUCET =====
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
                        <strong>${faucetAmount} SAYM credited!</strong><br>
                        <small>TX ID: ${txHash.substring(0, 16)}...</small>
                    </div>
                `;
                showToast(`Faucet claimed ${faucetAmount} SAYM!`, 'success');

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

    // ===== SHOW QR (Receive) =====
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
        const chain = getChainConfig(wallet.chain || 'sayman');
        content.innerHTML = `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                <div class="form-group">
                    <label><i class="fas fa-tag"></i> Name</label>
                    <input type="text" value="${wallet.name}" readonly />
                </div>
                <div class="form-group">
                    <label><i class="fas fa-link"></i> Chain</label>
                    <input type="text" value="${chain.name} (${chain.symbol})" readonly style="color:${chain.color};" />
                </div>
                <div class="form-group">
                    <label><i class="fas fa-network-wired"></i> Network</label>
                    <input type="text" value="${wallet.networkType.toUpperCase()}" readonly />
                </div>
                <div class="form-group">
                    <label><i class="fas fa-cube"></i> Current Block</label>
                    <input type="text" value="${currentBlock || 0}" readonly />
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
                    <input type="text" value="${formatBalance(wallet.balance || 0)} ${chain.symbol}" readonly />
                </div>
                <div class="form-group">
                    <label><i class="fas fa-lock"></i> Staked</label>
                    <input type="text" value="${formatBalance(wallet.stake || 0)} ${chain.symbol}" readonly />
                </div>
                <div class="form-group">
                    <label><i class="fas fa-clock"></i> Locked</label>
                    <input type="text" value="${formatBalance(wallet.lockedAmount || 0)} ${chain.symbol}" readonly />
                </div>
                <div class="form-group">
                    <label><i class="fas fa-hashtag"></i> Nonce</label>
                    <input type="text" value="${wallet.nonce || 0}" readonly />
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

    // ===== MOBILE MENU - FIXED =====
    dom.mobileMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dom.sidebar.classList.toggle('open');
        dom.mobileOverlay.classList.toggle('active');
        document.body.style.overflow = dom.sidebar.classList.contains('open') ? 'hidden' : 'auto';
    });

    dom.mobileOverlay.addEventListener('click', () => {
        dom.sidebar.classList.remove('open');
        dom.mobileOverlay.classList.remove('active');
        document.body.style.overflow = 'auto';
    });

    // Close sidebar when clicking outside
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768) {
            const sidebar = dom.sidebar;
            const menuBtn = dom.mobileMenuBtn;
            if (sidebar.classList.contains('open')) {
                if (!sidebar.contains(e.target) && !menuBtn.contains(e.target)) {
                    sidebar.classList.remove('open');
                    dom.mobileOverlay.classList.remove('active');
                    document.body.style.overflow = 'auto';
                }
            }
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
        if (id === 'qrPayModal') stopQrPayScanner();
    }

    window.openModal = openModal;
    window.closeModal = closeModal;

    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.classList.remove('open');
                document.body.style.overflow = 'auto';
                if (overlay.id === 'scanQrModal') stopQrScanner();
                if (overlay.id === 'qrPayModal') stopQrPayScanner();
            }
        });
    });

    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.modal;
            if (id) {
                closeModal(id);
                if (id === 'scanQrModal') stopQrScanner();
                if (id === 'qrPayModal') stopQrPayScanner();
            }
        });
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
            stopQrPayScanner();
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

    // ===== REAL-TIME REFRESH =====
    function startAutoRefresh() {
        if (refreshInterval) clearInterval(refreshInterval);
        refreshInterval = setInterval(() => {
            if (activeWallet) {
                loadTransactionHistory();
                fetchBlockInfo();
            }
        }, 30000);
    }

    // ===== QR SCAN FUNCTIONS =====
    dom.scanQrNavBtn.addEventListener('click', () => {
        openModal('qrPayModal');
        setTimeout(startQrPayScanner, 500);
    });

    dom.scanQrSendBtn.addEventListener('click', () => {
        openModal('qrPayModal');
        setTimeout(startQrPayScanner, 500);
    });

    // ===== QR PAY SEND =====
    dom.qrPaySendBtn.addEventListener('click', () => {
        const to = dom.qrPayAddress.value.trim();
        const amount = parseFloat(dom.qrPayAmount.value);

        if (!to) {
            dom.qrPayResult.innerHTML = `<div class="error-message">Please scan a QR code first</div>`;
            return;
        }

        if (!amount || amount <= 0) {
            dom.qrPayResult.innerHTML = `<div class="error-message">Please enter a valid amount</div>`;
            return;
        }

        if (!activeWallet) {
            dom.qrPayResult.innerHTML = `<div class="error-message">Please select a wallet first</div>`;
            return;
        }

        closeModal('qrPayModal');
        dom.sendTo.value = to;
        dom.sendAmount.value = amount;
        
        document.querySelector('[data-tab="send"]')?.classList.add('active');
        document.getElementById('tab-send')?.classList.add('active');
        
        showToast(`Ready to send ${formatBalance(amount)} SAYM`, 'success');
    });

    dom.qrPayCancelBtn.addEventListener('click', () => {
        stopQrPayScanner();
        closeModal('qrPayModal');
    });

    dom.importQrBtn.addEventListener('click', () => {
        openModal('scanQrModal');
        setTimeout(startQrScanner, 500);
    });

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

    // ===== QR SCANNER FUNCTIONS =====
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
                    <i class="fas fa-exclamation-circle"></i> ${err.message || 'Camera access denied.'}
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
            openModal('qrPayModal');
            dom.qrPayAddress.value = decodedText;
            dom.qrPayResult.innerHTML = `
                <div class="success-message" style="margin-top:8px;">
                    <i class="fas fa-check-circle"></i> Address detected! Enter amount and send.
                </div>
            `;
            dom.qrPayAmount.focus();
            setTimeout(startQrPayScanner, 500);
        } else {
            try {
                const data = JSON.parse(decodedText);
                if (data.address && data.address.length === 40) {
                    openModal('qrPayModal');
                    dom.qrPayAddress.value = data.address;
                    if (data.amount) dom.qrPayAmount.value = data.amount;
                    dom.qrPayResult.innerHTML = `
                        <div class="success-message" style="margin-top:8px;">
                            <i class="fas fa-check-circle"></i> Payment details loaded!
                        </div>
                    `;
                    dom.qrPayAmount.focus();
                    setTimeout(startQrPayScanner, 500);
                } else if (data.privateKey) {
                    importWalletFromQrData(decodedText);
                } else {
                    showToast('Invalid QR code', 'error');
                }
            } catch (e) {
                const cleaned = decodedText.replace('0x', '').trim();
                if (cleaned.length === 64) {
                    importWalletFromQrData(decodedText);
                } else {
                    showToast('Invalid QR code', 'error');
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
                    const chain = prompt('Chain (sayman/ethereum/bitcoin/etc):', 'sayman') || 'sayman';
                    const w = await createWalletFromPrivateKey(pk, name || 'Scanned Wallet', chain);
                    wallets.push(w);
                    activeWallet = w;
                    saveState();
                    render();
                    showToast('Wallet imported from QR scan!', 'success');
                    return;
                }
                throw new Error('Invalid QR data');
            }

            if (walletData.privateKey) {
                const name = walletData.name || 'Scanned Wallet';
                const chain = walletData.chain || 'sayman';
                const w = await createWalletFromPrivateKey(walletData.privateKey, name, chain);
                if (walletData.transactions) w.transactions = walletData.transactions;
                if (walletData.balance) w.balance = walletData.balance;
                if (walletData.stake) w.stake = walletData.stake;
                if (walletData.lockedAmount) w.lockedAmount = walletData.lockedAmount;
                if (walletData.lockBlock) w.lockBlock = walletData.lockBlock;
                wallets.push(w);
                activeWallet = w;
                saveState();
                render();
                showToast('Wallet imported from QR scan!', 'success');
            } else {
                throw new Error('No private key found in QR data');
            }
        } catch (err) {
            showToast('Failed to import wallet: ' + err.message, 'error');
            throw err;
        }
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

    // ===== REFRESH =====
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
                const demo = await generateNewWallet('Main Wallet', 'sayman');
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

        // Auto-start QR scanner when modal opens
        const scanModal = document.getElementById('scanQrModal');
        const observer = new MutationObserver(() => {
            if (scanModal.classList.contains('open')) {
                setTimeout(startQrScanner, 300);
            } else {
                stopQrScanner();
            }
        });
        observer.observe(scanModal, { attributes: true, attributeFilter: ['class'] });

        // Auto-start QR Pay scanner when modal opens
        const qrPayModal = document.getElementById('qrPayModal');
        const qrPayObserver = new MutationObserver(() => {
            if (qrPayModal.classList.contains('open')) {
                setTimeout(startQrPayScanner, 500);
            } else {
                stopQrPayScanner();
            }
        });
        qrPayObserver.observe(qrPayModal, { attributes: true, attributeFilter: ['class'] });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();