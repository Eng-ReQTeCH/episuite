import { InputError } from './domain.js';

export function normalizeBookSearch(value) {
  return String(value || '').normalize('NFKC').toLowerCase()
    .replace(/[\u064b-\u065f\u0670\u06d6-\u06ed\u0640\u200b-\u200f\u202a-\u202e]/g, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/[ىی]/g, 'ي').replace(/ک/g, 'ك').replace(/ة/g, 'ه')
    .replace(/[٠-٩۰-۹]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.includes(digit) ? '٠١٢٣٤٥٦٧٨٩'.indexOf(digit) : '۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
}

export function bookWebUrl(value) {
  if (!value) return '';
  if (typeof value !== 'string' || value.length > 2048) throw new InputError('Use a valid HTTPS book or cover link.');
  let url;
  try { url = new URL(value); } catch { throw new InputError('Use a valid HTTPS book or cover link.'); }
  const hostname = url.hostname.replace(/\.$/,'');
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') ||
      !hostname.includes('.') || hostname.startsWith('[') || /^[\d.]+$/.test(hostname) || /(?:^|\.)(?:localhost|local|internal)$/.test(hostname)) throw new InputError('Use a public HTTPS book or cover link.');
  return url.href;
}
