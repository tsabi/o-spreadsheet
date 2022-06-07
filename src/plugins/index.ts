import { Registry } from "../registry";
import { BordersPlugin } from "./core/borders";
import { CellPlugin } from "./core/cell";
import { ChartPlugin } from "./core/chart";
import { ConditionalFormatPlugin } from "./core/conditional_format";
import { FigurePlugin } from "./core/figures";
import { FiltersPlugin } from "./core/filters";
import { HeaderSizePlugin } from "./core/header_size";
import { HeaderVisibilityPlugin } from "./core/header_visibility";
import { MergePlugin } from "./core/merge";
import { SheetPlugin } from "./core/sheet";
import { CorePluginConstructor } from "./core_plugin";
import { AutofillPlugin } from "./ui/autofill";
import { AutomaticSumPlugin } from "./ui/automatic_sum";
import { CellPopoverPlugin } from "./ui/cell_popovers";
import { ClipboardPlugin } from "./ui/clipboard";
import { EditionPlugin } from "./ui/edition";
import { EvaluationPlugin } from "./ui/evaluation";
import { EvaluationChartPlugin } from "./ui/evaluation_chart";
import { EvaluationConditionalFormatPlugin } from "./ui/evaluation_conditional_format";
import { FilterEvaluationPlugin } from "./ui/filter_evaluation";
import { FindAndReplacePlugin } from "./ui/find_and_replace";
import { FormatPlugin } from "./ui/format";
import { HeaderVisibilityUIPlugin } from "./ui/header_visibility_ui";
import { HighlightPlugin } from "./ui/highlight";
import { RendererPlugin } from "./ui/renderer";
import { GridSelectionPlugin } from "./ui/selection";
import { SelectionInputsManagerPlugin } from "./ui/selection_inputs_manager";
import { SelectionMultiUserPlugin } from "./ui/selection_multiuser";
import { SortPlugin } from "./ui/sort";
import { UIOptionsPlugin } from "./ui/ui_options";
import { SheetUIPlugin } from "./ui/ui_sheet";
import { ViewportPlugin } from "./ui/viewport";
import { UIPluginConstructor } from "./ui_plugin";

export const corePluginRegistry = new Registry<CorePluginConstructor>()
  .add("sheet", SheetPlugin)
  .add("header visibility", HeaderVisibilityPlugin)
  .add("filters", FiltersPlugin)
  .add("cell", CellPlugin)
  .add("merge", MergePlugin)
  .add("headerSize", HeaderSizePlugin)
  .add("borders", BordersPlugin)
  .add("conditional formatting", ConditionalFormatPlugin)
  .add("figures", FigurePlugin)
  .add("chart", ChartPlugin);

export const uiPluginRegistry = new Registry<UIPluginConstructor>()
  .add("selection", GridSelectionPlugin)
  .add("ui_sheet", SheetUIPlugin)
  .add("header_visibility_ui", HeaderVisibilityUIPlugin)
  .add("ui_options", UIOptionsPlugin)
  .add("evaluation", EvaluationPlugin)
  .add("evaluation_cf", EvaluationConditionalFormatPlugin)
  .add("evaluation_chart", EvaluationChartPlugin)
  .add("evaluation_filter", FilterEvaluationPlugin)
  .add("clipboard", ClipboardPlugin)
  .add("edition", EditionPlugin)
  .add("selectionInputManager", SelectionInputsManagerPlugin)
  .add("highlight", HighlightPlugin)
  .add("viewport", ViewportPlugin)
  .add("grid renderer", RendererPlugin)
  .add("autofill", AutofillPlugin)
  .add("find_and_replace", FindAndReplacePlugin)
  .add("sort", SortPlugin)
  .add("automatic_sum", AutomaticSumPlugin)
  .add("format", FormatPlugin)
  .add("cell_popovers", CellPopoverPlugin)
  .add("selection_multiuser", SelectionMultiUserPlugin);
