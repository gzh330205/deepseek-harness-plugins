/** esbuild 以 `loader: { '.css': 'text' }` 把样式表变成字符串默认导出。 */
declare module '*.css' {
  const text: string;
  export default text;
}
