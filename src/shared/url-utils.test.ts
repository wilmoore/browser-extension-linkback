import { describe, it, expect } from 'vitest';
import {
  normalizeUrl,
  titleFromUrl,
  urlsAreEqual,
  isValidUrl,
  getDomain,
} from './url-utils';

describe('normalizeUrl', () => {
  it('lowercases protocol and hostname', () => {
    expect(normalizeUrl('HTTPS://WWW.EXAMPLE.COM/Path')).toBe('https://www.example.com/Path');
  });

  it('removes default ports', () => {
    expect(normalizeUrl('https://example.com:443/page')).toBe('https://example.com/page');
    expect(normalizeUrl('http://example.com:80/page')).toBe('http://example.com/page');
  });

  it('preserves non-default ports', () => {
    expect(normalizeUrl('https://example.com:8080/page')).toBe('https://example.com:8080/page');
  });

  it('removes trailing slashes except for root', () => {
    expect(normalizeUrl('https://example.com/page/')).toBe('https://example.com/page');
    expect(normalizeUrl('https://example.com/')).toBe('https://example.com/');
  });

  it('removes hash/fragment', () => {
    expect(normalizeUrl('https://example.com/page#section')).toBe('https://example.com/page');
  });

  it('strips tracking parameters', () => {
    const url = 'https://example.com/article?id=123&utm_source=twitter&fbclid=abc';
    expect(normalizeUrl(url)).toBe('https://example.com/article?id=123');
  });

  it('preserves essential parameters', () => {
    const url = 'https://example.com/page?important=value&utm_source=twitter';
    expect(normalizeUrl(url)).toBe('https://example.com/page?important=value');
  });

  it('sorts query parameters for consistency', () => {
    const url1 = 'https://example.com/page?b=2&a=1';
    const url2 = 'https://example.com/page?a=1&b=2';
    expect(normalizeUrl(url1)).toBe(normalizeUrl(url2));
  });

  it('preserves all params for special domains', () => {
    const googleDoc = 'https://docs.google.com/document/d/123?utm_source=test&tab=t.0';
    expect(normalizeUrl(googleDoc)).toContain('utm_source=test');
  });

  it('returns original for invalid URLs', () => {
    expect(normalizeUrl('not-a-url')).toBe('not-a-url');
  });
});

describe('titleFromUrl', () => {
  it('extracts hostname for root URLs', () => {
    expect(titleFromUrl('https://example.com/')).toBe('example.com');
  });

  it('extracts last path segment and hostname', () => {
    expect(titleFromUrl('https://example.com/blog/my-article')).toBe('My Article - example.com');
  });

  it('removes common file extensions', () => {
    expect(titleFromUrl('https://example.com/page.html')).toBe('Page - example.com');
  });

  it('handles www prefix', () => {
    expect(titleFromUrl('https://www.example.com/')).toBe('example.com');
  });

  it('handles URL-encoded characters', () => {
    expect(titleFromUrl('https://example.com/hello%20world')).toBe('Hello World - example.com');
  });
});

describe('urlsAreEqual', () => {
  it('considers normalized URLs equal', () => {
    expect(urlsAreEqual(
      'https://example.com/page?a=1&b=2',
      'https://EXAMPLE.COM/page?b=2&a=1'
    )).toBe(true);
  });

  it('ignores tracking params in comparison', () => {
    expect(urlsAreEqual(
      'https://example.com/page',
      'https://example.com/page?utm_source=twitter'
    )).toBe(true);
  });

  it('detects different URLs', () => {
    expect(urlsAreEqual(
      'https://example.com/page1',
      'https://example.com/page2'
    )).toBe(false);
  });
});

describe('isValidUrl', () => {
  it('accepts http URLs', () => {
    expect(isValidUrl('http://example.com')).toBe(true);
  });

  it('accepts https URLs', () => {
    expect(isValidUrl('https://example.com')).toBe(true);
  });

  it('rejects non-http URLs', () => {
    expect(isValidUrl('ftp://example.com')).toBe(false);
    expect(isValidUrl('file:///path/to/file')).toBe(false);
  });

  it('rejects invalid URLs', () => {
    expect(isValidUrl('not a url')).toBe(false);
    expect(isValidUrl('')).toBe(false);
  });
});

describe('getDomain', () => {
  it('extracts domain without www', () => {
    expect(getDomain('https://www.example.com/page')).toBe('example.com');
    expect(getDomain('https://example.com/page')).toBe('example.com');
  });

  it('preserves subdomains other than www', () => {
    expect(getDomain('https://blog.example.com/page')).toBe('blog.example.com');
  });
});
