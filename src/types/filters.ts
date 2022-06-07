import { Range, Zone } from "./misc";

export class FilterTable {
  range: Range;
  filters: Filter[];
  createRange: (zone: Zone) => Range;

  constructor(zone: Zone, createRange: (zone: Zone) => Range) {
    this.createRange = createRange;
    this.range = createRange(zone);

    this.filters = [];
    for (let i = this.zone.left; i <= this.zone.right; i++) {
      const filterZone = { ...this.zone, left: i, right: i };
      this.filters.push(new Filter(createRange(filterZone), []));
    }
  }

  get zone() {
    return this.range.zone;
  }

  getFilterId(col: number): number | undefined {
    for (let i = 0; i < this.filters.length; i++) {
      if (this.filters[i].col === col) {
        return i;
      }
    }
    return undefined;
  }
}

export class Filter {
  fullRange: Range;
  filteredValues: string[];

  constructor(range: Range, filterValues: string[]) {
    if (range.zone.left !== range.zone.right) {
      throw new Error("Can only define a filter on a single column");
    }
    this.fullRange = range;
    this.filteredValues = filterValues;
  }

  get col() {
    return this.fullRange.zone.left;
  }
  get startRow() {
    return this.fullRange.zone.top;
  }
  get endRow() {
    return this.fullRange.zone.bottom;
  }
  get filteredZone() {
    return { ...this.fullRange.zone, top: this.fullRange.zone.top + 1 };
  }
}
