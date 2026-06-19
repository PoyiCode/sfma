# 下肢極限屈曲 corrective shape keys — 設計規格

> 日期：2026-06-20｜設計：[04 §4.3.3](../04_human_model.md#433-關節活動與-rom-限制)、[§4.6.3](../04_human_model.md#463-製作管線blender-bpy-腳本)
> 前置：[全身 rig+skin 資產管線](2026-06-19-fullbody-rig-skin-pipeline-design.md)（已實作＋部署）、[執行期 skin 驅動](2026-06-19-skin-deformation-runtime-design.md)
> 文件語言：zh-tw｜狀態：設計定案、待寫實作計畫

## 背景與問題

全身 rig+skin 部署後，下肢**跨關節肌**（cross-joint blend，`crossJointBlend` 之 42 mesh）於**極限屈曲**（≳120°，尤以膝 140°）出現 LBS *candy-wrapper* 塌陷／摺痕。

收窄 blend 過渡帶（`length×0.18 → min(0.03, …)`，commit `3c2a158`）已消除**中度屈曲**塊狀塌陷（≤~90° 經 Blender MCP 驗證乾淨），但極限角度為線性混合蒙皮（LBS）之**固有摺疊**，收窄帶無法根治。

本 app 為 SFMA／ROM 評估工具，**臨床活動度（ROM）為核心內容**，故**不可封頂 ROM**。改以 **corrective shape keys（glTF morph targets）**：保留完整臨床 ROM 的同時，於極限屈曲處以 procedural 生成之修正形回復體積。

## 範圍（v1）

- **下肢三關節 × 左右**：膝（`joint.knee`）、髖（`joint.hip`）、踝（`joint.ankle`），各 `#L/#R`。
- **僅矢狀面屈曲（`flexionExtension`）驅動**——主 candy-wrapper 軸。
- 對象＝既有跨關節 blend 之 mesh（`bind_meshes` 回傳之 blended 集合）。

**v1 不做**：肩／脊椎／頸椎；非矢狀軸（髖外展／內外旋）corrective；手動 sculpt；以 runtime DQS 根治 LBS；`anatomyV1.full.glb`。

## 決策摘要

| 決策 | 選定 | 理由 |
| --- | --- | --- |
| 範圍 | **下肢（膝＋髖＋踝，L/R）** | 可見塌陷集中下肢；先驗端對端再擴及肩/脊 |
| 製作 | **procedural 腳本生成**（rigSkin 管線） | 自動化管線／單人／可重生／免美術工具；重用既有 blend 權重 |
| 修正目標 | **保體積目標 − LBS 之 rest-space delta** | 以「正確旋轉」（四元數依權重混合 about pivot）為目標，避開 candy-wrapper |
| 契約 | **shape key 命名 `corr.<jointId>`** | morph↔joint 單一真相；side 由 mesh 名尾碼 `#L/#R`；免額外 manifest |
| runtime 驅動 | **事件驅動、watcher 內隨 pose 變更** | 重用 `Model3DView.vue` 既有 `rigController.sync` 旁路；零 per-frame 成本 |
| 驅動函式 | **`correctiveWeight = smoothstep(onset, ref, |angle|)`** | onset 下 0、ref 時 1、單調；純函式可測 |

## 架構（三部分，各自獨立可測）

### A. 資產端：procedural corrective 生成（`infra/asset-pipeline/rigSkin.py`）

新函式 `add_corrective_shapekeys(arm, blended_meshes, za, cross_joint)`，於 `bind_meshes` 後執行，重用其 per-vertex 兩骨權重（`vg_p`/`vg_d`）。

對每個 blended mesh、每個 band-vertex：
1. `θ_ref` ＝ 該關節最大屈曲 ROM。
2. 計算 **LBS 位置**（現行線性兩骨混合，會塌陷）與**保體積目標**（於關節樞紐處以「正確旋轉」＝兩骨四元數依權重 slerp 之旋轉施於頂點，volume-preserving、不 candy-wrapper）。
3. **corrective delta（rest-space）** ＝ `M_blend(θ_ref)⁻¹ · target − rest`。
4. 存為 shape key **`corr.<jointId>`**；僅 `|delta| > ε` 之 vert；該 mesh 無顯著修正則跳過（稀疏化）。

> **主要實作風險在此**（保體積目標之四元數混合旋轉數學）。以 **Blender MCP**（現可用）渲染膝@130°（及髖/踝）前後對比視覺校正。

### B. 匯出（`infra/asset-pipeline/exportGltf.py`）

確保 `export_morph=True`（Blender glTF 匯出預設）→ shape keys 成 glTF morph targets。log `MORPH_OK meshes=N targets=M`。重出並部署 `public/models/anatomyV1.glb`（帶 morph）。

### C. runtime：`app/utils/humanModel/motion/morphTargetController.ts`（新檔）

`createMorphTargetController(scene) → { sync(pose), dispose() }`，於 `Model3DView.vue` watcher 中 `rigController.sync(...)` 旁呼用（建立於 rigController 建立處、釋放於 cleanup）。

`sync(pose)`：對每個具 `morphTargetManager` 之 mesh、每個名為 `corr.<jointId>` 之 target：
- 由 mesh 名尾碼取 side（`#L/#R`）。
- `angle = jointAngle(pose, poseKey(jointId, side), 'flexionExtension', 0)`。
- `target.influence = correctiveWeight(Math.abs(angle), onset, ref)`。

純函式 `correctiveWeight(angle, onset, ref)`＝`smoothstep`（onset 以下 0、ref 以上 1、之間單調）。

## 命名與資料流

- **`corr.<jointId>`**（如 `corr.joint.knee`）為 morph↔joint 契約：資產烘焙、runtime 比對皆用之；side 由 mesh 名尾碼。
- **per-joint config `{ θ_ref, θ_onset }`** 為資產↔runtime 唯一共享常數：資產於 `θ_ref` 烘焙**全量**修正；runtime `θ_onset → θ_ref` 漸變。預設 `θ_ref` ＝ definitions 之最大屈曲 ROM、`θ_onset = 0.6·θ_ref`（窄帶後殘餘摺痕僅現於上段；可調，依 MCP 校正）。

## 判斷決策（已與使用者確認）

1. **僅 `flexionExtension` 驅動**——主 candy-wrapper 軸；多軸（髖外展/旋轉）corrective 為未來。
2. **每關節每 mesh 一 corrective morph**；biarticular mesh 僅烘其所在 band 之關節（控 morph 稀疏）。

## 測試與驗證

- **runtime（vitest，node 環境）**：
  - `correctiveWeight`：`onset` 下回 0、`ref` 上回 1、區間單調遞增。
  - `morphTargetController.sync`：NullEngine 建一具名 `corr.joint.knee` morph 之 mesh，給屈曲 pose → influence 正確；neutral pose → 全 0；左右 side 正確分流。
- **資產**：export log `MORPH_OK` count > 0；**Blender MCP** 渲染膝@130°（髖/踝）前後對比——塌陷修正、其餘不動。
- **設計同步**（專案規則）：本 spec ＋ `doc/design/04_human_model.md` §4.3.3/§4.6.3 ＋ `doc/todo/04_todo_human_model.md`。

## 檔案異動

- **改** `infra/asset-pipeline/rigSkin.py`：`add_corrective_shapekeys`。
- **改** `infra/asset-pipeline/exportGltf.py`：morph 匯出＋`MORPH_OK` log。
- **新** `app/utils/humanModel/motion/morphTargetController.ts`（＋ `.test.ts`）。
- **改** `app/components/humanModel/Model3DView.vue`：watcher 加 `morphTargetController.sync`、建立／釋放。
- **同步** `doc/design/04_human_model.md`、`doc/todo/04_todo_human_model.md`。
- **重出／部署** `public/models/anatomyV1.glb`（帶 morph）。

## 開放問題 / 風險

- 保體積目標數學之近似品質（以 MCP 視覺校正；必要時退回較簡之徑向體積回復）。
- glb 大小增幅（morph delta）——以稀疏化（`|delta|>ε`、跳過無顯著修正之 mesh）控制。
- `θ_onset/θ_ref` 調參（MCP）。
- 踝屈曲 ROM 小（背屈 ~20° / 蹠屈 ~50°），candy-wrapper 輕微，其 corrective 可能多被 `ε` 跳過——可接受（管線自動稀疏化，不需特例）。
