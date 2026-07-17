'use strict';

const MAX_LINKS_PER_MESSAGE = 3;
const URL_PATTERN = /https?:\/\/[^\s<>]+/gi;

const NICONICO_HOSTS = new Set([
  'nicovideo.jp',
  'www.nicovideo.jp',
  'sp.nicovideo.jp',
  'nico.ms',
]);

const BILIBILI_HOSTS = new Set([
  'bilibili.com',
  'www.bilibili.com',
  'm.bilibili.com',
]);

const BILIBILI_SHORT_HOSTS = new Set([
  'b23.tv',
  'www.b23.tv',
]);

const NICONICO_VIDEO_ID_PATTERN = /^(?:[a-z]{2}\d+|\d+)$/i;
const BILIBILI_VIDEO_ID_PATTERN = /^(?:BV[0-9A-Za-z]+|av\d+)$/i;

function stripTrailingPunctuation(value) {
  return String(value || '').replace(/[.,!?;:、。！？）》」』】〉》]+$/u, '');
}

function isHttpUrl(url) {
  return url.protocol === 'https:' || url.protocol === 'http:';
}

function extractNiconicoVideoId(url) {
  const host = url.hostname.toLowerCase();
  if (!NICONICO_HOSTS.has(host)) return null;

  const segments = url.pathname.split('/').filter(Boolean);
  let videoId = null;

  if (host === 'nico.ms') {
    videoId = segments[0] === 'watch' ? segments[1] : segments[0];
  } else if (segments[0] === 'watch') {
    videoId = segments[1];
  }

  if (!videoId || !NICONICO_VIDEO_ID_PATTERN.test(videoId)) return null;
  if (/^lv\d+$/i.test(videoId)) return null;
  return videoId;
}

function convertNiconicoUrl(rawUrl) {
  let parsed;

  try {
    parsed = new URL(stripTrailingPunctuation(rawUrl));
  } catch {
    return null;
  }

  if (!isHttpUrl(parsed)) return null;

  const videoId = extractNiconicoVideoId(parsed);
  if (!videoId) return null;

  const converted = new URL(`https://www.nicovideo.gay/watch/${videoId}`);
  const from = parsed.searchParams.get('from');

  if (from && /^\d{1,6}$/.test(from)) {
    converted.searchParams.set('from', from);
  }

  return converted.toString();
}

function convertBilibiliUrl(rawUrl) {
  let parsed;

  try {
    parsed = new URL(stripTrailingPunctuation(rawUrl));
  } catch {
    return null;
  }

  if (!isHttpUrl(parsed)) return null;

  const host = parsed.hostname.toLowerCase();

  if (BILIBILI_SHORT_HOSTS.has(host)) {
    const path = parsed.pathname.replace(/\/+/g, '/');

    if (!/^\/[0-9A-Za-z_-]+\/?$/.test(path)) return null;

    const converted = new URL(`https://vxb23.tv${path}`);
    converted.searchParams.set('lang', 'jp');
    return converted.toString();
  }

  if (!BILIBILI_HOSTS.has(host)) return null;

  const segments = parsed.pathname.split('/').filter(Boolean);
  if (segments[0] !== 'video' || !segments[1]) return null;

  const videoId = segments[1];
  if (!BILIBILI_VIDEO_ID_PATTERN.test(videoId)) return null;

  const converted = new URL(`https://www.vxbilibili.com/video/${videoId}`);

  const page = parsed.searchParams.get('p');
  if (page && /^\d{1,4}$/.test(page)) {
    converted.searchParams.set('p', page);
  }

  const start = parsed.searchParams.get('t');
  if (start && /^\d{1,7}$/.test(start)) {
    converted.searchParams.set('t', start);
  }

  converted.searchParams.set('lang', 'jp');
  return converted.toString();
}

function convertSupportedUrl(rawUrl) {
  return convertNiconicoUrl(rawUrl) || convertBilibiliUrl(rawUrl);
}

function convertedLinksFromMessage(content) {
  const matches = String(content || '').match(URL_PATTERN) || [];
  const output = [];
  const seen = new Set();

  for (const match of matches) {
    const converted = convertSupportedUrl(match);

    if (!converted || seen.has(converted)) continue;

    seen.add(converted);
    output.push(converted);

    if (output.length >= MAX_LINKS_PER_MESSAGE) break;
  }

  return output;
}

module.exports = {
  convertBilibiliUrl,
  convertNiconicoUrl,
  convertSupportedUrl,
  convertedLinksFromMessage,
  extractNiconicoVideoId,
  stripTrailingPunctuation,
};
