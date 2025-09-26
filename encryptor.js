import crypto from 'crypto';
import fs from 'fs/promises';
import readline from 'readline';

class AccountEncryptor {
  constructor() {
    this.encryptedFile = 'pk_encrypted.txt';
    this.keyFile = 'encryption.key';
  }

  /**
   * 从密码生成加密密钥
   * @param {string} password 密码
   * @param {Buffer} salt 盐值
   * @returns {Buffer} 加密密钥
   */
  generateKeyFromPassword(password, salt) {
    return crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
  }

  /**
   * 加密私钥文件
   * @param {string} password 加密密码
   * @returns {Promise<boolean>} 是否成功
   */
  async encryptPrivateKeys(password) {
    try {
      // 检查 pk.txt 是否存在
      try {
        await fs.access('pk.txt');
      } catch (error) {
        console.log('❌ 错误: pk.txt 文件不存在!');
        return false;
      }

      // 读取原始私钥
      const data = await fs.readFile('pk.txt', 'utf-8');
      const privateKeys = data.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0 && !line.startsWith('#'));

      if (privateKeys.length === 0) {
        console.log('❌ 错误: pk.txt 文件为空或没有有效的私钥!');
        return false;
      }

      // 生成随机盐
      const salt = crypto.randomBytes(16);

      // 从密码生成密钥
      const key = this.generateKeyFromPassword(password, salt);
      const iv = crypto.randomBytes(16);

      // 加密所有私钥
      const encryptedKeys = [];
      for (const privateKey of privateKeys) {
        const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
        let encrypted = cipher.update(privateKey, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        encryptedKeys.push(encrypted);
      }

      // 保存加密后的数据
      const encryptedData = {
        salt: salt.toString('hex'),
        iv: iv.toString('hex'),
        keys: encryptedKeys,
        timestamp: new Date().toISOString()
      };

      await fs.writeFile(this.encryptedFile, JSON.stringify(encryptedData, null, 2));

      console.log(`✅ 成功加密 ${privateKeys.length} 个私钥到 ${this.encryptedFile}`);
      console.log('🔐 请妥善保管您的密码，没有密码将无法解密私钥!');

      // 备份原始文件
      await fs.copyFile('pk.txt', 'pk_backup.txt');
      console.log('📁 原始 pk.txt 已备份为 pk_backup.txt');
      
      // 删除原始私钥文件
      await fs.unlink('pk.txt');
      console.log('🗑️  原始 pk.txt 文件已删除，私钥已安全加密存储');

      return true;

    } catch (error) {
      console.log(`❌ 加密失败: ${error.message}`);
      return false;
    }
  }

  /**
   * 解密私钥文件
   * @param {string} password 解密密码
   * @returns {Promise<Array<string>|null>} 解密后的私钥数组或null
   */
  async decryptPrivateKeys(password) {
    try {
      try {
        await fs.access(this.encryptedFile);
      } catch (error) {
        console.log('❌ 错误: 加密文件不存在!');
        return null;
      }

      const encryptedData = JSON.parse(await fs.readFile(this.encryptedFile, 'utf-8'));
      const salt = Buffer.from(encryptedData.salt, 'hex');
      const iv = Buffer.from(encryptedData.iv, 'hex');
      const encryptedKeys = encryptedData.keys;

      // 从密码生成密钥
      const key = this.generateKeyFromPassword(password, salt);

      // 解密所有私钥
      const privateKeys = [];
      for (const encryptedKey of encryptedKeys) {
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        let decrypted = decipher.update(encryptedKey, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        privateKeys.push(decrypted);
      }

      return privateKeys;

    } catch (error) {
      console.log(`❌ 解密失败: ${error.message}`);
      return null;
    }
  }

  /**
   * 检查是否存在加密文件
   * @returns {Promise<boolean>} 是否存在加密文件
   */
  async hasEncryptedFile() {
    try {
      await fs.access(this.encryptedFile);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 删除加密文件
   * @returns {Promise<boolean>} 是否成功删除
   */
  async deleteEncryptedFile() {
    try {
      await fs.unlink(this.encryptedFile);
      return true;
    } catch (error) {
      return false;
    }
  }
}

/**
 * 安全地获取用户输入的密码
 * @param {string} prompt 提示信息
 * @returns {Promise<string>} 用户输入的密码
 */
function getPassword(prompt) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question(prompt, (password) => {
      rl.close();
      resolve(password);
    });
  });
}

/**
 * 主函数 - 加密工具
 */
async function main() {
  console.log('🔐 GAIAI 自动机器人 - 私钥加密工具');
  console.log('=' .repeat(50));

  const encryptor = new AccountEncryptor();

  // 检查是否已有加密文件
  if (await encryptor.hasEncryptedFile()) {
    console.log('⚠️  检测到已存在加密文件!');
    const choice = await getPassword('是否要重新加密? (y/n): ');
    if (choice.toLowerCase() !== 'y') {
      console.log('操作已取消');
      return;
    }
  }

  // 获取密码
  let password;
  while (true) {
    password = await getPassword('请输入加密密码: ');
    if (!password.trim()) {
      console.log('❌ 密码不能为空!');
      continue;
    }

    const confirmPassword = await getPassword('请确认密码: ');
    if (password !== confirmPassword) {
      console.log('❌ 两次输入的密码不一致!');
      continue;
    }

    break;
  }

  // 执行加密
  if (await encryptor.encryptPrivateKeys(password)) {
    console.log('\n🎉 加密完成!');
    console.log('现在可以运行 node index.js 来使用加密的私钥');
  } else {
    console.log('\n❌ 加密失败!');
  }
}

// 如果直接运行此文件，则执行主函数
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ 程序错误:', error.message);
    process.exit(1);
  });
}

export default AccountEncryptor;
