#!/usr/bin/env node
/*
 * Writes site/llms.txt, the plain text index a language model reads instead of
 * crawling the site.
 *
 * Nothing here is written by hand. The public pages come from site/sitemap.xml
 * in its published order, with the title and description taken out of each
 * page. The documentation pages come from docs/assets/nav-data.js, the same
 * list that builds the sidebar. A page that is not published cannot appear,
 * and a page that is published cannot be described with words it does not use.
 *
 * Run: node site/tools/build-llms-txt.mjs
 *      node site/tools/build-llms-txt.mjs --check   (fails if out of date)
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE = resolve(HERE, '..');
const REPO = resolve(SITE, '..');
const DOCS = join(REPO, 'docs');
const OUTPUT = join(SITE, 'llms.txt');

/** The published origin, read from the one file that defines it. */
function readOrigin() {
  const config = readFileSync(join(SITE, 'assets', 'config.js'), 'utf8');
  const match = /siteOrigin:\s*'([^']+)'/u.exec(config);
  if (match === null) throw new Error('site/assets/config.js has no siteOrigin');
  return match[1].replace(/\/$/u, '') + '/';
}

/** The public pages, in the order the sitemap publishes them. */
function readSitemapPages() {
  const sitemap = readFileSync(join(SITE, 'sitemap.xml'), 'utf8');
  return [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/gu)].map((match) => match[1]);
}

function readMeta(file) {
  const html = readFileSync(file, 'utf8');
  const title = /<title>([^<]*)<\/title>/u.exec(html);
  const description = /<meta\s+name="description"\s+content="([^"]*)"/u.exec(html);
  if (title === null) throw new Error(`${file} has no title`);
  if (description === null) throw new Error(`${file} has no meta description`);
  return { title: decode(title[1]), description: decode(description[1]) };
}

function decode(value) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'");
}

/** The documentation sidebar, evaluated the way a browser would load it. */
function readNav() {
  const source = readFileSync(join(DOCS, 'assets', 'nav-data.js'), 'utf8');
  const window = {};
  new Function('window', source)(window);
  if (!Array.isArray(window.PATINA_NAV)) {
    throw new Error('docs/assets/nav-data.js did not define PATINA_NAV');
  }
  return window.PATINA_NAV;
}

function build() {
  const origin = readOrigin();
  const manifest = JSON.parse(readFileSync(join(REPO, 'docs.manifest.json'), 'utf8'));
  const repository = `https://github.com/${manifest.repository}`;

  const lines = [
    '# PATINA',
    '',
    '> PATINA marks one Bitcoin output as the carrier of an artifact. Depth is',
    '> the number of blocks that output has stayed unspent. Move it and depth',
    '> returns to zero, and the finished stretch is engraved as a ring that',
    '> cannot be rewritten.',
    '',
    'There is no PATINA marketplace. The Bitcoin Universe capability snapshot',
    'records no marketplace surface for PATINA, so no Bitcoin Universe product',
    'implements a buy, sell or settle path for an artifact. Minting happens in',
    'the Bitcoin Universe app; everything else is your own wallet and your own',
    'node.',
    '',
    'Every link below is published by this site.',
    '',
    '## Public pages',
    '',
  ];

  // The documentation pages in the sitemap are listed again, section by
  // section, from the sidebar below. Listing them twice would say less.
  for (const url of readSitemapPages()) {
    const path = url.slice(origin.length);
    if (path.startsWith('docs/')) continue;
    const { title, description } = readMeta(join(SITE, path));
    lines.push(`- [${title}](${url}): ${description}`);
  }

  lines.push(
    '',
    `The documentation is at ${origin}docs/ and is organised into the sections`,
    'below. Each page states its kind: introductory explains, operational is a',
    'procedure, normative is the rule as the specification states it, and',
    'generated means every printed value is computed and checked against the',
    'golden vectors.',
    '',
  );

  for (const section of readNav()) {
    lines.push(`## ${section.title}`, '', `${section.intent}. ${section.blurb}`, '');
    for (const page of section.pages) {
      lines.push(
        `- [${page.title}](${origin}docs/${page.path}): ${page.blurb} Marked ${page.kind}.`,
      );
    }
    lines.push('');
  }

  lines.push(
    '## Specification and vectors',
    '',
    `- [patina-protocol.md](${origin}patina-protocol.md): the specification the`,
    '  deployment records and the golden vectors bind to by SHA-256.',
    `- [vectors/golden.json](${origin}vectors/golden.json): the golden vectors two`,
    '  implementations compare against.',
    `- [vectors/manifest.json](${origin}vectors/manifest.json): what the vector set`,
    '  covers, and the specification hash it was produced from.',
    '',
    '## Machine readable',
    '',
    `- [docs.manifest.json](${origin}docs.manifest.json): the documentation`,
    '  manifest for this repository.',
    `- [sitemap.xml](${origin}sitemap.xml): the public pages above, as a sitemap.`,
    `- [robots.txt](${origin}robots.txt): the crawl policy.`,
    '',
    '## Source',
    '',
    `- [Repository](${repository}): the protocol library, the command line tool,`,
    '  the schemas, the deployment records and the source of these pages.',
    '',
  );

  return lines.join('\n');
}

const wanted = build();

if (process.argv.includes('--check')) {
  let current = '';
  try {
    current = readFileSync(OUTPUT, 'utf8');
  } catch {
    current = '';
  }
  if (current !== wanted) {
    console.error('site/llms.txt is out of date. Run: node site/tools/build-llms-txt.mjs');
    process.exit(1);
  }
  console.log('site/llms.txt is up to date.');
} else {
  writeFileSync(OUTPUT, wanted);
  console.log('site/llms.txt written.');
}
