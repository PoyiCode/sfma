// 自帶 Draco decoder 配置（04 §4.6.3／§4.3.6；todo 04 line 8）：GLB 經 KHR_draco_mesh_compression
// 壓縮後，Babylon 9 glTF 載入器以 `DracoDecoder.Default` 解碼。其 DefaultConfiguration 預設指向
// CDN（cdn.babylonjs.com/draco_*）——離線 PWA／[[ios-lan-nonsecure-context]] 非安全區網不可行。
// 本模組將其改指**自帶**（apps/web/public/draco/，Vite 複製入 dist、同源取用）：decoder 二進位
// 自 @babylonjs/core/assets/Draco 複製。WASM 自 iOS 11 全支援、不設 fallbackUrl（不出貨 500K JS fallback）。
import { DracoDecoder } from '@babylonjs/core';

// 自帶 decoder 託管前綴（public/draco/ → runtime /draco/）。子路徑佈署（GitHub Pages）時，
// 呼叫端傳入含 app.baseURL 前綴之 baseUrl（如 /sfma/draco/），見 createGltfMeshLoader。
const DEFAULT_DRACO_BASE_URL = '/draco/';

// 設定 DracoDecoder.DefaultConfiguration 指向自帶 decoder（冪等；須於首次 glb 載入前呼叫，
// 使惰性實例化之 DracoDecoder.Default 取用本地路徑而非 CDN）。
export function configureDracoDecoder(baseUrl: string = DEFAULT_DRACO_BASE_URL): void {
  DracoDecoder.DefaultConfiguration = {
    wasmUrl: `${baseUrl}draco_wasm_wrapper_gltf.js`,
    wasmBinaryUrl: `${baseUrl}draco_decoder_gltf.wasm`,
  };
}
