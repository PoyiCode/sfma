// 渲染分級 composable（04 §4.3.5）：依使用者覆寫解析 LodTier。
// 裝置 WebGL 偵測（canRender3D 閘）移至 ModelViewer 容器（App 僅 3D、無 WebGL 顯不支援）。
import { computed, toValue, type ComputedRef, type MaybeRefOrGetter } from 'vue';
import { type LodOverride, type LodTier, resolveLodTier } from '../../utils/humanModel/lod/lodTier';

// React useMemo→computed；override 為響應式來源（設定 lodMode 變更即重解析）。
export function useRenderTier(override: MaybeRefOrGetter<LodOverride>): ComputedRef<LodTier> {
  return computed(() => resolveLodTier(toValue(override)));
}
