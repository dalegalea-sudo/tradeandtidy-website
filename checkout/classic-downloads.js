'use strict';

const { createDecipheriv } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const posters = require('./classic-posters.json');

function readClassicPdf(sku) {
  if (!Object.hasOwn(posters, sku)) throw new Error('Unknown classic poster');

  const key = process.env.CLASSIC_POSTER_ASSET_KEY || '';
  if (!/^[0-9a-f]{64}$/i.test(key)) throw new Error('Classic poster downloads are unavailable');

  const encrypted = readFileSync(join(__dirname, 'classic-downloads', sku + '.enc'));
  const iv = encrypted.subarray(0, 12);
  const tag = encrypted.subarray(12, 28);
  const decipher = createDecipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);
  decipher.setAAD(Buffer.from(sku));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted.subarray(28)), decipher.final()]);
}

module.exports = { posters, readClassicPdf };
