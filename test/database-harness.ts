import { jest } from "@jest/globals";
import { getTableName, SQL, Table } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";

type Step = { table: Table; rows?: unknown[]; error?: Error };
export type Operation = { kind: string; table?: Table; values?: unknown; where?: SQL; lock?: string; limit?: number; offset?: number; order?: unknown[]; joins?: SQL[]; fields?: unknown };

// A strict scripted query boundary, not a SQL engine. Real Drizzle expressions
// are retained for parameter/locking assertions; unexpected reads fail closed.
export function databaseHarness() {
  const reads: Step[] = [];
  const results: Array<{ insertId?: number; affectedRows?: number } | Error> = [];
  const operations: Operation[] = [];
  const committed: Operation[] = [];
  let insideTransaction = false;
  function chain(operation: Operation) {
    let executed: Promise<unknown[]> | undefined;
    const query = {
      from(table: Table) { operation.table = table; return query; },
      innerJoin(_table: Table, predicate: SQL) { (operation.joins ??= []).push(predicate); return query; },
      leftJoin(_table: Table, predicate: SQL) { (operation.joins ??= []).push(predicate); return query; },
      where(value: SQL) { operation.where = value; return query; },
      limit(value: number) { operation.limit = value; return query; },
      offset(value: number) { operation.offset = value; return query; },
      orderBy(...value: unknown[]) { operation.order = value; return query; },
      groupBy() { return query; },
      for(value: string) { operation.lock = value; return query; },
      set(value: unknown) { operation.values = value; return query; },
      values(value: unknown) { operation.values = value; return query; },
      onDuplicateKeyUpdate(value: unknown) { operations.push({ kind: "upsert", table: operation.table, values: value }); return query; },
      then(resolve: (value: unknown[]) => unknown, reject: (error: unknown) => unknown) {
        executed ??= (async () => {
          operations.push(operation);
          if (operation.kind === "select") {
            const step = reads.shift();
            if (!step || step.table !== operation.table) throw new Error(`Unexpected read: ${operation.table ? getTableName(operation.table) : "no table"}`);
            if (step.error) throw step.error;
            return step.rows ?? [];
          }
          const result = results.shift() ?? { insertId: 1, affectedRows: 1 };
          if (result instanceof Error) throw result;
          if (!insideTransaction) committed.push(operation);
          return [result];
        })();
        return executed.then(resolve, reject);
      },
    };
    return query;
  }
  const client = {
    select: jest.fn((fields?: unknown) => chain({ kind: "select", fields })),
    insert: jest.fn((table: Table) => chain({ kind: "insert", table })),
    update: jest.fn((table: Table) => chain({ kind: "update", table })),
    delete: jest.fn((table: Table) => chain({ kind: "delete", table })),
  };
  const transaction = jest.fn(async (callback: (tx: typeof client) => Promise<unknown>) => {
    const start = operations.length;
    operations.push({ kind: "begin" });
    insideTransaction = true;
    try {
      const result = await callback(client);
      committed.push(...operations.slice(start).filter(op => ["insert", "update", "delete"].includes(op.kind)));
      operations.push({ kind: "commit" });
      return result;
    } catch (error) {
      operations.push({ kind: "rollback" });
      throw error;
    } finally { insideTransaction = false; }
  });
  return {
    db: { ...client, transaction }, reads, results, operations, committed,
    reset() { reads.length = results.length = operations.length = committed.length = 0; jest.clearAllMocks(); },
    read(table: Table, ...rows: unknown[]) { reads.push({ table, rows }); },
    writes(table?: Table) { return operations.filter(op => ["insert", "update", "delete"].includes(op.kind) && (!table || table === op.table)); },
    queries(table: Table) { return operations.filter(op => op.kind === "select" && op.table === table); },
  };
}

export function sqlQuery(operation: Operation) {
  if (!operation.where) throw new Error("Expected a SQL predicate");
  return new MySqlDialect().sqlToQuery(operation.where);
}
export const NOW = new Date("2026-09-07T12:00:00.000Z");
export const FUTURE = new Date("2026-09-08T12:00:00.000Z");
