import React from 'react';
import { parseAnsi } from '../ansi.js';
import { linkify } from '../urls.js';
import type { Translator } from '../types.js';

/** 单条日志在面板里的保留上限，与宿主的 logTailChars 默认值一致。 */
export const LOG_TAIL_CHARS = 200000;
/** 距底部多近算「正在看最新」：在这个范围内才自动跟随新日志。 */
const PIN_THRESHOLD_PX = 24;

export interface RunLogProps {
  text: string;
  /** 点击日志里的地址：交宿主用系统默认浏览器打开。 */
  onOpenUrl: (url: string) => void;
  t: Translator;
}

/**
 * 一条运行的日志视图：ANSI 着色 + 地址可点。
 *
 * 整段解析（而不是追加式）才能正确处理被 chunk 切断的转义序列；文本只在这里
 * 变化时解析一次（useMemo），不在每帧重跑。
 */
export function RunLog({ text, onOpenUrl, t }: RunLogProps) {
  const segments = React.useMemo(() => parseAnsi(text), [text]);
  const preRef = React.useRef<HTMLPreElement | null>(null);
  // 默认贴底；用户往上翻之后就不再被新日志拽回来。
  const pinnedRef = React.useRef(true);

  React.useLayoutEffect(() => {
    const node = preRef.current;
    if (node === null || !pinnedRef.current) return;
    node.scrollTop = node.scrollHeight;
  }, [text]);

  /** 一段文本 → React 节点：命中地址的片段渲染成链接（href 保留，便于右键复制）。 */
  const renderText = (value: string): React.ReactNode => {
    const tokens = linkify(value);
    if (tokens.length === 1 && tokens[0].href === undefined) return tokens[0].text;
    return tokens.map((token, index) => {
      const href = token.href;
      if (href === undefined) return <React.Fragment key={index}>{token.text}</React.Fragment>;
      return (
        <a
          key={index}
          className="renv-link"
          href={href}
          title={t('openInBrowser')}
          onClick={(event) => {
            // 走宿主：桌面端由系统默认浏览器打开，而不是在面板里再开一个窗口。
            event.preventDefault();
            onOpenUrl(href);
          }}
        >
          {token.text}
        </a>
      );
    });
  };

  return (
    <pre
      className="renv-log"
      ref={preRef}
      onScroll={(event) => {
        const node = event.currentTarget;
        pinnedRef.current = node.scrollHeight - node.scrollTop - node.clientHeight <= PIN_THRESHOLD_PX;
      }}
    >
      {segments.map((segment, index) =>
        segment.className === undefined && segment.style === undefined ? (
          <React.Fragment key={index}>{renderText(segment.text)}</React.Fragment>
        ) : (
          <span key={index} className={segment.className} style={segment.style as React.CSSProperties | undefined}>
            {renderText(segment.text)}
          </span>
        ),
      )}
    </pre>
  );
}
