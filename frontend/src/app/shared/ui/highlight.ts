/**
 * A tiny, language-agnostic highlighter for the fenced code of the notes: comments, strings,
 * numbers, keywords and YAML / JSON keys. It returns tokens (rendered by the Markdown template,
 * never as HTML), so nothing typed in the back office can inject markup.
 */
export interface Token {
  /** '' for plain text, else k (keyword), s (string), c (comment), n (number), p (property / key) */
  c: '' | 'k' | 's' | 'c' | 'n' | 'p';
  v: string;
}

const KEYWORDS = new Set(
  (
    'abstract async await boolean break case catch class const continue def default delete do else enum export extends false final ' +
    'finally fn for from func function go if implements import in instanceof interface let match module new null nil package private ' +
    'protected public readonly record return self static struct super switch this throw throws true try type typeof undefined var ' +
    'void while with yield SELECT FROM WHERE INSERT INTO UPDATE DELETE CREATE TABLE ALTER JOIN ON AND OR NOT NULL AS ORDER BY GROUP LIMIT'
  ).split(' '),
);

const HASH_COMMENTS = new Set(['yaml', 'yml', 'sh', 'bash', 'shell', 'zsh', 'py', 'python', 'toml', 'dockerfile', 'conf', 'ini', 'rb', 'ruby', 'env']);

export function highlight(code: string, lang: string): Token[] {
  const l = lang.toLowerCase();
  const hash = HASH_COMMENTS.has(l);
  const yaml = l === 'yaml' || l === 'yml';
  const out: Token[] = [];
  const push = (c: Token['c'], v: string) => {
    if (!v) return;
    const last = out[out.length - 1];
    if (last && last.c === c) last.v += v;
    else out.push({ c, v });
  };
  const re = hash
    ? /(#[^\n]*)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')|(\b\d[\d_.]*\b)|([A-Za-z_][\w-]*)/g
    : /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d[\d_.]*\b)|([A-Za-z_$][\w$]*)/g;
  let last = 0;
  for (const m of code.matchAll(re)) {
    const i = m.index ?? 0;
    push('', code.slice(last, i));
    const [all, comment, string, number, word] = m;
    if (comment) push('c', all);
    else if (string) {
      // "key": in JSON
      push(code.slice(i + all.length).match(/^\s*:/) ? 'p' : 's', all);
    } else if (number) push('n', all);
    else if (word) {
      const after = code.slice(i + all.length);
      const lineStart = code.lastIndexOf('\n', i - 1) + 1;
      const before = code.slice(lineStart, i);
      if (yaml && /^\s*(- )?$/.test(before) && /^\s*:/.test(after)) push('p', all);
      else if (KEYWORDS.has(all)) push('k', all);
      else push('', all);
    }
    last = i + all.length;
  }
  push('', code.slice(last));
  return out;
}

/** "Mise en production" → "mise-en-production" (heading anchors) */
export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'section'
  );
}
