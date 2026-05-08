#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

import { SaymanWalletCLI } from './wallet-cli.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const program = new Command();

const CONFIG_PATH = path.join(
  process.env.HOME || process.env.USERPROFILE,
  '.sayman'
);

const WALLET_PATH = path.join(CONFIG_PATH, 'wallet.json');
const CLI_CONFIG_PATH = path.join(CONFIG_PATH, 'config.json');

if (!fs.existsSync(CONFIG_PATH)) {
  fs.mkdirSync(CONFIG_PATH, { recursive: true });
}

function loadConfig() {
  if (!fs.existsSync(CLI_CONFIG_PATH)) {
    return {
      api: 'https://sayman.onrender.com/api'
    };
  }

  return JSON.parse(fs.readFileSync(CLI_CONFIG_PATH, 'utf8'));
}

function saveConfig(config) {
  fs.writeFileSync(CLI_CONFIG_PATH, JSON.stringify(config, null, 2));
}

const cliConfig = loadConfig();

let API_BASE =
  process.env.SAYMAN_API ||
  cliConfig.api ||
  'https://sayman.onrender.com/api';

function loadWallet() {
  if (!fs.existsSync(WALLET_PATH)) {
    console.log(
      chalk.red(
        '\n❌ No wallet found. Create one with:\n\nsayman wallet create\n'
      )
    );

    process.exit(1);
  }

  return JSON.parse(fs.readFileSync(WALLET_PATH, 'utf8'));
}

function saveWallet(wallet) {
  fs.writeFileSync(WALLET_PATH, JSON.stringify(wallet, null, 2));
}

async function apiCall(endpoint, options = {}) {
  const spinner = ora('Processing...').start();

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    const data = await response.json();

    spinner.stop();

    if (!response.ok) {
      throw new Error(data.error || 'API request failed');
    }

    return data;
  } catch (error) {
    spinner.stop();

    console.log(chalk.red(`\n❌ Error: ${error.message}\n`));

    process.exit(1);
  }
}

async function buildSignedTransaction(walletData, txData) {
  const walletCLI = new SaymanWalletCLI(walletData.privateKey);

  await walletCLI.initialize();

  const signature = await walletCLI.signTransaction(txData);

  return {
    ...txData,
    signature,
    publicKey: walletData.publicKey
  };
}

program
  .name('sayman')
  .description('Sayman Blockchain CLI')
  .version('7.0.0');

const wallet = program
  .command('wallet')
  .description('Wallet management');

wallet
  .command('create')
  .description('Create new wallet')
  .action(async () => {
    const spinner = ora('Creating wallet...').start();

    try {
      const walletCLI = new SaymanWalletCLI();

      await walletCLI.initialize();

      const exported = walletCLI.export();

      saveWallet(exported);

      spinner.succeed(chalk.green('✅ Wallet created successfully'));

      console.log(chalk.cyan('\n━━━━━━━━━━━━━━━━━━━━━━━━━━'));
      console.log(chalk.bold('Address:'));
      console.log(chalk.white(exported.address));

      console.log(chalk.bold('\nPrivate Key:'));
      console.log(chalk.red(exported.privateKey));

      console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━'));

      console.log(
        chalk.yellow(
          '\n⚠️ SAVE YOUR PRIVATE KEY SECURELY\n'
        )
      );
    } catch (error) {
      spinner.fail(chalk.red(error.message));
    }
  });

wallet
  .command('import <privateKey>')
  .description('Import wallet')
  .action(async (privateKey) => {
    const spinner = ora('Importing wallet...').start();

    try {
      if (!/^[a-fA-F0-9]{64}$/.test(privateKey)) {
        throw new Error('Invalid private key format');
      }

      const walletCLI = new SaymanWalletCLI(privateKey);

      await walletCLI.initialize();

      const exported = walletCLI.export();

      saveWallet(exported);

      spinner.succeed(chalk.green('✅ Wallet imported'));

      console.log(chalk.bold('\nAddress:'));
      console.log(chalk.white(exported.address));
      console.log();
    } catch (error) {
      spinner.fail(chalk.red(error.message));
    }
  });

wallet
  .command('info')
  .description('Wallet information')
  .action(() => {
    const walletData = loadWallet();

    console.log(chalk.cyan('\n━━━━━━━━ Wallet ━━━━━━━━'));

    console.log(chalk.bold('Address:'));
    console.log(chalk.white(walletData.address));

    console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━\n'));
  });

wallet
  .command('export')
  .description('Export private key')
  .action(() => {
    const walletData = loadWallet();

    console.log(
      chalk.yellow('\n⚠️ NEVER SHARE THIS PRIVATE KEY\n')
    );

    console.log(chalk.red(walletData.privateKey));
    console.log();
  });

program
  .command('config <endpoint>')
  .description('Set API endpoint')
  .action((endpoint) => {
    saveConfig({
      api: endpoint
    });

    API_BASE = endpoint;

    console.log(
      chalk.green(`\n✅ API endpoint saved:\n${endpoint}\n`)
    );
  });

program
  .command('network')
  .description('Network information')
  .action(async () => {
    const network = await apiCall('/network');
    const stats = await apiCall('/stats');

    console.log(chalk.cyan('\n━━━━━━━━ Network ━━━━━━━━'));

    console.log(chalk.bold('Network:'));
    console.log(network.network);

    console.log(chalk.bold('\nChain ID:'));
    console.log(network.chainId);

    console.log(chalk.bold('\nBlocks:'));
    console.log(stats.blocks);

    console.log(chalk.bold('\nValidators:'));
    console.log(stats.validators);

    console.log(chalk.bold('\nTotal Stake:'));
    console.log(`${stats.totalStake} SAYM`);

    console.log(chalk.bold('\nMin Stake:'));
    console.log(`${network.minStake} SAYM`);

    console.log(chalk.bold('\nAPI Endpoint:'));
    console.log(API_BASE);

    console.log(chalk.cyan('\n━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
  });

program
  .command('balance [address]')
  .description('Check balance')
  .action(async (address) => {
    if (!address) {
      const walletData = loadWallet();

      address = walletData.address;
    }

    const data = await apiCall(`/address/${address}`);

    console.log(chalk.cyan('\n━━━━━━━━ Balance ━━━━━━━━'));

    console.log(chalk.bold('Address:'));
    console.log(address);

    console.log(chalk.bold('\nBalance:'));
    console.log(chalk.green(`${data.balance} SAYM`));

    console.log(chalk.bold('\nStake:'));
    console.log(chalk.yellow(`${data.stake} SAYM`));

    console.log(chalk.bold('\nNonce:'));
    console.log(data.nonce);

    console.log(chalk.cyan('\n━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
  });

program
  .command('send <to> <amount>')
  .description('Send SAYM')
  .option('-g, --gas-limit <limit>', 'Gas limit', '50000')
  .option('-p, --gas-price <price>', 'Gas price', '1')
  .action(async (to, amount, options) => {
    const walletData = loadWallet();

    const addressData = await apiCall(
      `/address/${walletData.address}`
    );

    const txData = {
      type: 'TRANSFER',
      data: {
        from: walletData.address,
        to,
        amount: parseFloat(amount)
      },
      timestamp: Date.now(),
      gasLimit: parseInt(options.gasLimit),
      gasPrice: parseInt(options.gasPrice),
      nonce: addressData.nonce
    };

    const signedTx = await buildSignedTransaction(
      walletData,
      txData
    );

    const result = await apiCall('/broadcast', {
      method: 'POST',
      body: JSON.stringify(signedTx)
    });

    console.log(
      chalk.green('\n✅ Transaction broadcast successfully')
    );

    console.log(chalk.bold('\nTX ID:'));
    console.log(result.txId);

    console.log();
  });

program
  .command('stake <amount>')
  .description('Stake SAYM')
  .option('-g, --gas-limit <limit>', 'Gas limit', '100000')
  .option('-p, --gas-price <price>', 'Gas price', '1')
  .action(async (amount, options) => {
    const walletData = loadWallet();

    const addressData = await apiCall(
      `/address/${walletData.address}`
    );

    const txData = {
      type: 'STAKE',
      data: {
        from: walletData.address,
        amount: parseFloat(amount)
      },
      timestamp: Date.now(),
      gasLimit: parseInt(options.gasLimit),
      gasPrice: parseInt(options.gasPrice),
      nonce: addressData.nonce
    };

    const signedTx = await buildSignedTransaction(
      walletData,
      txData
    );

    const result = await apiCall('/broadcast', {
      method: 'POST',
      body: JSON.stringify(signedTx)
    });

    console.log(chalk.green('\n✅ Stake broadcast'));

    console.log(chalk.bold('\nTX ID:'));
    console.log(result.txId);

    console.log();
  });

program
  .command('unstake')
  .description('Unstake SAYM')
  .option('-g, --gas-limit <limit>', 'Gas limit', '100000')
  .option('-p, --gas-price <price>', 'Gas price', '1')
  .action(async (options) => {
    const walletData = loadWallet();

    const addressData = await apiCall(
      `/address/${walletData.address}`
    );

    const txData = {
      type: 'UNSTAKE',
      data: {
        from: walletData.address
      },
      timestamp: Date.now(),
      gasLimit: parseInt(options.gasLimit),
      gasPrice: parseInt(options.gasPrice),
      nonce: addressData.nonce
    };

    const signedTx = await buildSignedTransaction(
      walletData,
      txData
    );

    const result = await apiCall('/broadcast', {
      method: 'POST',
      body: JSON.stringify(signedTx)
    });

    console.log(chalk.green('\n✅ Unstake broadcast'));

    console.log(chalk.bold('\nTX ID:'));
    console.log(result.txId);

    console.log();
  });

program
  .command('validators')
  .description('List validators')
  .action(async () => {
    const data = await apiCall('/validators');

    const table = new Table({
      head: ['Address', 'Stake', '%', 'Missed']
    });

    data.validators.forEach((v) => {
      table.push([
        `${v.address.substring(0, 16)}...`,
        `${v.stake} SAYM`,
        `${v.percentage}%`,
        v.missedBlocks
      ]);
    });

    console.log(chalk.cyan('\n━━━━━━ Validators ━━━━━━\n'));

    console.log(table.toString());

    console.log();
  });

program.parse();