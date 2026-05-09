import './content.css';

let isActive = false;
let selectedElements = new Set();

const highlightClassHover = 'markpull-highlight-hover';
const highlightClassSelected = 'markpull-highlight-selected';

const validTags = ['ARTICLE', 'SECTION', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'UL', 'OL', 'TABLE', 'PRE', 'BLOCKQUOTE', 'DIV'];

function isValidElement(element) {
  if (element.nodeType !== Node.ELEMENT_NODE) return false;
  return validTags.includes(element.tagName);
}

document.addEventListener('mouseover', (e) => {
  if (!isActive) return;
  const target = e.target;
  if (isValidElement(target)) {
    target.classList.add(highlightClassHover);
  }
});

document.addEventListener('mouseout', (e) => {
  if (!isActive) return;
  const target = e.target;
  if (isValidElement(target)) {
    target.classList.remove(highlightClassHover);
  }
});

document.addEventListener('click', (e) => {
  if (!isActive) return;
  const target = e.target;
  if (isValidElement(target)) {
    e.preventDefault();
    e.stopPropagation();
    
    if (selectedElements.has(target)) {
      selectedElements.delete(target);
      target.classList.remove(highlightClassSelected);
    } else {
      selectedElements.add(target);
      target.classList.add(highlightClassSelected);
    }

    const selections = getSortedSelections();
    chrome.runtime.sendMessage({ action: 'live_selection_updated', selections });
  }
}, { capture: true });

function getSortedSelections() {
  const arr = Array.from(selectedElements);
  arr.sort((a, b) => {
    const position = a.compareDocumentPosition(b);
    if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
    if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
    return 0;
  });
  return arr.map(el => el.outerHTML);
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'toggle_picker') {
    isActive = request.isActive;
    if (!isActive) {
      document.querySelectorAll(`.${highlightClassHover}`).forEach(el => el.classList.remove(highlightClassHover));
    }
    sendResponse({ status: 'ok', isActive });
  } else if (request.action === 'get_selection') {
    const selections = getSortedSelections();
    sendResponse({ selections });
  } else if (request.action === 'extract_full_page') {
    const mainContent = document.querySelector('main, article, [role="main"]') || document.body;
    sendResponse({ selections: [mainContent.outerHTML] });
  } else if (request.action === 'extract_auto_detect') {
    const content = detectMainContent();
    
    // Clear existing selections
    document.querySelectorAll(`.${highlightClassSelected}`).forEach(el => el.classList.remove(highlightClassSelected));
    selectedElements.clear();
    
    if (content) {
      const segments = extractImportantSegments(content);
      segments.forEach(seg => {
        selectedElements.add(seg);
        seg.classList.add(highlightClassSelected);
      });
      
      // Ensure element scrolls into view
      content.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    
    isActive = true; // Turn on picker mode automatically
    
    sendResponse({ selections: getSortedSelections() });
  } else if (request.action === 'clear_selection') {
    selectedElements.forEach(el => el.classList.remove(highlightClassSelected));
    selectedElements.clear();
    sendResponse({ status: 'ok' });
  }
});

function extractImportantSegments(root) {
  const segments = [];
  const badTags = new Set(['NAV', 'FOOTER', 'ASIDE', 'FORM', 'SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'BUTTON']);
  // Use boundaries to avoid matching substrings like "ad" in "heading"
  const badRegex = /(^|[-_ ])(nav|footer|sidebar|menu|comment|widget|ad|ads|promo|banner|share|social|related|sponsor|popup|modal)([-_ ]|$)/i;
  const goodTags = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'PRE', 'BLOCKQUOTE', 'UL', 'OL', 'TABLE']);
  const blockTags = new Set(['DIV', 'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'TABLE', 'PRE', 'BLOCKQUOTE', 'SECTION', 'ARTICLE', 'ASIDE', 'NAV', 'HEADER', 'FOOTER', 'FIGURE', 'MAIN']);

  // Pre-process: expand closed accordions within the main content wrapper
  function expandAccordions(element) {
    element.querySelectorAll('details:not([open])').forEach(d => d.open = true);
    element.querySelectorAll('[aria-expanded="false"]').forEach(btn => {
      if (!btn.closest('nav, header')) {
        try { btn.click(); } catch(e) {}
      }
    });
  }
  
  expandAccordions(root);

  function traverse(node) {
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    // Filter out bad tags and classes
    if (badTags.has(node.tagName)) return;
    const classId = `${node.className || ''} ${node.id || ''}`;
    if (badRegex.test(classId)) return;

    // If it is a known good structural element, select it as a chunk
    if (goodTags.has(node.tagName)) {
      if (node.textContent && node.textContent.trim().length > 0) {
        segments.push(node);
      }
      return; // Do not traverse children to keep unified chunks
    }

    // Heuristic: If it's a generic container but directly contains substantial text 
    // without child block elements, treat it as a block.
    let hasBlockChildren = false;
    for (let child of node.children) {
      if (blockTags.has(child.tagName)) {
        hasBlockChildren = true;
        break;
      }
    }

    if (!hasBlockChildren && node.textContent && node.textContent.trim().length > 20) {
      segments.push(node);
      return;
    }

    // Otherwise, recursively traverse children
    for (let child of node.children) {
      traverse(child);
    }
  }

  // If the root itself matches good criteria, just return it, 
  // otherwise traverse it
  traverse(root);
  return segments.length > 0 ? segments : [root]; // fallback to root if nothing found
}

function detectMainContent() {
  const semantic = document.querySelector('article, main, [role="main"]');
  if (semantic && semantic.textContent.length > 200) return semantic;

  const candidates = document.querySelectorAll('div, section');
  let bestScore = 0;
  let bestElement = document.body;

  const contentRegex = /(content|post|article|body|entry|story)/i;
  const ignoreRegex = /(nav|footer|sidebar|menu|comment|widget|ad|promo)/i;

  candidates.forEach(el => {
    const className = typeof el.className === 'string' ? el.className : '';
    const id = el.id || '';
    const classId = `${className} ${id}`;

    if (ignoreRegex.test(classId)) return;

    let score = 0;
    if (contentRegex.test(classId)) score += 50;
    
    const paragraphs = el.querySelectorAll('p');
    let textLength = 0;
    paragraphs.forEach(p => textLength += p.textContent.length);

    score += textLength;

    const links = el.querySelectorAll('a');
    if (links.length > 0 && textLength > 0) {
       const linkDensity = links.length / (textLength / 100);
       score -= linkDensity * 10;
    }

    if (score > bestScore && textLength > 200) {
      bestScore = score;
      bestElement = el;
    }
  });

  return bestElement;
}
