import { version } from "./package.json";
import git from "git-rev-sync";
import swc from 'rollup-plugin-swc'
import { nodeResolve } from "@rollup/plugin-node-resolve";

export default {
  input: "dist/js/src/index.js",
  external: ["@odoo/owl"],
  plugins: [
    nodeResolve(),
    // swc({
    //   rollup: {
    //     exclude: 'path/to/exclude/',
    //   },
    //   jsc: {
    //     parser: {
    //       syntax: 'typescript',
    //     },
    //     target: 'es2018',
    //   },
    // }),
  ],
  output: {
    file: "dist/o_spreadsheet.js",
    format: "iife",
    name: "o_spreadsheet",
    extend: true,
    globals: { "@odoo/owl": "owl" /*, "chart.js": "chart_js" */ },
    outro: `exports.__info__.version = '${version}';\nexports.__info__.date = '${new Date().toISOString()}';\nexports.__info__.hash = '${git.short()}';`,
  },
};
