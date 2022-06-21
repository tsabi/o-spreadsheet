// interface ObjectWithId {
//   id : string;
// }

import { isDefined } from "../helpers";
import { StateObserver } from "../state_observer";
import {
  ApplyRangeChange,
  CellPosition,
  Position,
  Range,
  RangeProvider,
  UID,
  WorkbookHistory,
} from "../types";
import { RangeAdapter } from "./core/range";

export interface HeaderMap extends Iterable<[CellPosition, string]> {
  set(sheetId: UID, position: Position, id: ItemId): void;
  get(sheetId: UID, position: Position): ItemId | undefined;
  delete(sheetId: UID, position: Position): void;
  getPosition(value: string): CellPosition | undefined; //TODO change CellPosition into something generic
  positions(): CellPosition[];
}

type ItemId = string;

interface PositionMapManagerState {
  values: Record<UID, (ItemId | undefined)[][] | undefined>;
}

export class PositionMapManager implements RangeProvider, HeaderMap, PositionMapManagerState {
  static nextHistoryId = 0;
  private history: WorkbookHistory<PositionMapManagerState>;
  readonly values: Record<UID, (ItemId | undefined)[][] | undefined> = {};
  readonly inverseMap: Record<ItemId, Range | undefined> = {};

  constructor(stateObserver: StateObserver, range: RangeAdapter) {
    range.addRangeProvider(this.adaptRanges.bind(this));
    this.history = Object.assign(Object.create(stateObserver), {
      update: stateObserver.addChange.bind(stateObserver, this),
    });
  }

  *[Symbol.iterator](): Iterator<[CellPosition, string], void> {
    for (const range of Object.values(this.inverseMap).filter(isDefined)) {
      const sheetId = range.sheetId;
      const col = range.zone.left;
      const row = range.zone.top;
      const position = { sheetId, col, row };
      yield [position, this.get(sheetId, position)!];
    }
  }

  positions(): CellPosition[] {
    const result: CellPosition[] = [];
    for (const range of Object.values(this.inverseMap).filter(isDefined)) {
      result.push({ sheetId: range.sheetId, col: range.zone.left, row: range.zone.top });
    }
    return result;
  }

  adaptRanges(applyChange: ApplyRangeChange, sheetId?: UID) {
    // aggregate updates while iterating and apply them later
    const toModify: { range: Range; id: ItemId }[] = [];
    for (const currentRange of Object.values(this.inverseMap).filter(isDefined)) {
      const sheetId = currentRange.sheetId;
      const col = currentRange.zone.left;
      const row = currentRange.zone.top;
      const id = this.values[sheetId]?.[col]?.[row];
      if (!id || (sheetId && currentRange.sheetId !== sheetId)) {
        continue;
      }
      const change = applyChange(currentRange);
      // console.log(`${key.replace(/.*COL(.*)ROW(.*)/, "($1, $2)")} change ${change.changeType}`)
      switch (change.changeType) {
        case "REMOVE":
          this.history.update("values", sheetId, col, row, undefined);
          break;
        case "RESIZE":
          throw new Error("Cannot resize a cell range");
        case "MOVE":
        case "CHANGE":
          const range = change.range;
          toModify.push({ range, id });
          this.history.update("values", sheetId, col, row, undefined); // delete previous entry
          break;
      }
    }
    for (const { range, id } of toModify) {
      const sheetId = range.sheetId;
      const col = range.zone.left;
      const row = range.zone.top;
      this.history.update("values", sheetId, col, row, id);
      // this.history.update("values", sheetId, key, "id", "position", position);
    }
  }

  set(sheetId: UID, position: Position, id: ItemId) {
    const { col, row } = position;
    const value = this.get(sheetId, position);
    if (value) {
      this.history.update("values", sheetId, col, row, id);
    }
    this.history.update("values", sheetId, col, row, id);
  }

  get(sheetId: UID, { col, row }: Position): ItemId | undefined {
    // default value?
    return this.values[sheetId]?.[col]?.[row];
  }

  getPosition(id: string): CellPosition | undefined {
    const range = this.inverseMap[id];
    if (!range) {
      return undefined;
    }
    return { col: range.zone.left, row: range.zone.top, sheetId: range.sheetId };
  }

  delete(sheetId: UID, { col, row }: Position) {
    const id = this.get(sheetId, { col, row });
    if (id) {
      this.history.update("values", sheetId, col, row, undefined); // remove previous entry
    }
  }
}
