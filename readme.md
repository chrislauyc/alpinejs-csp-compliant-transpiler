## Introduction

Alpine.js stands out as a lightweight front-end framework, seamlessly blending JavaScript component logic within HTML documents. However, certain syntax elements within the framework undergo evaluation in a manner that does not align with the principles of a [strict Content Security Policy](https://csp.withgoogle.com/docs/strict-csp.html).

While Alpine.js does offer a [strict CSP-compliant](https://alpinejs.dev/advanced/csp) build, it necessitates adopting a more verbose and restrictive syntax. Hence, this package is designed to transpile non-compliant code into compliant equivalents.

## Getting Started

The following script read from an index.html file in the current directory, transpile Alpine.js components, and outputs to an out.html file.

```js
const fs = require("fs");
const path = require("path");
const { transpile } = require("alpinejs-csp-compliant-transpiler");
const htmlString = fs.readFileSync(path.resolve(__dirname, "index.html"));

const transpiled = transpile(htmlString);
fs.writeFileSync(path.resolve(__dirname, "out.html"), transpiled);

```