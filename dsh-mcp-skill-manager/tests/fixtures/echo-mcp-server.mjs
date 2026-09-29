/**
 * 最小 stdio MCP 服务器，只用于状态探测的测试与演示。
 *
 * 实现协议要求的三个环节：`initialize` 握手、`tools/list` 列举、以及忽略
 * `notifications/initialized`。线上传输是「一行一个 JSON-RPC 报文」。
 *
 * 用法：node tests/fixtures/echo-mcp-server.mjs
 */
import { createInterface } from 'node:readline';

const TOOLS = [
  {
    name: 'echo',
    description: 'Echo the given text back',
    inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
  },
  {
    name: 'ping',
    description: 'Always answers pong',
    inputSchema: { type: 'object', properties: {} },
  },
];

const send = (value) => process.stdout.write(`${JSON.stringify(value)}\n`);

createInterface({ input: process.stdin }).on('line', (line) => {
  const text = line.trim();
  if (text === '') return;
  let message;
  try {
    message = JSON.parse(text);
  } catch {
    return;
  }
  if (message.method === 'initialize') {
    send({
      jsonrpc: '2.0',
      id: message.id,
      result: {
        protocolVersion: message.params?.protocolVersion ?? '2025-06-18',
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'echo-mcp-fixture', version: '1.0.0' },
      },
    });
    return;
  }
  if (message.method === 'notifications/initialized') return;
  if (message.method === 'tools/list') {
    send({ jsonrpc: '2.0', id: message.id, result: { tools: TOOLS } });
    return;
  }
  if (message.method === 'ping') {
    send({ jsonrpc: '2.0', id: message.id, result: {} });
    return;
  }
  if (message.id !== undefined) {
    send({ jsonrpc: '2.0', id: message.id, error: { code: -32601, message: `Method not found: ${message.method}` } });
  }
});
