const { JSDOM } = require("jsdom");
const template = require("@babel/template").default;
const generate = require("@babel/generator").default;
const t = require("@babel/types");
const fs = require("fs");
const path = require("path");
const { parseExpression, parse } = require("@babel/parser");
const babelTraverse = require("@babel/traverse").default;
const htmlString = fs.readFileSync(path.resolve(__dirname, "index.html"));
// Used for unique variable naming
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
  const componentDeclarations = []; // A list of expressions that eventually gets transformed into the script tag content.
  const rootComponent = {
    isRoot: true,
    children: [],
  };
  traverse(document.body, rootComponent);
  constructScript(rootComponent);
  /**
   * Recursively nest components from the DOM tree. Each component contains data, id, events, and children
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
    // Add to component all the events. Replace the original x-on: with the eventId
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
  /**
   * @typedef {{
   * id: string,
   * data: any,
   * events: {[name: string]: any},
   * children: []
   * }} Component
   * */
  /**
   * Create the script that goes into the script tag
   * @param {Component} component
   */
  function constructScript(component) {
    if (!component.isRoot) {
      //Append all the events as methods to the componentData
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
      // Insert data into the babel template
      const ast = alpineComponent({
        componentData: transformThis(componentData),
        componentName: t.stringLiteral(component.id),
      });
      componentDeclarations.push(ast);
    }
    for (let child of component.children) {
      constructScript(child);
    }
  }
  function transformThis(componentData) {
    const arrow = template(`
() => %%componentData%%;
`);
    const ast = parse(generate(arrow({ componentData })).code);
    babelTraverse(ast, {
      Identifier(path) {
        if (
          !path.scope.hasBinding(path.node.name) &&
          !t.isObjectMember(path.parent) &&
          !t.isObjectProperty(path.parent)
        ) {
          if (t.isMemberExpression(path.parent)) {
            // Only add this to the first object of a MemberExpression
            if (path.parent.object !== path.node) {
              return;
            }
          }
          path.replaceWith(t.memberExpression(t.thisExpression(), path.node));
          path.skip();
        }
      },
    });
    return ast.program.body[0].expression.body;
  }
  const code = generate(
    alpineInit({
      components: componentDeclarations,
    })
  ).code;
  //   transformThis(parse(code));
  const scriptElement = document.createElement("script");
  scriptElement.innerHTML = code;
  document.body.appendChild(scriptElement);
  return document.documentElement.outerHTML;
}
