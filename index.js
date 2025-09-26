import axios from 'axios';
import cfonts from 'cfonts';
import gradient from 'gradient-string';
import chalk from 'chalk';
import fs from 'fs/promises';
import readline from 'readline';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';
import ProgressBar from 'progress';
import ora from 'ora';
import { ethers } from 'ethers';
import AccountEncryptor from './encryptor.js';

const logger = {
  info: (msg, options = {}) => {
    const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const emoji = options.emoji || 'ℹ️  ';
    const context = options.context ? `[${options.context}] ` : '';
    const level = chalk.green('信息');
    const formattedMsg = `[ ${chalk.gray(timestamp)} ] ${emoji}${level} ${chalk.white(context.padEnd(20))}${chalk.white(msg)}`;
    console.log(formattedMsg);
  },
  warn: (msg, options = {}) => {
    const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const emoji = options.emoji || '⚠️  ';
    const context = options.context ? `[${options.context}] ` : '';
    const level = chalk.yellow('警告');
    const formattedMsg = `[ ${chalk.gray(timestamp)} ] ${emoji}${level} ${chalk.white(context.padEnd(20))}${chalk.white(msg)}`;
    console.log(formattedMsg);
  },
  error: (msg, options = {}) => {
    const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const emoji = options.emoji || '❌  ';
    const context = options.context ? `[${options.context}] ` : '';
    const level = chalk.red('错误');
    const formattedMsg = `[ ${chalk.gray(timestamp)} ] ${emoji}${level} ${chalk.white(context.padEnd(20))}${chalk.white(msg)}`;
    console.log(formattedMsg);
  }
};

function delay(seconds) {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

function stripAnsi(str) {
  return str.replace(/\x1B\[[0-9;]*m/g, '');
}

function centerText(text, width) {
  const cleanText = stripAnsi(text);
  const textLength = cleanText.length;
  const totalPadding = Math.max(0, width - textLength);
  const leftPadding = Math.floor(totalPadding / 2);
  const rightPadding = totalPadding - leftPadding;
  return `${' '.repeat(leftPadding)}${text}${' '.repeat(rightPadding)}`;
}

function printHeader(title) {
  const width = 80;
  console.log(gradient.morning(`┬${'─'.repeat(width - 2)}┬`));
  console.log(gradient.morning(`│ ${title.padEnd(width - 4)} │`));
  console.log(gradient.morning(`┴${'─'.repeat(width - 2)}┴`));
}

function printInfo(label, value, context) {
  logger.info(`${label.padEnd(15)}: ${chalk.cyan(value)}`, { emoji: '📍 ', context });
}

async function formatTaskTable(tasks, context) {
  console.log('\n');
  logger.info('任务列表:', { context, emoji: '📋 ' });
  console.log('\n');

  const spinner = ora('正在渲染任务...').start();
  await new Promise(resolve => setTimeout(resolve, 1000));
  spinner.stop();

  const header = chalk.cyanBright('+----------------------+----------+-------+---------+\n| 任务名称             | 类别     | 积分  | 状态    |\n+----------------------+----------+-------+---------+');
  const rows = tasks.map(task => {
    const displayName = task.name && typeof task.name === 'string'
      ? (task.name.length > 20 ? task.name.slice(0, 17) + '...' : task.name)
      : '未知任务';
    const category = ((task.type || '无') + '     ').slice(0, 8);
    const points = ((task.credit || 0).toString() + '    ').slice(0, 5);
    const status = task.completed ? chalk.greenBright('已完成') : chalk.yellowBright('等待中');
    return `| ${displayName.padEnd(20)} | ${category} | ${points} | ${status.padEnd(6)} |`;
  }).join('\n');
  const footer = chalk.cyanBright('+----------------------+----------+-------+---------+');

  console.log(header + '\n' + rows + '\n' + footer);
  console.log('\n');
}

const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Firefox/102.0'
];

function getRandomUserAgent() {
  return userAgents[Math.floor(Math.random() * userAgents.length)];
}

function getGlobalHeaders(token = null) {
  const headers = {
    'accept': 'application/json, text/plain, */*',
    'accept-encoding': 'gzip, deflate, br, zstd',
    'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8,id;q=0.7,fr;q=0.6,ru;q=0.5,zh-CN;q=0.4,zh;q=0.3',
    'cache-control': 'no-cache',
    'connection': 'keep-alive',
    'content-type': 'application/json',
    'host': 'api.metagaia.io',
    'lang': 'en-US',
    'origin': 'https://www.gaiai.io',
    'pragma': 'no-cache',
    'referer': 'https://www.gaiai.io/',
    'sec-ch-ua': '"Opera";v="120", "Not-A.Brand";v="8", "Chromium";v="135"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'cross-site',
    'signature': Date.now().toString(),
    'user-agent': getRandomUserAgent()
  };
  if (token) {
    headers['token'] = token;
  }
  return headers;
}

function getIpHeaders() {
  return {
    'accept': 'application/json, text/plain, */*',
    'accept-encoding': 'gzip, deflate, br',
    'accept-language': 'en-US,en;q=0.9',
    'user-agent': getRandomUserAgent()
  };
}

function getAxiosConfig(proxy, token = null) {
  const config = {
    headers: getGlobalHeaders(token),
    timeout: 60000
  };
  if (proxy) {
    config.httpsAgent = newAgent(proxy);
    config.proxy = false;
  }
  return config;
}

function newAgent(proxy) {
  if (proxy.startsWith('http://') || proxy.startsWith('https://')) {
    return new HttpsProxyAgent(proxy);
  } else if (proxy.startsWith('socks4://') || proxy.startsWith('socks5://')) {
    return new SocksProxyAgent(proxy);
  } else {
    logger.warn(`不支持的代理: ${proxy}`);
    return null;
  }
}

async function requestWithRetry(method, url, payload = null, config = {}, retries = 3, backoff = 2000, context) {
  for (let i = 0; i < retries; i++) {
    try {
      let response;
      if (method.toLowerCase() === 'get') {
        response = await axios.get(url, config);
      } else if (method.toLowerCase() === 'post') {
        response = await axios.post(url, payload, config);
      } else {
        throw new Error(`不支持的方法 ${method}`);
      }
      return { success: true, response: response.data };
    } catch (error) {
      const status = error.response?.status;
      if (status === 400 || status === 404) {
        return { success: false, message: error.response?.data?.message || '错误请求', status };
      }
      if (i < retries - 1) {
        logger.warn(`重试 ${method.toUpperCase()} ${url} (${i + 1}/${retries})`, { emoji: '🔄  ', context });
        await delay(backoff / 1000);
        backoff *= 1.5;
        continue;
      }
      logger.error(`请求失败: ${error.message} - 状态: ${status}`, { context });
      return { success: false, message: error.message, status };
    }
  }
}

const BASE_URL = 'https://api.metagaia.io';

async function readPrivateKeys() {
  try {
    const encryptor = new AccountEncryptor();
    
    // 检查是否存在加密文件
    if (await encryptor.hasEncryptedFile()) {
      logger.info('检测到加密私钥文件，需要输入密码解密', { emoji: '🔐 ' });
      
      // 获取解密密码
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      const password = await new Promise(resolve => {
        rl.question('请输入私钥解密密码: ', resolve);
      });
      rl.close();
      
      if (!password.trim()) {
        logger.error('密码不能为空', { emoji: '❌ ' });
        return [];
      }
      
      const decryptedKeys = await encryptor.decryptPrivateKeys(password);
      if (decryptedKeys) {
        logger.info(`已解密并加载 ${decryptedKeys.length} 个私钥`, { emoji: '🔓 ' });
        return decryptedKeys;
      } else {
        logger.error('解密私钥失败', { emoji: '❌ ' });
        return [];
      }
    } else {
      // 读取普通 pk.txt 文件
      const data = await fs.readFile('pk.txt', 'utf-8');
      const pks = data.split('\n').map(line => line.trim()).filter(line => line.length > 0 && !line.startsWith('#'));
      logger.info(`已加载 ${pks.length} 个私钥`, { emoji: '📄 ' });
      return pks;
    }
  } catch (error) {
    logger.error(`读取私钥失败: ${error.message}`, { emoji: '❌ ' });
    return [];
  }
}

async function readProxies() {
  try {
    const data = await fs.readFile('proxy.txt', 'utf-8');
    const proxies = data.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    if (proxies.length === 0) {
      logger.warn('未找到代理服务器，将不使用代理继续执行。', { emoji: '⚠️  ' });
    } else {
      logger.info(`已加载 ${proxies.length} 个代理服务器`, { emoji: '🌐  ' });
    }
    return proxies;
  } catch (error) {
    logger.warn('未找到 proxy.txt 文件。', { emoji: '⚠️ ' });
    return [];
  }
}

async function readPrompts() {
  try {
    const data = await fs.readFile('prompt.txt', 'utf-8');
    const prompts = data.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    logger.info(`已加载 ${prompts.length} 个提示词`, { emoji: '📄 ' });
    return prompts;
  } catch (error) {
    logger.error(`读取 prompt.txt 失败: ${error.message}`, { emoji: '❌ ' });
    return [];
  }
}

async function getPublicIP(proxy, context) {
  try {
    const config = { headers: getIpHeaders(), timeout: 60000 };
    if (proxy) {
      config.httpsAgent = newAgent(proxy);
      config.proxy = false;
    }
    const response = await requestWithRetry('get', 'https://api.ipify.org?format=json', null, config, 3, 2000, context);
    return response.response.ip || 'Unknown';
  } catch (error) {
    logger.error(`获取IP失败: ${error.message}`, { emoji: '❌  ', context });
    return '获取IP出错';
  }
}

async function loginWithWallet(pk, proxy, context) {
  const spinner = ora({ text: '正在使用钱包登录...', spinner: 'dots' }).start();
  try {
    let cleanedPk = pk.trim();
    if (cleanedPk.startsWith('0x')) {
      cleanedPk = cleanedPk.slice(2);
    }
    if (cleanedPk.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(cleanedPk)) {
      throw new Error('私钥格式无效。');
    }
    const fullPk = '0x' + cleanedPk;

    const wallet = new ethers.Wallet(fullPk);
    const address = wallet.address.toLowerCase();

    const nonceConfig = getAxiosConfig(proxy);
    delete nonceConfig.headers.token;
    delete nonceConfig.headers.signature;

    const nonceRes = await requestWithRetry('get', `${BASE_URL}/api/v2/gaiai-login/wallet-nonce?address=${address}`, null, nonceConfig, 3, 2000, context);
    if (!nonceRes.success || nonceRes.response.code !== 0) {
      throw new Error(nonceRes.message || '获取随机数失败');
    }
    const { nonce } = nonceRes.response.data;
    if (!nonce) {
      throw new Error('响应中缺少随机数');
    }

    const time = new Date().toISOString();
    const message = `GaiAI Login\nAddress: ${address}\nNonce: ${nonce}\nTime: ${time}`;

    const signature = await wallet.signMessage(nonce);

    const payload = { address, signature, message, name: 'metamask', inviteCode: 'Y9WH14' };

    const authConfig = getAxiosConfig(proxy);
    delete authConfig.headers.token;
    delete authConfig.headers.signature;

    const authRes = await requestWithRetry('post', `${BASE_URL}/api/v2/gaiai-login/wallet`, payload, authConfig, 3, 2000, context);
    if (!authRes.success || authRes.response.code !== 0) {
      throw new Error(authRes.response?.message || authRes.message || '身份验证失败');
    }
    if (!authRes.response.data || !authRes.response.data.token) {
      throw new Error('身份验证响应中缺少令牌');
    }
    const token = authRes.response.data.token;

    spinner.stop();
    return { token, address };
  } catch (error) {
    spinner.fail(`登录失败: ${error.message}`);
    return { error: error.message };
  }
}

async function performCheckin(token, proxy, context) {
  const spinner = ora({ text: '正在执行签到...', spinner: 'dots' }).start();
  try {
    const res = await requestWithRetry('post', `${BASE_URL}/api/v1/gaiai-sign`, {}, getAxiosConfig(proxy, token), 3, 2000, context);
    if (res.success && res.response.code === 0) {
      spinner.succeed(chalk.bold.greenBright('  签到成功'));
      return { success: true, data: res.response.data };
    } else {
      spinner.warn(chalk.bold.yellowBright(`  ${res.response.message || '今日已签到'}`));
      return { success: false, message: res.response.message || '已签到' };
    }
  } catch (error) {
    spinner.fail(chalk.bold.redBright(`  签到失败: ${error.message}`));
    return { success: false, message: error.message };
  }
}

async function completePrompt(token, prompts, proxy, context) {
  const spinner = ora({ text: '正在完成提示词任务...', spinner: 'dots' }).start();
  try {
    if (prompts.length === 0) {
      throw new Error('没有可用的提示词');
    }
    const randomPrompt = prompts[Math.floor(Math.random() * prompts.length)];

    const aspectOptions = [
      { width: '1024', height: '576', aspectRatio: '4' },  
      { width: '1024', height: '768', aspectRatio: '2' },  
      { width: '1024', height: '1024', aspectRatio: '1' },
      { width: '768', height: '1024', aspectRatio: '6' }, 
      { width: '576', height: '1024', aspectRatio: '8' } 
    ];
    const randomAspect = aspectOptions[Math.floor(Math.random() * aspectOptions.length)];

    const payload = {
      type: '1',
      prompt: randomPrompt,
      width: randomAspect.width,
      height: randomAspect.height,
      aspectRatio: randomAspect.aspectRatio
    };

    const res = await requestWithRetry('post', `${BASE_URL}/api/v2/gaiai-ai/create-task`, payload, getAxiosConfig(proxy, token), 3, 2000, context);
    if (res.success && res.response.code === 0) {
      spinner.succeed(chalk.bold.greenBright('  提示词任务完成成功'));
      return { success: true, data: res.response.data };
    } else {
      spinner.warn(chalk.bold.yellowBright(`  ${res.response.message || '今日已完成'}`));
      return { success: false, message: res.response.message || '已完成' };
    }
  } catch (error) {
    spinner.fail(chalk.bold.redBright(`  提示词任务失败: ${error.message}`));
    return { success: false, message: error.message };
  }
}

async function fetchUserInfo(token, proxy, context) {
  try {
    const res = await requestWithRetry('get', `${BASE_URL}/api/v2/gaiai-user/profile`, null, getAxiosConfig(proxy, token), 3, 2000, context);
    if (!res.success || res.response.code !== 0) {
      throw new Error(res.message || '获取用户资料失败');
    }
    const data = res.response.data;
    return {
      username: data.username || '未知',
      gPoints: data.gPoints || '无'
    };
  } catch (error) {
    logger.error(`获取用户信息失败: ${error.message}`, { context });
    return { username: '未知', gPoints: '无' };
  }
}

async function processAccount(pk, index, total, prompts, proxy = null) {
  const context = `账户 ${index + 1}/${total}`;
  logger.info(chalk.bold.magentaBright(`开始处理账户`), { emoji: '🚀 ', context });

  printHeader(`账户信息 ${context}`);
  const ip = await getPublicIP(proxy, context);
  printInfo('IP地址', ip, context);
  let cleanedPk = pk.trim();
  if (cleanedPk.startsWith('0x')) {
    cleanedPk = cleanedPk.slice(2);
  }
  let address = 'N/A';
  try {
    if (cleanedPk.length === 64 && /^[0-9a-fA-F]{64}$/.test(cleanedPk)) {
      const signingKey = new ethers.SigningKey('0x' + cleanedPk);
      const publicKey = signingKey.publicKey;
      address = ethers.computeAddress(publicKey);
    } else {
      logger.warn('计算地址的私钥格式无效', { context });
    }
  } catch (error) {
    logger.warn(`计算地址失败: ${error.message}`, { context });
  }
  printInfo('地址', address, context);
  console.log('\n');

  const loginRes = await loginWithWallet(pk, proxy, context);
  if (loginRes.error) {
    logger.error(`由于登录错误跳过账户: ${loginRes.error}`, { context });
    return;
  }
  const { token } = loginRes;

  logger.info('开始签到流程...', { context });
  console.log('\n');
  const checkinRes = await performCheckin(token, proxy, context);

  console.log('\n');
  logger.info('开始提示词完成流程...', { context });
  console.log('\n');
  const promptRes = await completePrompt(token, prompts, proxy, context);

  const tasks = [
    { name: '日常签到', type: '签到', credit: checkinRes.data?.gPoints || 0, completed: checkinRes.success },
    { name: '生成提示词', type: '提示词', credit: promptRes.data?.rewardVal || 0, completed: promptRes.success }
  ];
  await formatTaskTable(tasks, context);

  printHeader(`账户统计 ${context}`);
  const userInfo = await fetchUserInfo(token, proxy, context);
  printInfo('用户名', userInfo.username, context);
  printInfo('G 积分', userInfo.gPoints, context);

  logger.info(chalk.bold.greenBright(`账户处理完成`), { emoji: '🎉 ', context });
}

async function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans);
  }));
}

let globalUseProxy = false;
let globalProxies = [];
let globalConcurrency = 1;

async function initializeConfig() {
  const useProxyAns = await askQuestion(chalk.cyanBright('🔌 是否使用代理? (y/n): '));
  if (useProxyAns.trim().toLowerCase() === 'y') {
    globalUseProxy = true;
    globalProxies = await readProxies();
    if (globalProxies.length === 0) {
      globalUseProxy = false;
      logger.warn('没有可用的代理服务器，将不使用代理继续执行。', { emoji: '⚠️ ' });
    }
  } else {
    logger.info('不使用代理继续执行。', { emoji: 'ℹ️ ' });
  }
  
  const concurrencyAns = await askQuestion(chalk.cyanBright('🚀 请输入并发数（默认为1，建议不超过3）: '));
  const concurrency = parseInt(concurrencyAns.trim()) || 1;
  globalConcurrency = Math.max(1, Math.min(concurrency, 10)); // 限制在1-10之间
  logger.info(`设置并发数为: ${globalConcurrency}`, { emoji: '⚙️ ' });
}

async function processAccountBatch(accounts, startIndex, totalAccounts, prompts) {
  const promises = accounts.map(async (pk, batchIndex) => {
    const accountIndex = startIndex + batchIndex;
    const proxy = globalUseProxy ? globalProxies[accountIndex % globalProxies.length] : null;
    try {
      await processAccount(pk, accountIndex, totalAccounts, prompts, proxy);
    } catch (error) {
      logger.error(`处理账户出错: ${error.message}`, { emoji: '❌ ', context: `账户 ${accountIndex + 1}` });
    }
  });
  
  await Promise.all(promises);
}

async function runCycle() {
  const pks = await readPrivateKeys();
  if (pks.length === 0) {
    logger.error('在 pk.txt 中未找到私钥。退出循环。', { emoji: '❌ ' });
    return;
  }
  const prompts = await readPrompts();
  if (prompts.length === 0) {
    logger.error('在 prompt.txt 中未找到提示词。退出循环。', { emoji: '❌ ' });
    return;
  }

  logger.info(`开始处理 ${pks.length} 个账户，并发数: ${globalConcurrency}`, { emoji: '🚀 ' });
  
  // 分批处理账户
  for (let i = 0; i < pks.length; i += globalConcurrency) {
    const batch = pks.slice(i, i + globalConcurrency);
    await processAccountBatch(batch, i, pks.length, prompts);
    
    if (i + globalConcurrency < pks.length) {
      console.log('\n\n');
      logger.info(`等待 5 秒后处理下一批账户...`, { emoji: '⏱️ ' });
      await delay(5);
    }
  }
  
  logger.info(`所有账户处理完成`, { emoji: '✅ ' });
}

async function run() {
  const terminalWidth = process.stdout.columns || 80;
  cfonts.say('GAIAI 自动日常机器人', {
    font: 'block',
    align: 'center',
    colors: ['cyan', 'magenta'],
    background: 'transparent',
    letterSpacing: 1,
    lineHeight: 1,
    space: true
  });
  console.log(gradient.retro(centerText('✪ GAIAI 自动日常机器人 ✪', terminalWidth)));
  console.log('\n');
  await initializeConfig();

  while (true) {
    await runCycle();
    logger.info(chalk.bold.yellowBright('循环完成。等待 12 小时...'), { emoji: '🔄 ' });
    await delay(43200);
  }
}

run().catch(error => logger.error(`致命错误: ${error.message}`, { emoji: '❌' }));