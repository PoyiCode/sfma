import { describe, expect, it } from 'vitest';
import { applyMigrations, type MigrationSteps } from './migrations';

const STEPS: MigrationSteps = {
  1: (record) => ({ ...record, schemaVersion: 2, renamed: record.original }),
  2: (record) => ({ ...record, schemaVersion: 3, extra: true }),
};

describe('applyMigrations（06 §6.8）', () => {
  it('版本已為目標 → 原樣通過', () => {
    const record = { schemaVersion: 3, value: 1 };
    expect(applyMigrations(record, STEPS, 3)).toBe(record);
  });

  it('依序套用 v1→v3', () => {
    const migrated = applyMigrations({ schemaVersion: 1, original: 'x' }, STEPS, 3);
    expect(migrated).toMatchObject({ schemaVersion: 3, renamed: 'x', extra: true });
  });

  it('缺遷移步驟 → 擲錯', () => {
    expect(() => applyMigrations({ schemaVersion: 1 }, {}, 2)).toThrow(/missing migration/);
  });

  it('版本比目標新 → 擲錯', () => {
    expect(() => applyMigrations({ schemaVersion: 4 }, STEPS, 3)).toThrow(/newer/);
  });

  it('schemaVersion 非正整數 → 擲錯', () => {
    expect(() => applyMigrations({ schemaVersion: 'x' }, STEPS, 3)).toThrow(
      /invalid schemaVersion/,
    );
  });
});
