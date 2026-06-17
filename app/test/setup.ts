// vitest 全域設定。資料層測試（localStore／exporter／importer）需要 IndexedDB；
// node 環境本身無此 API，故載入 fake-indexeddb 提供全域 indexedDB（02 §2.6）。
import 'fake-indexeddb/auto';
