import { marked } from 'marked';

export default function RenderedPreview({ markdown }) {
  const htmlContent = marked.parse(markdown || 'No content extracted yet.');
  return (
    <div 
      className="preview-pane rendered-pane markdown-body" 
      dangerouslySetInnerHTML={{ __html: htmlContent }} 
    />
  );
}
