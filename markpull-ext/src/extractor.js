import TurndownService from 'turndown';

const turndownService = new TurndownService({
  headingStyle: 'atx',
  hr: '---',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced'
});

// Configure custom rules
turndownService.addRule('strip-nav', {
  filter: ['nav', 'footer', 'script', 'style', 'noscript'],
  replacement: function () {
    return '';
  }
});

export function extractHtmlToMarkdown(htmlStrings) {
  if (!htmlStrings || htmlStrings.length === 0) return '';
  
  // Combine all selected HTML strings
  const combinedHtml = htmlStrings.join('\n\n');
  return turndownService.turndown(combinedHtml);
}
