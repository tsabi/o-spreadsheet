import { range, UuidGenerator } from ".";
import { Cloneable, UID, Zone } from "../types/misc";

export class FilterTable implements Cloneable<FilterTable> {
  zone: Zone;
  filters: Filter[];

  constructor(zone: Zone) {
    this.filters = [];
    this.zone = zone;
    const uuid = new UuidGenerator();
    for (const i of range(zone.left, zone.right + 1)) {
      const filterZone = { ...this.zone, left: i, right: i };
      this.filters.push(new Filter(uuid.uuidv4(), filterZone));
    }
  }

  /** Get zone of the table without the headers */
  get contentZone(): Zone | undefined {
    if (this.zone.bottom === this.zone.top) {
      return undefined;
    }
    return { ...this.zone, top: this.zone.top + 1 };
  }

  getFilterId(col: number): string | undefined {
    for (let i = 0; i < this.filters.length; i++) {
      if (this.filters[i].col === col) {
        return this.filters[i].id;
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
  id: UID;
  zoneWithHeaders: Zone;

  constructor(id: UID, zone: Zone) {
    if (zone.left !== zone.right) {
      throw new Error("Can only define a filter on a single column");
    }
    this.id = id;
    this.zoneWithHeaders = zone;
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
    return new Filter(this.id, this.zoneWithHeaders);
  }
}
