/**
 * Escape for Telegram MarkdownV2 (or use simple escapes for Markdown)
 */
export function escapeMd(text) {
  if (typeof text !== 'string') return '';
  return text.replace(/([_*\[\]()~`>#+=|{}.!-])/g, '\\$1');
}

export function escapeMdSimple(text) {
  if (typeof text !== 'string') return '';
  return text.replace(/\*/g, '\\*').replace(/_/g, '\\_').replace(/`/g, "\\`").replace(/\[/g, '\\[');
}
