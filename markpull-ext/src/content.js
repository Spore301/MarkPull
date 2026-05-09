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

    const selections = Array.from(selectedElements).map(el => el.outerHTML);
    chrome.runtime.sendMessage({ action: 'live_selection_updated', selections });
  }
}, { capture: true });

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'toggle_picker') {
    isActive = request.isActive;
    if (!isActive) {
      document.querySelectorAll(`.${highlightClassHover}`).forEach(el => el.classList.remove(highlightClassHover));
    }
    sendResponse({ status: 'ok', isActive });
  } else if (request.action === 'get_selection') {
    const selections = Array.from(selectedElements).map(el => el.outerHTML);
    sendResponse({ selections });
  } else if (request.action === 'extract_full_page') {
    const mainContent = document.querySelector('main, article, [role="main"]') || document.body;
    sendResponse({ selections: [mainContent.outerHTML] });
  } else if (request.action === 'clear_selection') {
    selectedElements.forEach(el => el.classList.remove(highlightClassSelected));
    selectedElements.clear();
    sendResponse({ status: 'ok' });
  }
});
