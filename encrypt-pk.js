#!/usr/bin/env node
/**
 * GAIAI 自动机器人 - 私钥加密工具
 * 用于加密 pk.txt 中的私钥
 * 
 * 使用方法:
 * node encrypt-pk.js
 */

import AccountEncryptor from './encryptor.js';
import chalk from 'chalk';
import cfonts from 'cfonts';
import gradient from 'gradient-string';

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
  
  printHeader('私钥加密工具');
  console.log(chalk.yellow('🔐 此工具将加密您的私钥文件以增强安全性'));
  console.log(chalk.gray('📝 加密完成后，原始 pk.txt 文件将被删除'));
  console.log(chalk.gray('💾 系统会自动创建 pk_backup.txt 作为备份'));
  console.log('');

  const encryptor = new AccountEncryptor();

  // 检查是否已有加密文件
  if (await encryptor.hasEncryptedFile()) {
    console.log(chalk.yellow('⚠️  检测到已存在加密文件!'));
    const choice = await askQuestion(chalk.cyan('是否要重新加密? (y/n): '));
    if (choice.toLowerCase() !== 'y') {
      console.log(chalk.gray('操作已取消'));
      return;
    }
  }

  // 检查原始文件是否存在
  try {
    const fs = (await import('fs/promises')).default;
    await fs.access('pk.txt');
  } catch (error) {
    console.log(chalk.red('❌ 错误: pk.txt 文件不存在!'));
    console.log(chalk.gray('请确保 pk.txt 文件存在于当前目录'));
    return;
  }

  // 获取密码
  let password;
  while (true) {
    password = await askQuestion(chalk.cyan('请输入加密密码: '));
    if (!password.trim()) {
      console.log(chalk.red('❌ 密码不能为空!'));
      continue;
    }

    const confirmPassword = await askQuestion(chalk.cyan('请确认密码: '));
    if (password !== confirmPassword) {
      console.log(chalk.red('❌ 两次输入的密码不一致!'));
      continue;
    }

    break;
  }

  console.log('');
  console.log(chalk.yellow('🔄 正在加密私钥文件...'));

  // 执行加密
  if (await encryptor.encryptPrivateKeys(password)) {
    console.log('');
    printHeader('加密完成');
    printInfo('加密文件', 'pk_encrypted.txt');
    printInfo('备份文件', 'pk_backup.txt');
    printInfo('原始文件', 'pk.txt (已删除)');
    console.log('');
    console.log(chalk.green('🎉 加密完成!'));
    console.log(chalk.yellow('🔐 请妥善保管您的密码，没有密码将无法解密私钥!'));
    console.log(chalk.blue('📁 原始文件已备份为 pk_backup.txt'));
    console.log(chalk.red('🗑️  原始 pk.txt 文件已删除，私钥已安全加密存储'));
    console.log('');
    console.log(chalk.cyan('现在可以运行以下命令来使用加密的私钥:'));
    console.log(chalk.white('  node index.js'));
  } else {
    console.log('');
    console.log(chalk.red('❌ 加密失败!'));
    console.log(chalk.gray('请检查错误信息并重试'));
  }
}

// 运行主函数
main().catch(error => {
  console.error(chalk.red('❌ 程序错误:'), error.message);
  process.exit(1);
});
