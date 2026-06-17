# 內容缺口稽核：原始系統 vs App 已建模

> 產生：2026-06-16，工具 `infra/asset-pipeline/contentGapAudit.mjs`（純 node、執行＋自檢驗證）。
> 目的：以原始 `z-anatomy.blend` 系統 1/2/3/4/7 之**不壓縮 glb**（`exportSystemsGltf.py` 產、`out/` gitignored）比對 app 策劃 `manifestV1.json`，量化「原始已建模但 app 未納」之缺口，**驅動未來內容擴張決策**。
> 性質：純分析。本稽核不改 app／manifest／definitions；建模範圍仍須使用者／PT 定奪。

## 方法

- **set A（原始已建模）**＝各系統 glb 之 mesh-node 名（＝原始 Blender 物件名，`exportSystemsGltf.py` 不改名）。
- **set B（app 已消費）**＝`manifestV1.json` 全 `sourceObject`／`sourceObjects` 之聯集（762 名）。
- **正規化**（兩側統一）：去 Blender 去重尾碼 `.NNN` → 去側別/附著後綴 token（`\.(?:[eo]\d*)?[lr]$`＝`.l/.r/.el/.er/.ol/.or/.e1l…`）→ 去括號 → lowercase/trim。中線件（Linea alba／Fourth ventricle）無後綴＝單一 base。
- 每系統：`sourceBases`（去側別後唯一名）、`covered`＝∩ manifest bases（**全域**：一原始件凡被任一 entity 消費即計 covered，不限系統）、`gap`＝− manifest bases。

## 總覽

| 系統 | raw mesh-node | sourceBases | covered | gap | 缺口性質 |
| --- | ---: | ---: | ---: | ---: | --- |
| 1 Skeletal system | 277 | 159 | 129 | **30** | 牙齒/喉軟骨/聽小骨/鼻竇細節（低 MSK-PT 優先） |
| 2 Muscular insertions | 705 | 167 | 142 | **25** | **設計性**：附著足跡≠新解剖（base 多對應已建模肌） |
| 3 Joints | 409 | 234 | 41 | **193** | **被動結構長尾**：韌帶 140／關節囊 12／半月板·唇·盤等 |
| 4 Muscular system | 669 | 337 | 227 | **110** | 結締/被動 71（滑囊·鞘·筋膜·隔·支持帶）＋真實肌 39 |
| 7 Nervous system | 581 | 317 | 15 | **302** | 周邊神經細支＋叢分支＋CNS（核/迴/徑）＋感官 |

> manifest：entities 581、來源名 762 → bases 412。app 已涵蓋骨/肌主幹之多數（骨 129/159、肌 227/337 base 命中）；缺口集中於**被動結構長尾**（韌帶/關節囊）、**神經細支與 CNS**、與**設計上不另列之附著足跡**。

## 逐系統洞見

### 1 Skeletal（gap 30）— 結構性接近完整
骨骼主幹已涵蓋（covered 129）。缺口幾乎非承重/運動骨：
- **牙齒 20**（上/下門齒·犬齒·前臼齒·臼齒）— 牙科範疇、非 MSK-PT。
- **喉軟骨 4**（甲狀/環狀/杓狀/小角軟骨）、**聽小骨 3**（錘/砧/鐙骨）、**鼻/篩軟骨·鼻竇 ~6**（篩竇前/中/後群、鼻中隔/大翼軟骨、額/蝶竇）。
- **足籽骨 1**（sesamoid bones of foot）— 唯一具潛在足部 PT 價值之骨缺。
→ **建議**：MSK-PT 範圍視為已足；如擴足部可補足籽骨。其餘屬頭頸專科/牙科，demand-first。

### 2 Muscular insertions（gap 25、covered 142）— 設計性未建模
附著足跡（origin `.o*`／end `.e*` 後綴）為**已建模肌肉之附著區**、非新解剖。142/167 base 名對應已建模肌（如 `Fibularis brevis muscle.el`→`fibularis brevis muscle`）；25「gap」為命名粒度差（整肌名 vs app 建模之肌頭名，如 `Biceps brachii muscle.el` vs 建模之 long/short head）或共同肌腱（common extensor/flexor tendon）。
→ **建議**：**全系統設計上不另列 app 部位**。附著資訊宜走 `muscle.attachments` 屬性（語意資料）、非獨立幾何。

### 3 Joints（gap 193、covered 41）— 被動結構長尾（最大可行域）
manifest 已 curated 代表性被動結構（ACL/PCL＋5 韌帶、23 椎間盤、關節囊/盤等，見 release_checklist §4）；缺口為其長尾：
- **韌帶 140**（acromioclavicular／annular／talofibular／sacro-iliac…全身具名韌帶）。
- **關節囊 12**、**半月板 2**（medial/lateral meniscus）、**關節唇 2**（acetabular/glenoid labrum）、**關節內纖維膜 4**、**髓核 nucleus pulposus C2-C3…（disc 細部）**、**髕下脂肪墊**等 28。
→ **建議（demand-first 優先序）**：臨床高頻者先補——**半月板（膝）·關節唇（肩/髖）**（撕裂主訴）＞**主要關節囊**＞具名韌帶長尾（依源料良模度，㊿ 已記多數副韌帶為退化 stub 不可用）。

### 4 Muscular system（gap 110、covered 227）— 結締組織 71＋真實肌 39
- **非肌之被動/結締 71**：滑囊 31、腱鞘 13、筋膜 9、肌間隔 7、支持帶 9、肌腱 2 — manifest 已 curated 代表性滑囊/筋膜（demand-first），餘為長尾，**多屬設計性不逐一建模**。
- **真實肌 39（可行肌缺口）**：**眼外肌 7**（上/下/內/外直肌·上/下斜肌·提上瞼肌）、**咽縮肌群 5**（上/中/下咽縮·莖突咽·腭咽）、**喉內肌 ~8**（環杓·甲杓·杓·環甲各部）、**舌肌 2**（頦舌·舌骨舌）、**骨盆底 3**（恥骨直腸·提肛腱弓·肛門外括約）、**肋提肌 2**。
→ **建議**：上述真實肌屬頭頸/內臟/骨盆區，MSK-PT 四肢軀幹優先序之下；**骨盆底肌**對特定 PT（婦科/失禁）具價值，可 demand-first 評估。

### 7 Nervous（gap 302、covered 15）— 僅納主幹周邊神經
app 僅建模 **15 條四肢主幹神經**（axillary／median／radial／ulnar／musculocutaneous／femoral／sciatic／tibial／obturator／common·deep·superficial fibular／gluteal／subscapular／suprascapular）供 innervation 對應。缺口：
- **周邊神經細支 ~105＋臂/腰/薦叢分支 ~105**（anterior/posterior division of trunk…、各皮神經分支）— **demand-first 可行**：如需精細 innervation 標註可逐步補。
- **CNS ~73**（迴 gyrus 29／徑 tract 15／核 nucleus 13／皮質·胼胝體等 13／腦室 3）、**感官 19**（眼 14：角膜/前房/淚器…；耳 5：耳蝸/鼓膜/咽鼓管…）— **設計性未建模**、非 MSK-PT 範疇。
→ **建議**：MSK 神經對應以現 15 主幹為核心；**周邊細支**依評估需求 demand-first；CNS/感官明確排除。

## 誠實限制

- base-name 正規化為**啟發式**（側別/附著後綴）；命名粒度差（整肌 vs 肌頭、共同肌腱）會使少數件誤判 covered/gap。本報告以**量級與分類洞見**為主、**非逐名精確契約**。
- 缺口含大量**設計性未建模**（insertions 全系統、joints 被動長尾、muscular 結締組織、nervous CNS/感官）；分類已標示，避免將「刻意不建模」誤呈為「待補」。
- covered 取**全域** manifest bases（跨系統）；「合計 gap」含跨系統重複計數，非唯一解剖件數。
- 源料良模度未納入本稽核（㊿/51 已記多數副韌帶/半月板為退化 stub）；實際可建模性須逐件查 verts/島嶼，建模前另核。
- 稽核讀 gitignored 原始 glb（本機產物）；clean checkout 無檔屬預期（匯出後分析工具、非 CI 常駐，比照 `verifySystemsExport.mjs`）。完整逐名缺口存 `infra/asset-pipeline/out/contentGap.json`（gitignored）。重跑：`node infra/asset-pipeline/contentGapAudit.mjs`（先 `exportSystemsGltf.py` 產 glb）。

## 結論（驅動決策）

App 之 MSK-PT 核心（骨骼主幹＋四肢軀幹肌＋主幹神經＋代表性被動結構）相對原始系統**涵蓋良好**。未來內容擴張最高價值候選（須使用者／PT 定奪）：
1. **關節被動結構**：半月板·關節唇·主要關節囊（臨床高頻、joints 長尾之精選）。
2. **骨盆底肌**（婦科/失禁 PT；muscular「真實肌」缺口中 MSK 相關度最高）。
3. **周邊神經細支**（依精細 innervation 需求 demand-first）。

明確**排除**（設計性、非 MSK-PT）：牙齒、喉/咽/眼外/聽覺結構、CNS（迴/徑/核/腦室）、肌肉附著足跡（走語意屬性而非幾何）。
