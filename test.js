'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  convertBilibiliUrl,
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

test('preserves numeric Niconico from parameter only', () => {
  assert.equal(
    convertNiconicoUrl('https://www.nicovideo.jp/watch/sm9?from=50&ref=abc'),
    'https://www.nicovideo.gay/watch/sm9?from=50'
  );
});

test('standard Bilibili BV URL', () => {
  assert.equal(
    convertBilibiliUrl('https://www.bilibili.com/video/BV1xx411c7mD'),
    'https://www.vxbilibili.com/video/BV1xx411c7mD?lang=jp'
  );
});

test('Bilibili av URL and p parameter', () => {
  assert.equal(
    convertBilibiliUrl('https://www.bilibili.com/video/av170001?p=2&spm_id_from=x'),
    'https://www.vxbilibili.com/video/av170001?p=2&lang=jp'
  );
});

test('b23.tv short URL', () => {
  assert.equal(
    convertBilibiliUrl('https://b23.tv/AbCd123'),
    'https://vxb23.tv/AbCd123?lang=jp'
  );
});

test('rejects unrelated and unsupported URLs', () => {
  assert.equal(convertNiconicoUrl('https://live.nicovideo.jp/watch/lv1'), null);
  assert.equal(convertBilibiliUrl('https://example.com/video/BV1xx411c7mD'), null);
  assert.equal(convertBilibiliUrl('https://www.bilibili.com/read/cv123'), null);
});

test('deduplicates mixed links and limits to three', () => {
  const content = [
    'https://www.nicovideo.jp/watch/sm1',
    'https://nico.ms/sm1',
    'https://www.bilibili.com/video/BV1xx411c7mD',
    'https://b23.tv/AbCd123',
    'https://www.nicovideo.jp/watch/sm4',
  ].join(' ');

  assert.deepEqual(convertedLinksFromMessage(content), [
    'https://www.nicovideo.gay/watch/sm1',
    'https://www.vxbilibili.com/video/BV1xx411c7mD?lang=jp',
    'https://vxb23.tv/AbCd123?lang=jp',
  ]);
});
