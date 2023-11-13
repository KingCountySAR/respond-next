import { useEffect, useState } from 'react';
import Markdown from 'react-markdown';

export default function MarkdownFromFile({ path }: { path: string }) {
  const [markdown, setMarkdown] = useState('');
  useEffect(() => {
    fetch(path)
      .then((res) => res.text())
      .then((text) => setMarkdown(text));
  });
  return <Markdown>{markdown}</Markdown>;
}
