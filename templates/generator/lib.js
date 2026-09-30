// Rendering helpers for the Tool 2 first-pass template pack.
const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType,
  AlignmentType, BorderStyle, PageBreak, Header, Footer, PageNumber, LevelFormat,
} = require('docx');

const SERIF = 'Georgia';
const SANS = 'Arial';
const BODY = 21; // 10.5pt
const W = 9026; // A4 text width at 1" margins (11906 - 2*1440)

const C = {
  ink: '1A1F24', grey: '505A63', slotFill: 'FFF2CC', condInk: '5B3F8C', condFill: 'EFEAF6',
  noteInk: '7A4E0C', noteFill: 'FBF3E3', noteLine: 'C9922E',
  aiInk: '1F4E8C', aiFill: 'E3ECF7', aiLine: '2F5D9E',
  lockFill: 'EEF0EC', lockLine: '1A1F24', line: 'C5CAC3',
};

const slotsSeen = new Map(); // slot -> Set(templateId)
let currentId = '';

// Every {{field}} and [[...]] token in document order, with the conditions and loops it sits
// inside. Read by fields.js to check templates against templates/fields/catalogue.json.
const usage = []; // { template, kind: 'field' | 'condition' | 'list' | 'zone' | 'locked' | 'placeholder' | 'error', name, context }
const stack = []; // open blocks: { kind: 'if', expr, negated } | { kind: 'each', alias, list, where }

function context() {
  return stack.map((b) => b.kind === 'if' ? (b.negated ? 'NOT ' : '') + b.expr
    : 'EACH ' + b.alias + ' IN ' + b.list + (b.where ? ' WHERE ' + b.where : ''));
}
function record(kind, name) { usage.push({ template: currentId, kind, name, context: context() }); }

function track(slot) {
  if (!slotsSeen.has(slot)) slotsSeen.set(slot, new Set());
  slotsSeen.get(slot).add(currentId);
  record('field', slot);
}

function trackBlock(token) {
  const t = token.slice(2, -2).trim();
  let m;
  if ((m = t.match(/^IF\s+(.+)$/))) {
    record('condition', m[1].trim());
    stack.push({ kind: 'if', expr: m[1].trim(), negated: false });
  } else if (t === 'ELSE') {
    const top = stack[stack.length - 1];
    if (top && top.kind === 'if' && !top.negated) top.negated = true;
    else record('error', 'ELSE without IF');
  } else if (t === 'END IF') {
    if (stack.length && stack[stack.length - 1].kind === 'if') stack.pop();
    else record('error', 'END IF without IF');
  } else if ((m = t.match(/^FOR EACH\s+(\w+)\s+IN\s+([\w.]+)(?:\s+WHERE\s+(.+))?$/))) {
    record('list', m[2]);
    stack.push({ kind: 'each', alias: m[1], list: m[2] });
    if (m[3]) record('condition', m[3].trim()); // inside the loop, so the alias is bound
    stack[stack.length - 1].where = m[3] && m[3].trim();
  } else if (t === 'END FOR EACH') {
    if (stack.length && stack[stack.length - 1].kind === 'each') stack.pop();
    else record('error', 'END FOR EACH without FOR EACH');
  } else {
    record('placeholder', t);
  }
}

// Parse inline text: {{slot}} and [[COND ...]] tokens.
function runs(text, base = {}) {
  const out = [];
  const parts = String(text).split(/(\{\{[^}]+\}\}|\[\[[^\]]+\]\])/);
  for (const p of parts) {
    if (!p) continue;
    if (p.startsWith('{{')) {
      const name = p.slice(2, -2).trim();
      track(name.replace(/\[i\]/g, '[]'));
      out.push(new TextRun({ text: p, font: base.font || SERIF, size: base.size || BODY, bold: base.bold, color: C.ink,
        shading: { type: ShadingType.CLEAR, color: 'auto', fill: C.slotFill } }));
    } else if (p.startsWith('[[')) {
      trackBlock(p);
      out.push(new TextRun({ text: p, font: SANS, size: 17, bold: true, color: C.condInk,
        shading: { type: ShadingType.CLEAR, color: 'auto', fill: C.condFill } }));
    } else {
      out.push(new TextRun({ text: p, font: base.font || SERIF, size: base.size || BODY, bold: base.bold,
        italics: base.italics, color: base.color || C.ink }));
    }
  }
  return out;
}

const sp = (before, after) => ({ before, after });

function T(text) {
  return new Paragraph({ alignment: AlignmentType.CENTER, spacing: sp(0, 80), children: runs(text, { bold: true, size: 28 }) });
}
function ST(text) {
  return new Paragraph({ alignment: AlignmentType.CENTER, spacing: sp(0, 80), children: runs(text, { size: 20, color: C.grey }) });
}
function H(text) {
  return new Paragraph({ keepNext: true, spacing: sp(240, 100), children: runs(text, { bold: true, size: 23 }) });
}
function P(text, level = 0) {
  const m = level ? String(text).match(/^(\d+(?:\.\d+)*)\s+([\s\S]*)$/) : null;
  if (m) {
    return new Paragraph({ spacing: { before: 0, after: 120, line: 300 }, indent: { left: 709, hanging: 709 },
      tabStops: [{ type: 'left', position: 709 }],
      children: [new TextRun({ text: m[1], font: SERIF, size: BODY, color: C.ink }), new TextRun({ text: '\t', font: SERIF, size: BODY }), ...runs(m[2])] });
  }
  return new Paragraph({ spacing: { before: 0, after: 120, line: 300 }, indent: level ? { left: 709 } : undefined,
    children: runs(text) });
}
function box(label, text, ink, fill, line, labelColor) {
  const border = { style: BorderStyle.SINGLE, size: 8, color: line, space: 6 };
  const kids = [new TextRun({ text: label, font: SANS, size: 16, bold: true, color: labelColor || ink })];
  if (text) {
    kids.push(new TextRun({ break: 1 }));
    kids.push(...runs(text, { font: SANS, size: 19, color: ink }));
  }
  return new Paragraph({ spacing: sp(120, 160), indent: { left: 113, right: 113 },
    shading: { type: ShadingType.CLEAR, color: 'auto', fill },
    border: { top: border, left: border, bottom: border, right: border }, children: kids });
}
function N(text) { return box('COUNSEL NOTE (removed on assembly)', text, C.noteInk, C.noteFill, C.noteLine); }
function AI(id, text) { record('zone', id); return box('AI-DRAFTED ZONE · ' + id, text, C.aiInk, C.aiFill, C.aiLine); }
function LOCK(text) {
  record('locked', text);
  const border = { style: BorderStyle.SINGLE, size: 12, color: C.lockLine, space: 6 };
  return new Paragraph({ spacing: sp(120, 160), indent: { left: 113, right: 113 },
    shading: { type: ShadingType.CLEAR, color: 'auto', fill: C.lockFill },
    border: { top: border, left: border, bottom: border, right: border },
    children: [
      new TextRun({ text: 'LOCKED · CONTRACTING PARTY · generated from the registry, cannot be edited', font: SANS, size: 16, bold: true, color: C.grey }),
      new TextRun({ break: 1 }),
      ...runs(text, { bold: true }),
    ] });
}
function COND(text) {
  return new Paragraph({ spacing: sp(60, 60), children: runs(text) });
}
function BUL(items, ref = 'bul') {
  return items.map((t) => new Paragraph({ numbering: { reference: ref, level: 0 }, spacing: { after: 80, line: 290 }, children: runs(t) }));
}
function CHECK(items) {
  return items.map((t) => new Paragraph({ spacing: { after: 100, line: 290 }, indent: { left: 567, hanging: 397 },
    children: [new TextRun({ text: '☐  ', font: SERIF, size: BODY }), ...runs(t)] }));
}
function cell(text, w, opts = {}) {
  const b = { style: BorderStyle.SINGLE, size: 4, color: C.line };
  return new TableCell({
    width: { size: w, type: WidthType.DXA },
    borders: { top: b, bottom: b, left: b, right: b },
    shading: opts.fill ? { type: ShadingType.CLEAR, color: 'auto', fill: opts.fill } : undefined,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: (Array.isArray(text) ? text : [text]).map((t) => new Paragraph({ spacing: sp(0, 40), children: runs(t, { bold: opts.bold, font: opts.font, size: opts.size }) })),
  });
}
function TABLE(rows, widths = [2900, W - 2900], opts = {}) {
  return new Table({
    width: { size: W, type: WidthType.DXA }, columnWidths: widths,
    rows: rows.map((r, i) => new TableRow({ children: r.map((c, j) => cell(c, widths[j], {
      bold: (opts.header && i === 0) || (opts.labelCol && j === 0),
      fill: (opts.header && i === 0) ? 'ECEEEA' : (opts.labelCol && j === 0 ? 'F5F6F3' : undefined),
      font: opts.font, size: opts.size,
    })) })),
  });
}
function SPACER() { return new Paragraph({ spacing: sp(0, 120), children: [] }); }
function PB() { return new Paragraph({ children: [new PageBreak()] }); }

function SIG(label, lines) {
  const out = [
    new Paragraph({ keepNext: true, spacing: sp(240, 60), children: runs(label, { bold: true }) }),
    new Paragraph({ keepNext: true, spacing: sp(360, 60), children: [new TextRun({ text: '______________________________________', font: SERIF, size: BODY })] }),
  ];
  lines.forEach((l, i) => {
    out.push(new Paragraph({ keepNext: i < lines.length - 1, spacing: sp(0, 60), children: runs(l) }));
  });
  return out;
}

function cover(meta) {
  const out = [];
  out.push(new Paragraph({ spacing: sp(0, 60), children: [new TextRun({ text: 'SINGULARITY · DOCUMENT FACTORY · FIRST-PASS TEMPLATE', font: SANS, size: 16, bold: true, color: C.grey })] }));
  out.push(new Paragraph({ spacing: sp(0, 60), children: [new TextRun({ text: meta.id + ' — ' + meta.name, font: SANS, size: 32, bold: true, color: C.ink })] }));
  out.push(new Paragraph({ spacing: sp(0, 200), children: [new TextRun({ text: 'Draft for review by BVI counsel. Not legal advice and not for use until approved by a named lawyer.', font: SANS, size: 19, color: 'A63D2F', bold: true })] }));
  out.push(TABLE([
    ['Template ID', meta.id],
    ['Document class', meta.cls],
    ['Variant', meta.variant],
    ['Use when', meta.use],
    ['Scope', meta.scope],
    ['Signed by', meta.signed],
    ['AI-drafted zones', meta.ai || 'None. Every value is filled from records.'],
    ['Conditional sections', meta.cond || 'None.'],
  ], [2400, W - 2400], { labelCol: true, font: SANS, size: 18 }));
  out.push(new Paragraph({ spacing: sp(240, 100), children: [new TextRun({ text: 'How to read this template', font: SANS, size: 20, bold: true })] }));
  out.push(new Paragraph({ spacing: sp(0, 80), children: [
    new TextRun({ text: '{{field.name}}', font: SERIF, size: 19, shading: { type: ShadingType.CLEAR, color: 'auto', fill: C.slotFill } }),
    new TextRun({ text: '  filled by code from the umbrella, portfolio, asset or investor record. Never typed by hand.', font: SANS, size: 18, color: C.grey }),
  ] }));
  out.push(new Paragraph({ spacing: sp(0, 80), children: [
    new TextRun({ text: '[[IF condition]] … [[END IF]]', font: SANS, size: 17, bold: true, color: C.condInk, shading: { type: ShadingType.CLEAR, color: 'auto', fill: C.condFill } }),
    new TextRun({ text: '  included only when the condition is true. [[FOR EACH]] repeats for every item.', font: SANS, size: 18, color: C.grey }),
  ] }));
  out.push(new Paragraph({ spacing: sp(0, 80), children: [
    new TextRun({ text: 'Blue box', font: SANS, size: 18, bold: true, color: C.aiInk }),
    new TextRun({ text: '  a section the AI may draft from the sponsor’s facts. Everything else is fixed template text.', font: SANS, size: 18, color: C.grey }),
  ] }));
  out.push(new Paragraph({ spacing: sp(0, 80), children: [
    new TextRun({ text: 'Dark box', font: SANS, size: 18, bold: true, color: C.ink }),
    new TextRun({ text: '  the contracting-party wording, generated from the registry and locked.', font: SANS, size: 18, color: C.grey }),
  ] }));
  out.push(new Paragraph({ spacing: sp(0, 80), children: [
    new TextRun({ text: 'Amber box', font: SANS, size: 18, bold: true, color: C.noteInk }),
    new TextRun({ text: '  a note or question for counsel. Removed when the document is assembled.', font: SANS, size: 18, color: C.grey }),
  ] }));
  out.push(new Paragraph({ spacing: sp(240, 100), children: [new TextRun({ text: 'Questions for counsel', font: SANS, size: 20, bold: true })] }));
  for (const q of meta.questions) {
    out.push(new Paragraph({ numbering: { reference: 'num', level: 0 }, spacing: { after: 80 }, children: [new TextRun({ text: q, font: SANS, size: 18, color: C.ink })] }));
  }
  out.push(PB());
  return out;
}

// Builds a template's body, recording its fields and blocks in `usage`.
function scan(meta, body) {
  currentId = meta.id;
  stack.length = 0;
  if (typeof body === 'function') body = body();
  for (const b of stack) record('error', 'unclosed block: ' + (b.kind === 'if' ? 'IF ' + b.expr : 'FOR EACH ' + b.alias + ' IN ' + b.list));
  stack.length = 0;
  return body;
}

async function build(meta, body, outDir) {
  body = scan(meta, body);
  const children = [...(meta.noCover ? [] : cover(meta)), ...body.flat()];
  const doc = new Document({
    creator: 'Singularity Document Factory',
    title: meta.id + ' ' + meta.name,
    styles: { default: { document: { run: { font: SERIF, size: BODY } } } },
    numbering: { config: [
      { reference: 'bul', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 567, hanging: 283 } } } }] },
      { reference: 'num', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 425, hanging: 340 } } } }] },
    ] },
    sections: [{
      properties: { page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } },
      headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: meta.id + ' · first-pass template · draft for counsel review', font: SANS, size: 15, color: C.grey })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [
        new TextRun({ text: 'Page ', font: SANS, size: 15, color: C.grey }),
        new TextRun({ children: [PageNumber.CURRENT], font: SANS, size: 15, color: C.grey }),
        new TextRun({ text: ' of ', font: SANS, size: 15, color: C.grey }),
        new TextRun({ children: [PageNumber.TOTAL_PAGES], font: SANS, size: 15, color: C.grey })] })] }) },
      children,
    }],
  });
  const buf = await Packer.toBuffer(doc);
  const file = outDir + '/' + meta.file;
  fs.writeFileSync(file, buf);
  return file;
}

module.exports = { C, cover, T, ST, H, P, N, AI, LOCK, COND, BUL, CHECK, TABLE, SPACER, PB, SIG, build, scan, slotsSeen, usage, W, runs, SANS };
