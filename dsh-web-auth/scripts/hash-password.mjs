/**
 * 生成可用于 DSH 设置文档 `web-auth` 命名空间的 scrypt 密码哈希。
 *
 * 用法：
 *   node scripts/hash-password.mjs <密码>
 *
 * 输出形如：
 *   scrypt$16384$8$1$<salt-base64>$<hash-base64>
 *
 * 把它写进 $DSH_HOME/settings.yaml：
 *   web-auth:
 *     users:
 *       - username: admin
 *         hash: scrypt$16384$8$1$...
 * 或写进 profile 补丁里覆盖 web-auth 行的 config（不推荐，见 README）。
 */
import { randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);

const password = process.argv[2];
if (password === undefined || password === '') {
  console.error('用法：node scripts/hash-password.mjs <密码>\n密码长度须为 8–128 位。');
  process.exit(1);
}
if (password.length < 8 || password.length > 128) {
  console.error('密码长度须为 8–128 位。');
  process.exit(1);
}

const N = 16384;
const r = 8;
const p = 1;
const keylen = 32;
const salt = randomBytes(16);
const key = await scrypt(password, salt, keylen, { N, r, p });
console.log(`scrypt$${N}$${r}$${p}$${salt.toString('base64')}$${key.toString('base64')}`);
