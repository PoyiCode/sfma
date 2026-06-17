# 物理治療 APP — 設計文件

本目錄為物理治療 APP 的設計規格文件。原始草稿為 [`00_draft.md`](00_draft.md)，以下文件依設計面向分類補全。

> 文件語言：zh-tw。本文件為「設計規格」，不含時程規劃與 todo。

## 文件導覽

| 編號 | 文件 | 內容 |
| --- | --- | --- |
| 00 | [00_draft.md](00_draft.md) | 原始需求草稿（來源，不修改） |
| 01 | [01_overview.md](01_overview.md) | 專案總覽：目的、使用者、情境、範圍、核心概念 |
| 02 | [02_architecture.md](02_architecture.md) | 技術架構：框架選型、平台支援、模組與資料流、開發者模式 |
| 03 | [03_ui_ux.md](03_ui_ux.md) | 介面與互動：方向模式、響應式佈局、主要畫面、導覽架構、操作手勢、設計系統（token／主題／元件） |
| 04 | [04_human_model.md](04_human_model.md) | 人體模型：3D 模型、分層、關節 ROM、肌肉色彩、LOD、效能預算、自製圖資（含 2D SVG 抽取管線） |
| 05 | [05_assessment.md](05_assessment.md) | 評估表：SFMA 計分、10 大動作完整欄位、二階 Breakout 引導流程（決策樹）、授權注意 |
| 06 | [06_data_model.md](06_data_model.md) | 資料模型：JSON 結構、個案、評估紀錄、設定資料、匯出／匯入、範例與版本 |
| 07 | [07_dev_conventions.md](07_dev_conventions.md) | 開發規範：命名規則、專案結構、資料儲存策略、測試、i18n |
| 08 | [08_security_privacy.md](08_security_privacy.md) | 資安與隱私：本地儲存與匯出檔保護、未來上雲要求、個資法（PDPA）、開發者模式邊界 |

> 技術方向：**Web 優先**。瀏覽器開啟、3D 模型為雲端服務，技術以 **TypeScript** 為主，跨平台以 **PWA** 達成。
> 資料策略：**APP 先獨立開發** — 開發期單機本地儲存（IndexedDB）＋ JSON 匯出／匯入；**未來補上：資料上傳到 PostgreSQL**。詳見 [02_architecture.md](02_architecture.md)。

> 勘誤：00 草稿內的參考連結 `./ref/SFMA_form.pdf`，實際檔案位於 [`../ref/SFMA_form.pdf`](../ref/SFMA_form.pdf)（草稿為來源文件、不修改，於此註記）。
> 參考轉錄：SFMA 計分表與全部判讀流程圖之文字轉錄見 [`../ref/SFMA_form.md`](../ref/SFMA_form.md) — Breakout 決策樹（05 §5.3、06 §6.4）之**唯一編碼依據**；僅供專案內部參考（授權注意見 05 §5.6）。
> 圖資授權：3D／2D 解剖圖資以開源資源加工（Z-Anatomy，CC BY-SA 4.0；骨架取自 MakeHuman，匯出模型 CC0）。資產檔須標示來源並以 CC BY-SA 散布，APP 程式碼不受影響；詳見 [04_human_model.md](04_human_model.md) §4.6.1、[05_assessment.md](05_assessment.md) §5.6。

## 名詞與縮寫對照

### SFMA 計分分類

| 縮寫 | 英文 | 中文 |
| --- | --- | --- |
| FN | Functional & Non-painful | 功能正常且無痛 |
| FP | Functional & Painful | 功能正常但疼痛 |
| DN | Dysfunctional & Non-painful | 功能異常且無痛 |
| DP | Dysfunctional & Painful | 功能異常且疼痛 |

### 二階 Breakout 分類（findings 與 classification）

| 縮寫 | 英文 | 中文 |
| --- | --- | --- |
| SMCD | Stability / Motor Control Dysfunction | 穩定性／動作控制功能障礙 |
| JMD | Joint Mobility Dysfunction | 關節活動度功能障礙 |
| TED | Tissue Extensibility Dysfunction | 組織延展性功能障礙 |
| PAIN | Pain（Treat Pain／Treat Chemical Pain） | 疼痛處理端點（流程中誘發疼痛，優先處理） |
| OTHER | Other Dysfunction | 其他功能障礙（前庭功能障礙、本體感覺缺損等；單腳站立流程端點） |

### 其他

| 縮寫 | 英文 | 中文 |
| --- | --- | --- |
| SFMA | Selective Functional Movement Assessment | 選擇性功能動作評估 |
| ROM | Range of Motion | 關節活動範圍 |
| LOD | Level of Detail | 細節層級（模型精簡／完整版） |
| PWA | Progressive Web App | 漸進式網頁應用程式（可安裝、可離線） |
| glTF | GL Transmission Format | 3D 模型傳輸格式（.gltf／.glb） |
| FMA | Foundational Model of Anatomy | 解剖基礎模型本體論（BodyParts3D／Z-Anatomy 部位命名依據） |
| IK | Inverse Kinematics | 反向運動學（驅動關節活動） |
| CDN | Content Delivery Network | 內容傳遞網路（分發 3D 資產） |
| PDPA | Personal Data Protection Act | 個人資料保護法（個資法） |
| RLS | Row-Level Security | 列級存取控制 |
| UE | Upper Extremity | 上肢 |
| ASIS | Anterior Superior Iliac Spine | 髂前上棘 |
| MRE | Medial Rotation-Extension | 內旋—伸展（上肢模式一） |
| LRF | Lateral Rotation-Flexion | 外旋—屈曲（上肢模式二） |
| CTSIB | Clinical Test of Sensory Interaction on Balance | 臨床感覺統合與平衡測試 |
| OA | Occipito-Atlantal | 枕寰關節 |
| SLR | Straight Leg Raise | 直膝抬腿 |
| FABER | Flexion-Abduction-External Rotation | 屈曲—外展—外旋測試 |
| MSF／MSE／MSR | Multi-Segmental Flexion／Extension／Rotation | 多節段屈曲／伸展／旋轉 |
| SLS | Single-Leg Stance | 單腳站立 |
| ODS | Overhead Deep Squat | 過頭深蹲 |
| BB | Backward Bend | 後彎 |
| PSCF／PSCR | Passive Supine Cervical Flexion／Rotation | 被動仰臥頸屈／頸旋轉 |
| IR／ER | Internal／External Rotation | 內轉／外轉 |
| (CH) | —（SFMA 原文標示） | Lumbar Locked 測試之手位變化標記（見 [../ref/SFMA_form.md](../ref/SFMA_form.md)） |
| SI | Sacroiliac | 薦髂（關節） |
