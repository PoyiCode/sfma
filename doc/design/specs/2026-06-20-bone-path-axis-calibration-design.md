# 下肢 bone-path 軸/sign 校正 — 設計

> 日期：2026-06-20｜分支：feat/fullbody-rig-skin｜關聯：[04 §4.3.3](../04_human_model.md)、[skin-deformation-runtime](2026-06-19-skin-deformation-runtime-design.md)、[fullbody-rig-skin-pipeline](2026-06-19-fullbody-rig-skin-pipeline-design.md)

## 目標與範圍

校正 bone-driven rig 路徑中 **下肢 6 個 DOF entries**，使每個解剖 DOF 以解剖正確的軸、正確的 sign 旋轉真實 glb 骨架，左右雙側皆正確，且保留既有 ROM。

- 動到的檔：**僅** `app/utils/humanModel/motion/boneRigMap.ts`（＋其測試＋文件同步）。
- **不在範圍**：rigid fallback（`jointKinematics.ts`，world-axis，僅骨架偵測失敗才用＋驅動已停用之 gizmo 弧）、corrective morph（`morphTargetController.ts`）。
- DOF entries：`joint.hip` {flexionExtension, abductionAdduction, internalExternalRotation}、`joint.knee` {flexionExtension}、`joint.ankle` {plantarDorsiflexion, inversionEversion}。

背景：`boneRigMap.ts` 現值全為 placeholder（比照 rigid 路 worldAxis/sign 複製、bone-local 0/15 校正）；header 已註明「待真資產實機目視校正」。本設計即執行該校正之下肢部分。

## 方法 — 解析推導軸、目視確認 sign

bone path 套用：`q = rest · RotationAxis(localAxis, deg·sign·DEG2RAD)`（見 `boneRig.ts` applyPose），故一個 DOF 的世界有效旋轉軸＝`R_bone_rest_world · localAxis`。要讓骨繞解剖世界軸 `W` 旋轉：

> **`localAxis = R_bone_rest_world⁻¹ · W`**

世界軸 `W`（neutral 站姿座標：+Y 上、X 內外側/額狀、Z 前後/矢狀）：
- flexion/extension（矢狀面）＝ **±X**
- abduction/adduction（額狀面）＝ **±Z**
- internal/external rotation（橫向）＝ **±Y**
- ankle plantar/dorsiflexion（矢狀面）＝ **±X**
- ankle inversion/eversion（額狀面近似）＝ **±Z**

`R_bone_rest_world` 由 **將已部署之 `public/models/anatomyV1.glb` 重新匯入 Blender** 讀取（rest frame 與 app 出貨一致、含 MakeHuman bone roll）。**sign** 先以 ROM 正向慣例（正角＝flexion/abduction…）推得最佳猜值，再以 contact sheet 目視確認。

## 校正流程

1. **讀 rest frame**（Blender MCP）：`upperleg01.{L,R}`、`lowerleg01.{L,R}`、`foot.{L,R}` 之絕對 rest 旋轉。
2. **推導**：以上式算 6 DOF × 2 側之 `localAxis`（＋最佳猜 sign）→ 推導表。
3. **產 contact sheet**（Blender MCP）：每 DOF × 側，將骨以 `RotationAxis(localAxis, sign·angle)` 擺於 **min / neutral / max** ROM，固定相機渲染，montage 成一張標註網格圖。
4. **使用者判讀**單張 sheet：標出動錯之 DOF（彎錯向＝翻 sign；扭轉/錯平面＝軸錯；左≠右鏡像＝per-side 問題）。
5. **編碼**：將確認/修正值寫入 `BONE_RIG_MAP`（localAxis 可能成非主軸向量如 `[0,0.71,0.71]`）；placeholder「待校正」註解改為已校正。
6. **僅重渲被標錯之 DOF** 二次確認；無則完成。

## Per-side 處理（contingency）

現 `BONE_RIG_MAP` 每關節**單一共用 entry**（resolveBoneName 解析 `.L`/`.R` 骨）。因 `localAxis` 由各骨自身 rest frame 推導，步驟 2 即可知左右是否需**相同**向量（ROM 鏡像＋對稱 rest 處理方向）或**不同**向量：

- 左右推導值相同 → **保持共用結構不變**。
- 左右確實不同 → 屆時才擴充資料結構加 per-side axis/sign override（YAGNI，不預先做）。

## 測試與驗收

- **單元**（`boneRigMap.test.ts`，NullEngine）：斷言校正後 `localAxis`/`sign` 值；斷言 `boneRig.applyPose` 對代表 pose 驅動骨至預期 bone-local quaternion（容差內）。
- **目視驗收**＝使用者對 contact sheet 簽核（本任務核心人為閘）。
- **組合 pose 健檢**（Blender 渲染）：自然組合 pose（如坐姿 髖屈 90°＋膝屈 90°）確認 DOF 可正確疊合。
- 全 `pnpm test` ＋ `typecheck` ＋ `lint` 綠。

## 風險與不相依

- **不依賴 headless WebGL**：Blender 渲染同一骨架為主工具；real-app Playwright 抽查僅 best-effort。
- **rest-pose 假設**：推導假設 glb rest＝解剖 neutral 站姿；讀取時驗 rest 外觀為 neutral，contact sheet 抓重大違反。
- **與 corrective morph 不相依**：morph influence 由 `|angle|` 驅動（與軸無關），故重校軸/sign 不擾動 corrective shape keys。
