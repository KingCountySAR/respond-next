/**
 * Sections stay independent: each may use the shell, `ui`, its own files and packages, but never
 * another section. The shell reaches a section only through its index. (A test until ESLint's
 * boundary rules are set up.)
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const src = resolve(dirname(fileURLToPath(import.meta.url)), '../src');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : /\.tsx?$/.test(name) ? [path] : [];
  });
}

/** Relative imports, as paths under src (`sections/ops/Dashboard`). */
function localImports(file: string): string[] {
  const text = readFileSync(file, 'utf8');
  return [...text.matchAll(/(?:from|import\(?)\s*'(\.[^']+)'/g)].map((m) => relative(src, resolve(dirname(file), m[1]!)).split(sep).join('/'));
}

const sectionOf = (path: string) => /^sections\/([^/]+)/.exec(path)?.[1];

describe('web/src boundaries', () => {
  it('keeps sections from importing each other', () => {
    const crossings = files(join(src, 'sections')).flatMap((file) => {
      const from = sectionOf(relative(src, file).split(sep).join('/'));
      return localImports(file)
        .filter((to) => sectionOf(to) && sectionOf(to) !== from)
        .map((to) => `${relative(src, file)} -> ${to}`);
    });
    expect(crossings).toEqual([]);
  });

  it('lets the shell and ui reach a section only through its index', () => {
    const deep = [...files(join(src, 'shell')), ...files(join(src, 'ui'))].flatMap((file) =>
      localImports(file)
        .filter((to) => sectionOf(to) && !/^sections\/[^/]+(\/index)?$/.test(to))
        .map((to) => `${relative(src, file)} -> ${to}`),
    );
    expect(deep).toEqual([]);
  });
});
