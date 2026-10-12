// 日志里的地址识别：点一下就交给默认浏览器打开，所以「哪一段算地址」必须钉死。
// 运行：node ./tests/urls.test.js
import { firstUrl, linkify } from '../src/client/urls.js';

let passed = 0;
const failures = [];
const check = (label, condition, detail = '') => {
  if (condition) passed += 1;
  else failures.push(`${label}${detail === '' ? '' : ` — ${detail}`}`);
};
const eq = (label, actual, expected) => check(label, Object.is(actual, expected), `期望 ${JSON.stringify(expected)}，实得 ${JSON.stringify(actual)}`);
const links = (text) => linkify(text).filter((token) => token.href !== undefined);
const hrefs = (text) => links(text).map((token) => token.href);

/* ── 基本命中 ─────────────────────────────────────────────────────────── */

eq('http 地址被识别', hrefs('Local:   http://localhost:5173/').length, 1);
eq('https 地址被识别', hrefs('https://example.com/x')[0], 'https://example.com/x');
eq('一句话里两个地址都识别', hrefs('a http://a.com/ b https://b.com/').length, 2);
eq('大小写 scheme 也认（href 规范化成小写主机）', hrefs('HTTP://X.COM/A')[0], 'http://x.com/A');
eq('显示文本保持原样、不改写日志', links('HTTP://X.COM/A')[0].text, 'HTTP://X.COM/A');
check('没有地址时只有一个纯文本 token', linkify('no urls here').length === 1 && linkify('no urls here')[0].href === undefined);

/* ── 句末标点 / 括号：不属于地址 ───────────────────────────────────────── */

eq('句末句号不进地址', hrefs('see http://x.com/a.')[0], 'http://x.com/a');
check('被剥掉的句号仍在纯文本里', linkify('see http://x.com/a.').at(-1).text === '.');
eq('中文句号不进地址', hrefs('见 http://localhost:3000。')[0], 'http://localhost:3000/');
eq('外层括号不进地址', hrefs('(http://x.com/a)')[0], 'http://x.com/a');
check('外层括号仍在纯文本里', linkify('(http://x.com/a)')[0].text === '(');
eq('地址自身的成对括号保留', hrefs('http://en.wikipedia.org/wiki/Foo_(bar)')[0], 'http://en.wikipedia.org/wiki/Foo_(bar)');
eq('markdown 星号不进地址', hrefs('**http://x.com**')[0], 'http://x.com/');

/* ── 开发服务常见写法：主机:端口 ──────────────────────────────────────── */

eq('localhost:port 补 http', hrefs('listening on localhost:8080')[0], 'http://localhost:8080/');
eq('127.0.0.1:port 补 http', hrefs('127.0.0.1:3000/ready?x=1&y=2')[0], 'http://127.0.0.1:3000/ready?x=1&y=2');
eq('内网 IP:port 补 http（Vite 的 Network 那行经常只写主机端口）', hrefs('listen 192.168.1.5:8080')[0], 'http://192.168.1.5:8080/');
eq('0.0.0.0 通配地址换成回环（浏览器连不上通配地址）', hrefs('Listening on 0.0.0.0:8080')[0], 'http://127.0.0.1:8080/');
eq('0.0.0.0 的显示文本保持原样', links('Listening on 0.0.0.0:8080')[0].text, '0.0.0.0:8080');
eq('[::1]:port 补 http', hrefs('http://[::1]:8080/x')[0], 'http://[::1]:8080/x');
check('裸域名不认（文件名/包名更多）', hrefs('see foo.com and bar.io').length === 0);
check('不带端口的裸 IP 不认（无从判断是不是服务）', hrefs('ids 1.2.3.4 done').length === 0);
check('版本号不认（1.2.3.4.5）', hrefs('version 1.2.3.4.5 shipped').length === 0);

/* ── 残片不成链接 ─────────────────────────────────────────────────────── */

check('只有 scheme 不算地址', hrefs('https:// alone').length === 0);
check('中文文本里只命中地址本身', hrefs('重启 http://localhost:3000 完成')[0] === 'http://localhost:3000/');

/* ── 不变量：token 拼回来必须等于原文（渲染不能吃掉字符）───────────────── */

for (const text of [
  'plain 中文\n第二行',
  'Local:   http://localhost:5173/ ready',
  'see http://x.com/a. 然后 (http://y.com/b)',
  'http://en.wikipedia.org/wiki/Foo_(bar)',
  'listening on localhost:8080',
  '',
]) {
  const joined = linkify(text).map((token) => token.text).join('');
  eq(`拼接不变：${JSON.stringify(text.slice(0, 24))}`, joined, text);
}

/* ── firstUrl ─────────────────────────────────────────────────────────── */

eq('firstUrl 取第一个地址', firstUrl('a localhost:1 b https://b.com/'), 'http://localhost:1/');
eq('firstUrl 没有地址时 undefined', firstUrl('nothing'), undefined);

/* ── 结果 ─────────────────────────────────────────────────────────────── */

if (failures.length > 0) {
  console.error(`urls: ${failures.length} 项失败\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log(`urls: ${passed} 项通过`);
