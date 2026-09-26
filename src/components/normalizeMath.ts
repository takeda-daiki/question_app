// Normalize display delimiters before Markdown parses them. Code examples and
// single-dollar inline math are copied verbatim; an entire math block is consumed
// at once so align inside $$ is never wrapped a second time.
export function normalizeMath(text: string) {
  const tokens =
    /(^ {0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?^ {0,3}\2[ \t]*(?=\n|$))|(`+)[^`]*?\3|(?<!\\)(\${2,})(?!\$)([\s\S]*?)(?<!\\)\4(?!\$)|\\\[([\s\S]*?)\\\]|\\begin\{(align\*?)\}([\s\S]*?)\\end\{\7\}|(?<![\\$])\$(?!\$)[^\n$]+\$/gm;
  return text.replace(
    tokens,
    (
      match,
      code,
      _fence,
      inlineCode,
      dollars,
      body,
      bracketBody,
      align,
      alignBody,
    ) => {
      if (code || inlineCode) return match;
      const formula = dollars
        ? body
        : bracketBody !== undefined
          ? bracketBody
          : align
            ? `\\begin{${align}}${alignBody}\\end{${align}}`
            : null;
      if (formula === null || !formula.trim()) return match;
      return `\n\n$$\n${formula.trim()}\n$$\n\n`;
    },
  );
}
