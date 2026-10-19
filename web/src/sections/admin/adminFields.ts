/** Text fields on the admin forms, to and from what's stored. */

/** A list typed with commas or one per line. */
export const parseList = (text: string): string[] =>
  text
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);

export const formatList = (items: string[]): string => items.join(', ');

/** Tag rules, one `Group title = Label` per line. */
export function parseTags(text: string): Record<string, string> {
  const rules: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const at = line.lastIndexOf('=');
    if (at < 0) continue;
    const group = line.slice(0, at).trim();
    const label = line.slice(at + 1).trim();
    if (group && label) rules[group] = label;
  }
  return rules;
}

export const formatTags = (rules: Record<string, string>): string =>
  Object.entries(rules)
    .map(([group, label]) => `${group} = ${label}`)
    .join('\n');

/** A picked image file as a `data:` URI, for an organization's icon. */
export function readAsDataUri(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the file'));
    reader.readAsDataURL(file);
  });
}
