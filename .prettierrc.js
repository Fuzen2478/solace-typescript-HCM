/** @typedef  {import("prettier").Config} PrettierConfig*/
/** @typedef  {{ tailwindConfig: string }} TailwindConfig*/

/** @type { PrettierConfig | TailwindConfig } */
const config = {
  printWidth: 80,
  trailingComma: "all",
  endOfLine: "auto",
  singleQuote: true,
  plugins: [require.resolve("@ianvs/prettier-plugin-sort-imports")],
};

module.exports = config;
