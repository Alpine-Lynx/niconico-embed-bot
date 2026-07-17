'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  convertNiconicoUrl,
  convertedLinksFromMessage,
} = require('./link-utils');

test('standard nicovideo URL', () => {
  assert.equal(
    convertNiconicoUrl('https://www.nicovideo.jp/watch/sm9'),
    'https://www.nicovideo.gay/watch/sm9'
  );
});

test('nico.ms short URL', () => {
  assert.equal(
    convertNiconicoUrl('https://nico.ms/sm9'),
    'https://www.nicovideo.gay/watch/sm9'
  );
});

test('preserves only numeric from parameter', () => {
  assert.equal(
    convertNiconicoUrl('https://www.nicovideo.jp/watch/sm9?from=50&ref=abc'),
    'https://www.nicovideo.gay/watch/sm9?from=50'
  );
});

test('rejects live broadcasts and unrelated hosts', () => {
  assert.equal(convertNiconicoUrl('https://live.nicovideo.jp/watch/lv1'), null);
  assert.equal(convertNiconicoUrl('https://example.com/watch/sm9'), null);
});

test('deduplicates and limits to three links', () => {
  const content = [
    'https://www.nicovideo.jp/watch/sm1',
    'https://nico.ms/sm1',
    'https://www.nicovideo.jp/watch/sm2',
    'https://www.nicovideo.jp/watch/sm3',
    'https://www.nicovideo.jp/watch/sm4',
  ].join(' ');

  assert.deepEqual(convertedLinksFromMessage(content), [
    'https://www.nicovideo.gay/watch/sm1',
    'https://www.nicovideo.gay/watch/sm2',
    'https://www.nicovideo.gay/watch/sm3',
  ]);
});
