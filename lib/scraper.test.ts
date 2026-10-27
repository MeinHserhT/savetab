import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractYouTubeVideoId,
  parseHtmlMetadata,
  resolveFaviconUrl,
  validateAndNormalizeUrl,
} from './scraper';

test('parses complete OpenGraph and Twitter card metadata accurately', () => {
  const html = `
    <!doctype html>
    <html>
      <head>
        <title>Fallback HTML Title</title>
        <meta property="og:title" content="Grid Systems in Graphic Design &amp; UI" />
        <meta property="og:description" content="A comprehensive treatise on Swiss typographic grids and spatial precision." />
        <meta property="og:image" content="/assets/og-grid.png" />
        <link rel="icon" href="/favicons/swiss.svg" />
      </head>
      <body><p> Swiss typography article content. </p></body>
    </html>
  `;

  const result = parseHtmlMetadata(html, 'https://design.ch/essays/grid-systems');
  assert.equal(result.domain, 'design.ch');
  assert.equal(result.title, 'Grid Systems in Graphic Design & UI');
  assert.equal(
    result.description,
    'A comprehensive treatise on Swiss typographic grids and spatial precision.'
  );
  assert.equal(result.image_url, 'https://design.ch/assets/og-grid.png');
  assert.equal(result.favicon, 'https://design.ch/favicons/swiss.svg');
  assert.equal(result.scrape_status, 'ok');
});

test('extracts YouTube video IDs and resolves clip titles from player response or clean <title>', () => {
  assert.equal(
    extractYouTubeVideoId(new URL('https://www.youtube.com/watch?v=dQw4w9WgXcQ')),
    'dQw4w9WgXcQ'
  );
  assert.equal(
    extractYouTubeVideoId(new URL('https://youtu.be/dQw4w9WgXcQ?si=123')),
    'dQw4w9WgXcQ'
  );
  assert.equal(
    extractYouTubeVideoId(new URL('https://www.youtube.com/shorts/abc123XYZ89')),
    'abc123XYZ89'
  );

  const shellHtmlWithPlayerJson = `
    <html>
      <head><title>- YouTube</title></head>
      <body>
        <script>var ytInitialPlayerResponse = {"videoDetails":{"videoId":"dQw4w9WgXcQ","title":"Systems Architecture Lecture 01"}};</script>
      </body>
    </html>
  `;
  const parsed = parseHtmlMetadata(
    shellHtmlWithPlayerJson,
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
  );
  assert.equal(parsed.title, 'Systems Architecture Lecture 01');
  assert.equal(parsed.image_url, 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
  assert.equal(parsed.favicon, 'https://www.youtube.com/favicon.ico');
});

test('resolves relative favicon URLs and falls back to /favicon.ico when absent', () => {
  const baseUrl = new URL('https://systems.io/blog/index.html');
  const htmlWithRelative = `<link href="../static/icon-32.png" rel="shortcut icon">`;
  assert.equal(
    resolveFaviconUrl(htmlWithRelative, baseUrl),
    'https://systems.io/static/icon-32.png'
  );

  const htmlWithoutFavicon = `<html><head><title>No Icon</title></head></html>`;
  assert.equal(
    resolveFaviconUrl(htmlWithoutFavicon, baseUrl),
    'https://systems.io/favicon.ico'
  );
});

test('degrades gracefully on zero meta tags or malformed paywall HTML', () => {
  const malformedHtml = `<html><head></head><body><div>403 Paywall / Subscription Required`;
  const result = parseHtmlMetadata(
    malformedHtml,
    'https://archive.example.org/papers/zero-copy-simd-kernels.html'
  );

  assert.equal(result.domain, 'archive.example.org');
  assert.equal(result.title, 'Zero Copy Simd Kernels — archive.example.org');
  assert.equal(result.image_url, null);
  assert.equal(result.favicon, 'https://archive.example.org/favicon.ico');
  assert.equal(result.scrape_status, 'degraded');
});

test('validates and normalizes URLs without explicit protocol and rejects invalid hosts', () => {
  const normalized = validateAndNormalizeUrl('martinfowler.com/articles/patterns.html');
  assert.equal(normalized.toString(), 'https://martinfowler.com/articles/patterns.html');

  assert.throws(() => validateAndNormalizeUrl(''), /URL cannot be empty/);
  assert.throws(() => validateAndNormalizeUrl('ftp://files.local/test'), /Only HTTP and HTTPS/);
});
