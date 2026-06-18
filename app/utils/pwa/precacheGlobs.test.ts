import { describe, expect, it } from 'vitest';
import { PRECACHE_GLOB_PATTERNS, PRECACHE_MAX_FILE_BYTES } from './precacheGlobs';

// 將 workbox glob（`**`／`*`／`{a,b}`）轉為 RegExp，驗證代表性檔名是否落入精快取白名單。
function globToRegExp(glob: string): RegExp {
  let re = '';
  for (let i = 0; i < glob.length; i += 1) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        if (glob[i + 2] === '/') {
          re += '(?:.*/)?';
          i += 2;
        } else {
          re += '.*';
          i += 1;
        }
      } else {
        re += '[^/]*';
      }
    } else if (c === '{') {
      const end = glob.indexOf('}', i);
      const opts = glob
        .slice(i + 1, end)
        .split(',')
        .map((s) => s.trim().replace(/[.+^${}()|[\]\\]/g, '\\$&'));
      re += `(?:${opts.join('|')})`;
      i = end;
    } else if (c !== undefined && '.+^${}()|[]\\'.includes(c)) {
      re += `\\${c}`;
    } else {
      re += c;
    }
  }
  return new RegExp(`^${re}$`);
}

function isPrecached(file: string): boolean {
  return PRECACHE_GLOB_PATTERNS.some((p) => globToRegExp(p).test(file));
}

describe('PRECACHE_GLOB_PATTERNS（SW 預快取範圍）', () => {
  it('精快取 App 殼層：進入點／一般 chunk js／css／html／圖示／字型／2D 圖資', () => {
    // Nuxt 4 chunk 名為純雜湊（無語意前綴）：殼層 js/css 皆廣納。
    expect(isPrecached('_nuxt/C4JQetQo.js')).toBe(true);
    expect(isPrecached('_nuxt/entry.Dfeiu03a.css')).toBe(true);
    expect(isPrecached('_nuxt/index.BJXiMdXn.css')).toBe(true);
    expect(isPrecached('index.html')).toBe(true);
    expect(isPrecached('favicon.svg')).toBe(true);
    expect(isPrecached('assets2d/anatomy2d.front.svg')).toBe(true);
    expect(isPrecached('icons/pwa-192x192.png')).toBe(true);
    expect(isPrecached('_nuxt/inter-latin.woff2')).toBe(true);
  });

  it('3D／Babylon megachunk 之 .js 雖落入 glob，但由 PRECACHE_MAX_FILE_BYTES（>2 MiB）排除', () => {
    // glob 不能以名稱排除（雜湊命名）；排除由 workbox maximumFileSizeToCacheInBytes 把關。
    expect(isPrecached('_nuxt/C4JQetQo.js')).toBe(true);
    // 門檻 3 MiB：小於唯一的 6.9 MB Babylon megachunk、大於其餘殼層 chunk → 僅排除 megachunk。
    expect(PRECACHE_MAX_FILE_BYTES).toBeGreaterThan(2 * 1024 * 1024);
    expect(PRECACHE_MAX_FILE_BYTES).toBeLessThan(6 * 1024 * 1024);
  });

  it('不快取結構化／個資／模型資產（json／db／sqlite／csv／idb／txt／glb）——SW 不快取個資（§8.7）', () => {
    for (const file of [
      'data/patients.json',
      'store.db',
      'x.sqlite',
      'export.csv',
      'a.idb',
      'note.txt',
      'models/anatomyV1.glb',
    ]) {
      expect(isPrecached(file)).toBe(false);
    }
  });
});
