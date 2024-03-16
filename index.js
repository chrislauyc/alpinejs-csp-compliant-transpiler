const { JSDOM } = require("jsdom");
const template = require("@babel/template").default;
const generate = require("@babel/generator").default;
const t = require("@babel/types");
const fs = require("fs");
const path = require("path");
const { parseExpression } = require("@babel/parser");
const babelTraverse = require("@babel/traverse").default;
const htmlString = fs.readFileSync(path.resolve(__dirname, "index.html"));
let uid = 0;

const alpineComponent = template(`
Alpine.data(%%componentName%%, () => {
    return %%componentData%%;
  });`);
const alpineInit = template(`
document.addEventListener("alpine:init", () => {
    %%components%%
});
`);
const transpiled = transpile(htmlString);
fs.writeFileSync(path.resolve(__dirname, "out.html"), transpiled);
function transpile(htmlString) {
  const dom = new JSDOM(htmlString);
  const document = dom.window.document;
  const componentDeclarations = [];
  const rootComponent = {
    isRoot: true,
    children: [],
  };
  traverse(document.body, rootComponent);
  constructScript(rootComponent);
  /**
   *
   * @param {HTMLElement} node
   */
  function traverse(node, component) {
    const xData = node.getAttribute("x-data");
    if (xData) {
      const id = `c${uid}`;
      const childComponent = {
        id,
        data: parseExpression(xData),
        events: {},
        children: [],
      };
      component.children.push(childComponent);
      component = childComponent;
      node.setAttribute("x-data", id);
      uid++;
    }
    const xOnArr = Array.from(node.attributes).filter((attr) =>
      attr.name.startsWith("x-on:")
    );
    for (let xOn of xOnArr) {
      const eventId = `e${uid}`;
      component.events[eventId] = parseExpression(xOn.value);
      node.setAttribute(xOn.name, eventId);
      uid++;
    }
    for (let child of node.children) {
      traverse(child, component);
    }
  }
  function constructScript(component) {
    if (!component.isRoot) {
      const componentData = component.data;
      for (let eventId in component.events) {
        const exp = component.events[eventId];

        const property = t.objectProperty(
          t.identifier(eventId),
          t.isFunctionDeclaration(exp)
            ? exp
            : t.arrowFunctionExpression([], exp)
        );
        componentData.properties.push(property);
      }
      const ast = alpineComponent({
        componentData,
        componentName: t.stringLiteral(component.id),
      });
      componentDeclarations.push(ast);
    }
    for (let child of component.children) {
      constructScript(child);
    }
  }
  function transformThis(ast) {
    babelTraverse(ast, {
      Identifier(path) {
        path.scope.hasBinding(path.node.name);
      },
    });
  }
  const code = generate(
    alpineInit({
      components: componentDeclarations,
    })
  ).code;
  const scriptElement = document.createElement("script");
  scriptElement.innerHTML = code;
  document.body.appendChild(scriptElement);
  return document.documentElement.outerHTML;
}
