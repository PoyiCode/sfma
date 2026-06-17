// Nuxt UI v4 主題設定（03 §3.7）：將 U* 元件主色對應品牌 teal/cyan，中性色對應 slate，
// 使內建元件外觀貼近 tokens.css 之設計系統。色彩值仍由 tokens.css 之 semantic 變數為唯一真相。
export default defineAppConfig({
  ui: {
    colors: {
      primary: 'cyan',
      neutral: 'slate',
    },
  },
});
