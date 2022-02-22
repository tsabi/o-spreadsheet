# XLSX Import

## General

The import of an XLSX have 2 steps :

1.  Parse the XMLs into intermediate XLSX objects. These objects are close to what's inside the XMLs, but can be used by o_spreadsheet.
2.  Convert these objects into a `WorkbookData` object that can be imported in o_spreadsheet.

## What we don't support at parsing of the XMLs :

These are the elements of the XMLs that we don't parse at all because we don't implement them inside o_spreadsheet and they have a different structure than other XLSX objects, so parsing them would require additional implementation work.

- style :

  - fills : gradients fills are not parsed
  - fonts :
    - font family : this is useless for us. It's an index to the table at OpenXml §18.18.94
  - cellStyleXfs :
    - It's supposed to be additional style to apply to the cells, but this doesn't really seems to be used by excel.
  - boolean applyAlignment/applyFont/applyFill... :
    - These booleans are supposed to signal whether or not the fills/fonts/... should be applied in this style, but these seems to be ignored by Excel.

- strings :

  - richText (text with non-uniform formatting)
    - we only extract the text, and not the formatting

- conditionalFormat :

  - cf type : dataBar

- figures :

  - figures that have an anchor different than twoCellAnchor (but I couldn't find when a different anchor type was used in Excel)
  - figures that don't contain a chart (eg. Images)

- charts :

  - everything not pie/doughnut/bar/line chart

- pivot :
  - we don't support excel-like pivot. Import them as Table.

## What we don't support at conversion :

These are the features that we don't fully support in o_spreadsheet. At conversion, we will either drop them completely, or adapt them to be somewhat useable in our application.

!NW = no warning generated for these conversions

- Style :
  - col/row style. We apply the style on each cell of the row/col. (!NW)
- Borders :
  - most border styles. We only support thin borders, and will convert every other border style to thin border.
  - diagonal borders
- Align :
  - some horizontal alignments. We only support left/right/center.
  - vertical alignement
  - other align options (wrapText, indent, shrinkToFit, ...) (!NW)
- Fills :
  - we only support solid fill pattern. Convert all other patterns into solide fills.
- Font :
  - We only support Arial
- Conditional Formats:
  - Types not supported :
    - AboveAverage
    - (Not)Contains Error
    - Data Bar (not supported at parsing)
    - Duplicated/uniques values
    - TimePeriod
    - Top10
  - Styles of CF not supported :
    - Border
    - Num format
  - IconSets :
    - We don't support most of the icons, replace them with some we support (!NW)
    - We don't support empty icons in IconSet (It makes the cf side panel crash!)
    - We don't support IconSet with more than 3 icons, replace them with Iconset with 3 icons (!NW)
- Charts :
  - convert pie charts with multiple datasets into doughnut chart (!NW)
- Tables (!NW) :
  - we don't support tables the same way as Excel, the most we can do is import cells with formatting to represent a table
  - table style in XLSX is a string that represent a stlye... and there's 80+ different styles supported. That's ... a lot. We'll just slap a style not too ugly to the table and call it a day.
- External References (!NW):
  - We cannot support references to external files (obviously), but we can replace the reference by its last known value (this is stored
    in the xlsx)

### What will look strange :

Excel don't really use the theme.xml for theme colors, but define its own. So the colors will be different at import than in excel. Import in GSheet et Calc both correctly use the theme.xml
