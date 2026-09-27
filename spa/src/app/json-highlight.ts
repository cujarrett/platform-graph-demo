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
