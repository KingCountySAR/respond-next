import { ReactNode, useEffect, useState } from 'react';
import Markdown from 'react-markdown';

export default function MarkdownFromFile({ path, anchorOffset }: { path: string; anchorOffset?: number }) {
  const [markdown, setMarkdown] = useState('');
  useEffect(() => {
    fetch(path)
      .then((res) => res.text())
      .then((text) => setMarkdown(text));
  });
  return (
    <Markdown
      components={{
        h1: ({ ...props }) => <h1 id={getId(props.children)} style={{ scrollMarginTop: anchorOffset }} {...props}></h1>,
        h2: ({ ...props }) => <h2 id={getId(props.children)} style={{ scrollMarginTop: anchorOffset }} {...props}></h2>,
        h3: ({ ...props }) => <h3 id={getId(props.children)} style={{ scrollMarginTop: anchorOffset }} {...props}></h3>,
        h4: ({ ...props }) => <h4 id={getId(props.children)} style={{ scrollMarginTop: anchorOffset }} {...props}></h4>,
        h5: ({ ...props }) => <h5 id={getId(props.children)} style={{ scrollMarginTop: anchorOffset }} {...props}></h5>,
        h6: ({ ...props }) => <h6 id={getId(props.children)} style={{ scrollMarginTop: anchorOffset }} {...props}></h6>,
      }}
    >
      {markdown}
    </Markdown>
  );
}

const getId = (node: ReactNode) => {
  if (!node) {
    return '';
  }
  return node
    .toString()
    .replace(/^\s+|\s+$/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
};
