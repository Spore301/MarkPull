import { useEffect, useRef } from 'react';
import Prism from 'prismjs';
import 'prismjs/components/prism-markdown';

export default function RawPreview({ markdown }) {
  const preRef = useRef(null);

  useEffect(() => {
    if (preRef.current) {
      Prism.highlightElement(preRef.current);
    }
  }, [markdown]);

  return (
    <div className="preview-pane raw-pane">
      <pre className="language-markdown">
        <code ref={preRef} className="language-markdown">
          {markdown || 'No content extracted yet.'}
        </code>
      </pre>
    </div>
  );
}
