/**
 * dsh-win-notify 纯逻辑单测（不启动 dsh、不弹 Toast）：
 * 直接使用 createSessionEventHandler，注入 notify 收集器，验证
 *   - 只有 turn/end 触发；
 *   - notifyKinds 过滤（aborted 默认不通知）；
 *   - subagent 子会话默认被跳过，includeSubagents=true 时触发；
 *   - 模板渲染、error 详情、标题回退。
 * 另用 mock ctx 走真实 apply()（route: host），验证人工干预 waterfall
 * 监听器的透传行为（调用 next()、prepend 注册、不需要真实 PowerShell：
 * shellPath 指向不存在的可执行文件，只核对 verbose 日志与 next）。
 */
import {
  Config,
  apply,
  createSessionEventHandler,
  interventionBody,
  reasonLabel,
  renderTemplate,
  truncate,
} from '../index.js';

let pass = 0;
let fail = 0;
const check = (name, condition, extra = '') => {
  if (condition) pass += 1;
  else fail += 1;
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}${extra ? ` — ${extra}` : ''}`);
};

// ── 辅助函数 ────────────────────────────────────────────────
check('truncate 超长截断', truncate('x'.repeat(50), 10).length === 10);
check('reasonLabel(completed) = 完成', reasonLabel({ kind: 'completed' }) === '完成');
check('reasonLabel(error) 带详情', reasonLabel({ kind: 'error', error: { message: 'LLM 超时' } }) === '出错：LLM 超时');
check(
  'renderTemplate 占位符',
  renderTemplate('「{title}」第 {turn} 轮 · {reason}/{detail}', {
    title: 'T', turn: 2, reason: '完成', detail: '',
  }) === '「T」第 2 轮 · 完成/',
);

// ── 事件处理 ────────────────────────────────────────────────
const makeHandler = (overrides = {}) => {
  const fired = [];
  const config = Config({ ...overrides });
  const handler = createSessionEventHandler(
    config,
    (title, message) => fired.push({ title, message }),
    (session) => (session.title ? session.title : `会话 ${session.id.slice(0, 8)}`),
  );
  return { fired, handler };
};
const session = (origin, id = 'sess-abcdef12-3456', title) => ({ id, header: { origin }, title });

let { fired, handler } = makeHandler({ backend: 'powershell-toast', includeSubagents: false });

handler(session(undefined, 'sess-abcdef12-3456'), { type: 'turn/end', data: { turn: 3, reason: { kind: 'completed' } } });
check('completed 应触发一次', fired.length === 1);
check('标题回退为「会话 sess-abcd…」', fired[0]?.title.includes('会话 sess-') || fired[0]?.message.includes('会话 sess-'));

handler(session(undefined), { type: 'turn/end', data: { turn: 4, reason: { kind: 'aborted', reason: {} } } });
check('aborted 默认不通知', fired.length === 1);

handler(session(undefined), { type: 'user/message', data: {} });
check('非 turn/end 忽略', fired.length === 1);

handler(session('subagent'), { type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } });
check('subagent 默认跳过', fired.length === 1);

handler(session(undefined), { type: 'turn/end', data: { turn: 5, reason: { kind: 'error', error: { message: 'boom' } } } });
check('error 应触发', fired.length === 2);
check('error 详情在消息里', fired[1]?.message.includes('出错：boom'));

// includeSubagents = true
({ fired, handler } = makeHandler({ backend: 'powershell-toast', includeSubagents: true, notifyKinds: ['completed', 'error'] }));
handler(session('subagent'), { type: 'turn/end', data: { turn: 2, reason: { kind: 'error', error: { message: 'child boom' } } } });
check('includeSubagents=true 时子会话触发', fired.length === 1);

// notifyKinds 自定义
({ fired, handler } = makeHandler({ backend: 'powershell-toast', notifyKinds: ['completed'] }));
handler(session(undefined), { type: 'turn/end', data: { turn: 1, reason: { kind: 'blocked' } } });
check('notifyKinds=[completed] 时 blocked 跳过', fired.length === 0);

// 自定义模板
({ fired, handler } = makeHandler({ backend: 'powershell-toast', titleTemplate: '完成：{title}', messageTemplate: '第 {turn} 轮 · {reason}' }));
handler(session(undefined, 's', '修 bug'), { type: 'turn/end', data: { turn: 7, reason: { kind: 'completed' } } });
check('自定义模板生效', fired[0]?.title === '完成：修 bug' && fired[0]?.message === '第 7 轮 · 完成');

// ── 人工干预文案 ────────────────────────────────────────────
check('interventionBody(approval) 带工具与原因',
  interventionBody('approval', { toolName: 'bash', reason: '删除文件' }) === '需要审批（bash）：删除文件');
check('interventionBody(approval) 无原因',
  interventionBody('approval', { toolName: 'fs' }) === '需要审批：fs');
check('interventionBody(question) 单问题',
  interventionBody('question', { questions: [{ question: '选哪个模型？' }] }) === '需要回答：选哪个模型？');
check('interventionBody(question) 多问题带计数',
  interventionBody('question', { questions: [{ question: '确认？' }, { question: '再问？' }] }).includes('共 2 个问题'));
check('interventionBody(plan-review)',
  interventionBody('plan-review', { questions: [{ question: '请审查' }] }).startsWith('需要审查计划'));

// ── 宿主 apply 的人工干预 waterfall 透传 ────────────────────────────
{
  const handlers = {};
  const logs = [];
  const nextCalls = [];
  const ctx = {
    on(name, listener, options) {
      handlers[name] = { listener, options };
    },
    inject() {},
    get() { return undefined; },
    effect: () => () => {},
  };
  const originalLog = console.log;
  console.log = (...args) => logs.push(args.join(' '));
  try {
    apply(ctx, Config({
      route: 'host',
      // 指向不存在的可执行文件：验证阶段不会真的弹 Toast。
      shellPath: 'not-a-real-powershell.exe',
      interventions: true,
      verbose: true,
    }));

    const approval = handlers['approval/request'];
    const question = handlers['user-questions/request'];
    check('注册了 approval/request 监听器', typeof approval?.listener === 'function');
    check('注册了 user-questions/request 监听器', typeof question?.listener === 'function');
    check('prepend 注册（在既有消费者之前执行）', approval?.options?.prepend === true && question?.options?.prepend === true);
    // 模拟 waterfall 调用：透传 next，且发出通知。
    const next = () => { nextCalls.push('next'); return Promise.resolve('allowed-once'); };
    approval.listener({ toolName: 'bash', reason: '写文件' }, next);
    question.listener({ questions: [{ question: '确认部署？' }] }, next);
    check('透传调用 next()', nextCalls.length === 2);
    check('审批通知已发出（verbose 日志）', logs.some((line) => line.includes('需要审批（bash）') && line.includes('写文件')));
    check('提问通知已发出（verbose 日志）', logs.some((line) => line.includes('需要回答：确认部署？')));
  } finally {
    console.log = originalLog;
  }
}

console.log(`\n${pass}/${pass + fail} 通过`);
process.exit(fail ? 1 : 0);
