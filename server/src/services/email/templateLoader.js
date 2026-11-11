const fs = require("fs");
const path = require("path");
const Handlebars = require("handlebars");
const config = require("../../config");

let compiled = null;

function loadTemplates() {
  if (compiled) return compiled;

  // register partials
  const partialsDir = path.join(__dirname, "templates/partials");
  const partialFiles = fs.readdirSync(partialsDir);
  partialFiles.forEach((file) => {
    if (!file.endsWith(".hbs")) return;
    const name = file.replace(".hbs", "");
    const content = fs.readFileSync(path.join(partialsDir, file), "utf8");
    Handlebars.registerPartial(name, content);
  });

  // compile templates
  const templatesDir = path.join(__dirname, "templates");
  const map = {};
  fs.readdirSync(templatesDir).forEach((file) => {
    if (!file.endsWith(".hbs")) return;
    if (file.startsWith("_")) return; // skip partials at root, if any
    const key = file.replace(".hbs", "");
    const content = fs.readFileSync(path.join(templatesDir, file), "utf8");
    map[key] = Handlebars.compile(content);
  });

  compiled = map;
  return compiled;
}

function render(templateName, vars) {
  let templates = loadTemplates();
  let t = templates[templateName];

  // A .hbs added after the worker started is unseen; re-scan once on a miss.
  if (!t) {
    compiled = null;
    templates = loadTemplates();
    t = templates[templateName];
  }

  if (!t) throw new Error(`Email template not found: ${templateName}`);
  const defaults = {
    app_name: config.emailBrand.appName,
    support_email: config.emailBrand.supportEmail,
  };
  return t({ ...defaults, ...vars });
}

// Spam filters penalise bare HTML fragments with no doctype, head or title.
const documentShell = Handlebars.compile(
  '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    "<title>{{title}}</title></head><body style=\"margin:0;padding:0;\">{{{body}}}</body></html>",
);

/** Renders a template as a complete HTML document titled with the subject. */
function renderDocument(templateName, vars, title) {
  return documentShell({ title, body: render(templateName, vars) });
}

module.exports = { render, renderDocument };
