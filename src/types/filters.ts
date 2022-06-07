import { Cloneable, Zone } from "./misc";

export class FilterTable implements Cloneable<FilterTable> {
  zone: Zone;
  filters: Filter[];

  constructor(zone: Zone) {
    this.filters = [];
    this.zone = zone;
    for (let i = this.zone.left; i <= this.zone.right; i++) {
      const filterZone = { ...this.zone, left: i, right: i };
      this.filters.push(new Filter(filterZone, []));
    }
  }
  /** Get zone of the table without the headers */
  get contentZone(): Zone | undefined {
    if (this.zone.bottom === this.zone.top) {
      return undefined;
    }
    return { ...this.zone, top: this.zone.top + 1 };
  }

  getFilterId(col: number): number | undefined {
    for (let i = 0; i < this.filters.length; i++) {
      if (this.filters[i].col === col) {
        return i;
      }
    }
    return undefined;
  }

  clone(): FilterTable {
    const table = new FilterTable(this.zone);
    table.filters = this.filters.map((filter) => filter.clone());
    return table;
  }
}

export class Filter implements Cloneable<Filter> {
  zoneWithHeaders: Zone;
  filteredValues: string[];

  constructor(zone: Zone, filterValues: string[]) {
    if (zone.left !== zone.right) {
      throw new Error("Can only define a filter on a single column");
    }
    this.zoneWithHeaders = zone;
    this.filteredValues = filterValues;
  }

  get col() {
    return this.zoneWithHeaders.left;
  }

  /** Filtered zone, ie. zone of the filter without the header */
  get filteredZone(): Zone | undefined {
    const zone = this.zoneWithHeaders;
    if (zone.bottom === zone.top) {
      return undefined;
    }
    return { ...zone, top: zone.top + 1 };
  }

  clone(): Filter {
    return new Filter(this.zoneWithHeaders, this.filteredValues);
  }
}

export interface FilterTableData {
  range: string;
  filters: FilterData[];
}

export interface FilterData {
  col: number;
  filteredValues: string[];
}
