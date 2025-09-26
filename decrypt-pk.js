#!/usr/bin/env node
/**
 * GAIAI 自动机器人 - 私钥解密工具
 * 用于解密 pk_encrypted.txt 中的私钥
 * 
 * 使用方法:
 * node decrypt-pk.js
 */

import AccountEncryptor from './encryptor.js';
import chalk from 'chalk';
import cfonts from 'cfonts';
import gradient from 'gradient-string';
import fs from 'fs/promises';

function printHeader(title) {
  const width = 60;
  console.log(gradient.morning(`┬${'─'.repeat(width - 2)}┬`));
  console.log(gradient.morning(`│ ${title.padEnd(width - 4)} │`));
  console.log(gradient.morning(`┴${'─'.repeat(width - 2)}┴`));
}

function printInfo(label, value) {
  console.log(chalk.cyan(`📍 ${label.padEnd(15)}: ${chalk.white(value)}`));
}

async function askQuestion(query) {
  const readline = (await import('readline')).default;
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise(resolve => {
    rl.question(query, answer => {
      rl.close();
      resolve(answer);
    });
  });
}

async function main() {
  // 显示标题
  console.clear();
  cfonts.say('GAIAI', {
    font: 'block',
    align: 'center',
    colors: ['cyan', 'magenta'],
    background: 'transparent',
    letterSpacing: 1,
    lineHeight: 1,
    space: true
  });
  
  printHeader('私钥解密工具');
  console.log(chalk.yellow('🔓 此工具将解密您的私钥文件'));
  console.log('');

  const encryptor = new AccountEncryptor();

  // 检查是否存在加密文件
  if (!(await encryptor.hasEncryptedFile())) {
    console.log(chalk.red('❌ 错误: 未找到加密文件 pk_encrypted.txt!'));
    console.log(chalk.gray('请确保加密文件存在于当前目录'));
    return;
  }

  // 获取密码
  const password = await askQuestion(chalk.cyan('请输入解密密码: '));
  if (!password.trim()) {
    console.log(chalk.red('❌ 密码不能为空!'));
    return;
  }

  console.log('');
  console.log(chalk.yellow('🔄 正在解密私钥文件...'));

  // 执行解密
  const decryptedKeys = await encryptor.decryptPrivateKeys(password);
  if (decryptedKeys) {
    // 保存解密后的私钥到 pk.txt
    const pkContent = decryptedKeys.join('\n');
    await fs.writeFile('pk.txt', pkContent);
    
    console.log('');
    printHeader('解密完成');
    printInfo('解密私钥数量', decryptedKeys.length.toString());
    printInfo('输出文件', 'pk.txt');
    console.log('');
    console.log(chalk.green('🎉 解密完成!'));
    console.log(chalk.blue('📁 解密后的私钥已保存到 pk.txt'));
    console.log('');
    console.log(chalk.cyan('现在可以运行以下命令来使用解密后的私钥:'));
    console.log(chalk.white('  node index.js'));
  } else {
    console.log('');
    console.log(chalk.red('❌ 解密失败!'));
    console.log(chalk.gray('请检查密码是否正确'));
  }
}

// 运行主函数
main().catch(error => {
  console.error(chalk.red('❌ 程序错误:'), error.message);
  process.exit(1);
});
