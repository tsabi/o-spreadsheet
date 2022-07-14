import { Model } from "..";
import { TranslationFunction } from "../translation";
import { Currency } from "./currency";

export interface EditTextOptions {
  error?: string;
  placeholder?: string;
}

export type notificationType = "ERROR" | "INFORMATION";

export interface InformationNotification {
  type: "INFORMATION";
  text: string;
  tag: string;
}

export interface ErrorNotification {
  type: "ERROR";
  text: string;
}

export interface SpreadsheetEnv {
  notifyUser: (notification: InformationNotification | ErrorNotification) => any;
  askConfirmation: (content: string, confirm: () => any, cancel?: () => any) => any;
  editText: (
    title: string,
    callback: (text: string | null) => any,
    options?: EditTextOptions
  ) => any;
  loadCurrencies: () => Promise<Currency[]>;
}

export interface SpreadsheetChildEnv extends SpreadsheetEnv {
  model: Model;
  isDashboard: () => boolean;
  openSidePanel: (panel: string, panelProps?: any) => void;
  toggleSidePanel: (panel: string, panelProps?: any) => void;
  clipboard: Clipboard;
  _t: TranslationFunction;
}
