export default function StatusBar({ markdown }) {
  const charCount = markdown.length;
  const wordCount = markdown.trim() === '' ? 0 : markdown.trim().split(/\s+/).length;
  const headingCount = (markdown.match(/^#+ /gm) || []).length;
  const readTime = Math.ceil(wordCount / 200);

  return (
    <div className="status-bar-content">
      <span>{wordCount} words</span>
      <span className="separator">|</span>
      <span>{charCount} chars</span>
      <span className="separator">|</span>
      <span>{headingCount} headings</span>
      <span className="separator">|</span>
      <span>~{readTime} min</span>
    </div>
  );
}
