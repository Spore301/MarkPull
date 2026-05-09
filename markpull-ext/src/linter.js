export function lintMarkdown(markdown) {
  // Simple custom linter for M1 (auto-fixes only)
  let linted = markdown;

  // MD012: Multiple consecutive blank lines -> single blank line
  linted = linted.replace(/\n{3,}/g, '\n\n');

  // MD009: Trailing spaces -> remove
  linted = linted.replace(/[ \t]+$/gm, '');

  // MD022: Headings should be surrounded by blank lines
  linted = linted.replace(/([^\n])\n(#+ .*)/g, '$1\n\n$2');
  linted = linted.replace(/(#+ .*)\n([^\n])/g, '$1\n\n$2');

  return linted;
}
