import { _lt } from "../../translation";
import { Color } from "../../types/misc";
import {
  XLSXColor,
  XLSXColorScheme,
  XLSXFileStructure,
  XLSXImportFile,
  XLSXRel,
  XLSXTheme,
  XMLFile,
} from "../../types/xlsx";
import { XLSXImportWarningManager } from "../helpers/xlsx_parser_error_manager";
import {
  areNamespaceIgnoredByQueryselector,
  escapeNamespaces,
  removeNamespaces,
} from "../helpers/xml_helpers";

interface MapOnElementArgs {
  query: string;
  parent?: Element;
  document?: XMLFile;
  children?: boolean;
  singleMatch?: boolean;
}

interface ExtractArg {
  required?: boolean;
  default?: any;
}

export class AttributeValue {
  value: any;
  constructor(value: any) {
    this.value = value;
  }

  asString(): string | undefined {
    return this.value === undefined ? undefined : String(this.value);
  }

  asBool(): boolean | undefined {
    return this.value === undefined ? undefined : !!Number(this.value);
  }

  asNum(): number | undefined {
    return this.value === undefined ? undefined : Number(this.value);
  }
}

export class XlsxBaseExtractor {
  protected rootFile: XLSXImportFile;
  protected xlsxFileStructure: XLSXFileStructure;
  protected warningManager: XLSXImportWarningManager;
  protected relationships: Record<string, XLSXRel>;

  // The xml file we are currently parsing.
  protected currentFile: string | undefined = undefined;

  // If the parser querySelector() implementation ignores tag namespaces or not
  protected areNamespaceIgnored: boolean;

  constructor(
    rootFile: XLSXImportFile,
    xlsxStructure: XLSXFileStructure,
    warningManager: XLSXImportWarningManager
  ) {
    this.rootFile = rootFile;
    this.xlsxFileStructure = xlsxStructure;
    this.warningManager = warningManager;
    this.areNamespaceIgnored = areNamespaceIgnoredByQueryselector();
    this.relationships = {};
    if (rootFile.rels) {
      this.extractRelationships(rootFile.rels).map((rel) => {
        this.relationships[rel.id] = rel;
      });
    }
  }

  /**
   * Extract all the relationships inside a .xml.rels file
   */
  protected extractRelationships(relFile: XMLFile): XLSXRel[] {
    return this.mapOnElements(
      { document: relFile, query: "Relationship" },
      (relationshipElement): XLSXRel => {
        return {
          id: this.extractAttr(relationshipElement, "Id", { required: true }).asString()!,
          target: this.extractAttr(relationshipElement, "Target", { required: true }).asString()!,
          type: this.extractAttr(relationshipElement, "Type", { required: true }).asString()!,
        };
      }
    );
  }

  /**
   * Get the list of all the XLSX files in the XLSX file structure
   */
  protected getListOfFiles(): XLSXImportFile[] {
    return Object.values(this.xlsxFileStructure).flat();
  }

  /**
   * Return an array containing the return value of the given function applied to all the XML elements
   * found using the MapOnElementArgs.
   *
   * The arguments contains :
   *  - query : a QuerySelector string to find the elements to apply the function to
   *  - either :
   *      - document : an XML file in which to find the queried elements
   *      - parent : an XML element in which to find the queried elements
   *  - children : if true, the function is applied on the direct children of the queried element
   *  - singleMatch : if true, the function is applied only on the first match of the query
   *
   * This method will also handle the errors thrown in the argument function.
   */
  protected mapOnElements<T>(args: MapOnElementArgs, fct: (e: Element) => T): T[] {
    if (!args.document && !args.parent) {
      throw new Error("mapOnElements needs either a parent or a document as argument");
    }

    const ret: T[] = [];
    const oldWorkingDocument = this.currentFile;
    if (args.document) {
      this.currentFile = args.document.fileName;
    }
    const parentElement = args.document ? args.document.xml : args.parent!;
    let elements: HTMLCollection | NodeListOf<Element> | Element[];
    if (args.children) {
      const childrens = this.querySelector(parentElement, args.query)?.children;
      elements = childrens ? childrens : [];
    } else if (args.singleMatch) {
      const el = this.querySelector(parentElement, args.query);
      elements = el ? [el] : [];
    } else {
      elements = this.querySelectorAll(parentElement, args.query);
    }

    if (elements) {
      for (let element of elements) {
        try {
          ret.push(fct(element));
        } catch (e) {
          this.catchErrorOnElement(e, element);
        }
      }
    }

    this.currentFile = oldWorkingDocument;
    return ret;
  }

  /**
   * Log an error caught when parsing an element in the warningManager.
   */
  protected catchErrorOnElement(error: Error, onElement?: Element) {
    const errorMsg = onElement
      ? _lt(
          "Error when parsing an element <%s> of file %s, skip this element.",
          onElement.tagName,
          this.currentFile!
        )
      : _lt("Error when parsing file %s.", this.currentFile!);

    this.warningManager.addParsingWarning([errorMsg, error.stack].join("\n"));
  }

  /**
   * Extract an attribute from an Element.
   *
   * If the attribute is required but was not found, will add a warning in the warningManager if it was given a default
   * value, and throw an error if no default value was given.
   *
   * Can only return undefined for non-required attributes without default value.
   */
  protected extractAttr(e: Element, attName: string, optionalArgs?: ExtractArg): AttributeValue {
    if (!e) debugger;
    const att = e.attributes[attName];
    const attValue = isNaN(Number(att?.value)) ? att?.value : Number(att?.value);

    if (!att) this.handleMissingValue(e, `attribute "${attName}"`, optionalArgs);

    return new AttributeValue(attValue !== undefined ? attValue : optionalArgs?.default);
  }

  /**
   * Extract the text content of an Element.
   *
   * If the text content is required but was not found, will add a warning in the warningManager if it was given a default
   * value, and throw an error if no default value was given.
   *
   * Can only return undefined for non-required text content without default value.
   */
  protected extractTextContent(element: Element, optionalArgs?: ExtractArg): string | undefined {
    const shouldPreserveSpaces = element?.attributes["xml:space"]?.value === "preserve";
    let textContent = element?.textContent;

    if (!element || textContent === null) {
      this.handleMissingValue(element, `text content`, optionalArgs);
    }

    if (textContent) {
      textContent = shouldPreserveSpaces ? textContent : textContent.trim();
    }
    return textContent || optionalArgs?.default;
  }

  /**
   * Extract an attribute of a child of the given element.
   *
   * The reference of a child can be a string (tag of the child) or an number (index in the list of children of the element)
   *
   * If the attribute is required but either the attribute or the referenced child element was not found, it will
   * will add a warning in the warningManager if it was given a default value, and throw an error if no default value was given.
   *
   * Can only return undefined for non-required attributes without default value.
   */
  protected extractChildAttr(
    e: Element,
    childRef: string | number,
    attName: string,
    optionalArgs?: ExtractArg
  ): AttributeValue {
    let child: Element | null;
    if (typeof childRef === "number") {
      child = e.children[childRef];
    } else {
      child = this.querySelector(e, childRef);
    }

    if (!child) {
      this.handleMissingValue(
        e,
        typeof childRef === "number" ? `child at index ${childRef}` : `child <${childRef}>`,
        optionalArgs
      );
    }

    return new AttributeValue(
      child ? this.extractAttr(child, attName, optionalArgs).asString() : optionalArgs?.default
    );
  }

  /**
   * Extract the text content of a child of the given element.
   *
   * If the text content is required but either the text content or the referenced child element was not found, it will
   * will add a warning in the warningManager if it was given a default value, and throw an error if no default value was given.
   *
   * Can only return undefined for non-required text content without default value.
   */
  protected extractChildTextContent(
    e: Element,
    childRef: string,
    optionalArgs?: ExtractArg
  ): string | undefined {
    let child = this.querySelector(e, childRef);

    if (!child) {
      this.handleMissingValue(e, `child <${childRef}>`, optionalArgs);
    }

    return child ? this.extractTextContent(child, optionalArgs) : optionalArgs?.default;
  }

  /**
   * Should be called if a extractAttr/extractTextContent doesn't find the element it needs to extract.
   *
   * If the extractable was required, this function will add a warning in the warningManager if there was a default value,
   * and throw an error if no default value was given.
   */
  private handleMissingValue(
    parentElement: Element,
    missingElementName: string,
    optionalArgs?: ExtractArg
  ) {
    if (optionalArgs?.required) {
      if (optionalArgs?.default) {
        this.warningManager.addParsingWarning(
          `Missing required ${missingElementName} in element <${parentElement.tagName}> of ${this.currentFile}, replacing it by the default value ${optionalArgs.default}`
        );
      } else {
        throw new Error(
          `Missing required ${missingElementName} in element <${parentElement.tagName}> of ${this.currentFile}, and no default value was set`
        );
      }
    }
  }

  /**
   * Extract a color, extracting it from the theme if needed.
   *
   * Will throw an error if the element references a theme, but no theme was provided or the theme it doesn't contain the color.
   */
  protected extractColor(
    colorElement: Element | null,
    theme: XLSXTheme | undefined,
    defaultColor?: Color
  ): XLSXColor | undefined {
    if (!colorElement) return defaultColor ? { rgb: defaultColor } : undefined;
    const themeIndex = this.extractAttr(colorElement, "theme").asString();
    let rgb: string | undefined;
    if (themeIndex !== undefined) {
      if (!theme || !theme.clrScheme) {
        throw new Error(_lt("Color referencing a theme but no theme was provided"));
      }
      rgb = this.getThemeColor(themeIndex, theme.clrScheme);
    } else {
      rgb = this.extractAttr(colorElement, "rgb").asString();
    }
    const color = {
      rgb,
      auto: this.extractAttr(colorElement, "auto").asBool(),
      indexed: this.extractAttr(colorElement, "indexed").asNum(),
      tint: this.extractAttr(colorElement, "tint").asNum(),
    };
    return color;
  }

  /**
   * Returns the xlsx file targetted by a relationship.
   */
  protected getTargetXmlFile(relationship: XLSXRel): XLSXImportFile {
    if (!relationship) throw new Error(_lt("Undefined target file"));
    let target = relationship.target;
    target = target.replace("../", "");
    target = target.replace("./", "");
    // Use "endsWith" because targets are relative paths, and we know the files by their absolute path.
    const f = this.getListOfFiles().find((f) => f.file.fileName.endsWith(target));
    if (!f || !f.file) throw new Error(_lt("Cannot find target file"));
    return f;
  }

  /**
   * Wrapper of querySelector, but we'll remove the namespaces from the query if areNamespacesIgnored is true.
   *
   * Why we need to do this :
   *  - For an XML "<t:test />"
   *  - on Jest(jsdom) : xml.querySelector("test") == null, xml.querySelector("t\\:test") == <t:test />
   *  - on Browser : xml.querySelector("test") == <t:test />, xml.querySelector("t\\:test") == null
   */
  protected querySelector(element: Element | Document, query: string) {
    query = this.areNamespaceIgnored ? removeNamespaces(query) : escapeNamespaces(query);
    return element.querySelector(query);
  }

  /**
   * Wrapper of querySelectorAll, but we'll remove the namespaces from the query if areNamespacesIgnored is true.
   *
   * Why we need to do this :
   *  - For an XML "<t:test />"
   *  - on Jest(jsdom) : xml.querySelectorAll("test") == [], xml.querySelectorAll("t\\:test") == [<t:test />]
   *  - on Browser : xml.querySelectorAll("test") == [<t:test />], xml.querySelectorAll("t\\:test") == []
   */
  protected querySelectorAll(element: Element | Document, query: string) {
    query = this.areNamespaceIgnored ? removeNamespaces(query) : escapeNamespaces(query);
    return element.querySelectorAll(query);
  }

  /**
   * Get a color from its id in the Theme's colorScheme.
   *
   * Note that Excel don't use the colors from the theme but from its own internal theme, so the displayed
   * colors will be different in the import than in excel.
   * .
   */
  private getThemeColor(colorId: string, clrScheme: XLSXColorScheme[]): string {
    switch (colorId) {
      case "0": // 0 : sysColor window text
        return "FFFFFF";
      case "1": // 1 : sysColor window background
        return "000000";
      // Don't ask me why these 2 are inverted, I cannot find any documentation for it but everyone does it
      case "2":
        return clrScheme["3"].value;
      case "3":
        return clrScheme["2"].value;
      default:
        return clrScheme[colorId].value;
    }
  }
}
