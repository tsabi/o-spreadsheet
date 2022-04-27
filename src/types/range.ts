import { Cloneable, Getters } from ".";
import { isRowReference, toUnboundZone } from "../helpers";
import { _lt } from "../translation";
import { UID, UnboundedZone, Zone, ZoneDimension } from "./misc";

export interface RangePart {
  colFixed: boolean;
  rowFixed: boolean;
}

interface StatelessRangeInterface {
  zone: Zone | UnboundedZone; // the zone the range actually spans
  sheetName?: string; // the sheet on which the range is defined
  parts: RangePart[];
  invalidXc?: string;
  prefixSheet: boolean; // true if the user provided the range with the sheet name, so it has to be recomputed with the sheet name too
}

interface RangeInterface extends StatelessRangeInterface {
  sheetId: UID; // the sheet on which the range is defined
  invalidSheetName?: string; // the name of any sheet that is invalid
}

export class StatelessRange {
  /** the zone the range actually spans */
  protected _zone: Zone | UnboundedZone;
  readonly parts: RangePart[];
  readonly sheetName?: string;
  readonly invalidXc?: string | undefined;
  readonly prefixSheet: boolean = false;

  static getInterface(xc: string): StatelessRangeInterface {
    let sheetName = "";
    let prefixSheet = false;
    if (xc.includes("!")) {
      [sheetName, xc] = xc.split("!");
      if (sheetName) {
        prefixSheet = true;
      }
    }
    const zone = toUnboundZone(xc);
    const parts = this.getRangeParts(xc, zone);
    return { zone, parts, sheetName, prefixSheet };
  }

  constructor(args: StatelessRangeInterface) {
    this._zone = args.zone;
    this.parts = args.parts;
    this.sheetName = args.sheetName;
    this.prefixSheet = args.prefixSheet;
    this.invalidXc = args.invalidXc;
  }

  private static getRangeParts(xc: string, zone: UnboundedZone): RangePart[] {
    const parts: RangePart[] = xc.split(":").map((p) => {
      const isFullRow = isRowReference(p);
      return {
        colFixed: isFullRow ? false : p.startsWith("$"),
        rowFixed: isFullRow ? p.startsWith("$") : p.includes("$", 1),
      };
    });

    const isFullCol = zone.bottom === undefined;
    const isFullRow = zone.right === undefined;
    if (isFullCol) {
      parts[0].rowFixed = parts[0].rowFixed || parts[1].rowFixed;
      parts[1].rowFixed = parts[0].rowFixed || parts[1].rowFixed;
      if (zone.left === zone.right) {
        parts[0].colFixed = parts[0].colFixed || parts[1].colFixed;
        parts[1].colFixed = parts[0].colFixed || parts[1].colFixed;
      }
    }
    if (isFullRow) {
      parts[0].colFixed = parts[0].colFixed || parts[1].colFixed;
      parts[1].colFixed = parts[0].colFixed || parts[1].colFixed;

      if (zone.top === zone.bottom) {
        parts[0].rowFixed = parts[0].rowFixed || parts[1].rowFixed;
        parts[1].rowFixed = parts[0].rowFixed || parts[1].rowFixed;
      }
    }

    return parts;
  }

  get isFullCol(): boolean {
    return this._zone.bottom === undefined;
  }

  get isFullRow(): boolean {
    return this._zone.right === undefined;
  }

  get zone(): UnboundedZone {
    return this._zone;
  }

  /**
   * Check that a zone is valid regarding the order of top-bottom and left-right.
   * Left should be smaller than right, top should be smaller than bottom.
   * If it's not the case, simply invert them, and invert the linked parts
   * (in place!)
   */
  orderZone() {
    if (this._zone.right !== undefined && this._zone.right < this._zone.left) {
      let right = this._zone.right;
      this._zone.right = this._zone.left;
      this._zone.left = right;

      let rightFixed = this.parts[1].colFixed;
      this.parts[1].colFixed = this.parts[0].colFixed;
      this.parts[0].colFixed = rightFixed;
    }

    if (this._zone.bottom !== undefined && this._zone.bottom < this._zone.top) {
      let bottom = this._zone.bottom;
      this._zone.bottom = this._zone.top;
      this._zone.top = bottom;

      let bottomFixed = this.parts[1].rowFixed;
      this.parts[1].rowFixed = this.parts[0].rowFixed;
      this.parts[0].rowFixed = bottomFixed;
    }
  }
}

export class Range extends StatelessRange implements Cloneable {
  sheetId: UID; // the sheet on which the range is defined
  invalidSheetName?: string; // the name of any sheet that is invalid

  constructor(args: RangeInterface, private getSheetSize: (sheetId: UID) => ZoneDimension) {
    super({
      zone: args.zone,
      parts: args.parts,
      sheetName: args.sheetName,
      prefixSheet: args.prefixSheet,
      invalidXc: args.invalidXc,
    });

    if (args.zone.bottom === undefined) debugger;
    this.sheetId = args.sheetId;
    this.invalidSheetName = args.invalidSheetName;
  }

  get unboundedZone(): UnboundedZone {
    return this._zone;
  }

  get zone(): Zone {
    const { left, top, bottom, right } = this._zone;
    if (right !== undefined && bottom !== undefined) return { left, top, right, bottom };
    else if (bottom === undefined && right !== undefined) {
      return { right, top, left, bottom: this.getSheetSize(this.sheetId).height - 1 };
    } else if (right === undefined && bottom !== undefined) {
      return { bottom, left, top, right: this.getSheetSize(this.sheetId).width - 1 };
    }
    throw new Error(_lt("Bad zone format"));
  }

  /**
   *
   * @param rangeParams optional, values to put in the cloned range instead of the current values of the range
   */
  clone(rangeParams?: Partial<RangeInterface>): Range {
    return new Range(
      {
        zone: rangeParams?.zone ? rangeParams.zone : { ...this._zone },
        sheetId: rangeParams?.sheetId ? rangeParams.sheetId : this.sheetId,
        sheetName: rangeParams?.sheetName ? rangeParams.sheetName : this.sheetName,
        invalidSheetName:
          rangeParams && "invalidSheetName" in rangeParams // 'attr in obj' instead of just 'obj.attr' because we accept undefined values
            ? rangeParams.invalidSheetName
            : this.invalidSheetName,
        invalidXc:
          rangeParams && "invalidXc" in rangeParams ? rangeParams.invalidXc : this.invalidXc,
        parts: rangeParams?.parts
          ? rangeParams.parts
          : this.parts.map((part) => {
              return { rowFixed: part.rowFixed, colFixed: part.colFixed };
            }),
        prefixSheet: rangeParams?.prefixSheet ? rangeParams.prefixSheet : this.prefixSheet,
      },
      this.getSheetSize
    );
  }
}

export function getRangeFromXc(xc: string, defaultSheetId: string, getters: Getters): Range {
  const statelessRangeInterface = StatelessRange.getInterface(xc);
  const sheetName = statelessRangeInterface.sheetName;
  const invalidSheetName =
    sheetName && !getters.getSheetIdByName(sheetName) ? sheetName : undefined;
  let sheetId = getters.getSheetIdByName(sheetName) || defaultSheetId;

  const getSheetSize = getters.getSheetSize;

  return new Range({ ...statelessRangeInterface, sheetId, invalidSheetName }, getSheetSize);
}

export function getStatelessRangeFromXc(xc: string): StatelessRange {
  return new StatelessRange(StatelessRange.getInterface(xc));
}
