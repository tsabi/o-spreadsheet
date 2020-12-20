import { parse } from "../formulas/parser";

export function getFormulaNameAndArgs(formula: string): { name: string; args: string[] } {
  const ast = parse(formula);
  if (ast.type !== "ASYNC_FUNCALL" && ast.type !== "FUNCALL") {
    throw Error(`${formula} is not an function`);
  }
  const name = ast.value;
  const args = ast.args.map((arg) => {
    switch (typeof arg.value) {
      case "string":
        return arg.value.slice(1, -1);
      case "number":
        return arg.value.toString();
    }
    return "";
  });
  return { name, args };
}
