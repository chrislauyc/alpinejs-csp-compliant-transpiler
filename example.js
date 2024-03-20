const fs = require("fs");
const path = require("path");
const { transpile } = require("./transpiler");
const htmlString = fs.readFileSync(path.resolve(__dirname, "index.html"));

const transpiled = transpile(htmlString);
fs.writeFileSync(path.resolve(__dirname, "out.html"), transpiled);
