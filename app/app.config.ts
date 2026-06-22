// Nuxt UI v4 主題設定（03 §3.7）：將 U* 元件主色對應品牌 sage（取自 jolly-health.com，
// 經 main.css @theme 之 --color-sage-* 色階註冊），中性色對應 slate（與 dark 主題一致）。
// 色彩值仍由 tokens.css 之 semantic 變數為唯一真相；sage 色階與 tokens.css --sage-* 同值。
export default defineAppConfig({
  ui: {
    colors: {
      primary: 'sage',
      neutral: 'slate',
    },
  },
});
