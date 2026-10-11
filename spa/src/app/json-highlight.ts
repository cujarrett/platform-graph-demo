const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * Colours pretty-printed JSON. Four token kinds are enough for a query answer,
 * and the input is escaped first, so a string value can never become markup.
 */
export function highlightJson(pretty: string): string {
  return escapeHtml(pretty).replace(
    /("(?:\\.|[^"\\])*")(\s*:)?|\b(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)\b|\b(true|false|null)\b/gi,
    (match, str: string | undefined, colon: string | undefined, num, lit) => {
      if (str !== undefined) {
        return colon
          ? `<span class="j-key">${str}</span>${colon}`
          : `<span class="j-str">${str}</span>`
      }
      if (num !== undefined) return `<span class="j-num">${match}</span>`
      if (lit !== undefined) return `<span class="j-lit">${match}</span>`
      return match
    },
  )
}

const WIDTH = 60

/** One-line JSON with a space after each colon and comma, and inside braces. */
const flat = (v: unknown): string => {
  if (Array.isArray(v)) return `[${v.map(flat).join(', ')}]`
  if (v && typeof v === 'object') {
    const rows = Object.entries(v).map(
      ([k, x]) => `${JSON.stringify(k)}: ${flat(x)}`,
    )
    return `{ ${rows.join(', ')} }`
  }
  return JSON.stringify(v)
}

/**
 * JSON sized to fit a small panel.
 * - Anything that fits on one line stays on one line.
 * - Consecutive short fields share a line.
 */
export function compactJson(v: unknown, indent = ''): string {
  const one = flat(v)
  if (
    indent.length + one.length <= WIDTH ||
    v === null ||
    typeof v !== 'object'
  )
    return one
  const inner = indent + '  '
  const items = Array.isArray(v)
    ? v.map((x) => compactJson(x, inner))
    : Object.entries(v).map(
        ([k, x]) => `${JSON.stringify(k)}: ${compactJson(x, inner)}`,
      )
  const lines: string[] = []
  for (const item of items) {
    const last = lines.length - 1
    const joined = last >= 0 ? `${lines[last]}, ${item}` : ''
    if (
      last >= 0 &&
      !item.includes('\n') &&
      !lines[last].includes('\n') &&
      inner.length + joined.length <= WIDTH
    ) {
      lines[last] = joined
    } else {
      lines.push(item)
    }
  }
  const [open, close] = Array.isArray(v) ? ['[', ']'] : ['{', '}']
  return `${open}\n${lines.map((l) => inner + l).join(',\n')}\n${indent}${close}`
}

/**
 * Colours one line of GraphQL SDL or YAML with the same token classes as JSON.
 * The line is escaped first, so it can never become markup.
 */
export function highlightCode(line: string): string {
  return escapeHtml(line).replace(
    /("(?:\\.|[^"\\])*")|(@\w+)|\b(type|extend|schema)\b|([\w-]+)(?=:)|\b([A-Z]\w*)\b/g,
    (match, str, dir, kw, key, typ) => {
      if (str !== undefined) return `<span class="j-str">${match}</span>`
      if (dir !== undefined || kw !== undefined)
        return `<span class="j-lit">${match}</span>`
      if (key !== undefined) return `<span class="j-key">${match}</span>`
      if (typ !== undefined) return `<span class="j-num">${match}</span>`
      return match
    },
  )
}
