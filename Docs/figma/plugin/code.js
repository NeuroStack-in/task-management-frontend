/**
 * WorkPulse — Sample Figma File Generator
 *
 * Builds a three-frame sample file on the current page:
 *   01 · Foundations  — colour swatches, type scale, radii, elevation
 *   02 · Components   — buttons / inputs / badges / stat cards / table row (real component sets)
 *   03 · Dashboard    — a 1440×1024 app screen assembled from the components above
 *
 * It also publishes local **paint styles** and **text styles**, so the output is an editable
 * design system rather than a flat picture.
 *
 * Tokens mirror the shipped `[data-palette="meridian"]` light theme in src/app/globals.css.
 * Regenerate by re-running — it deletes any frames it previously created (matched by name).
 */

/* ------------------------------------------------------------------ */
/*  Tokens — Meridian (Slate & Teal), light                            */
/* ------------------------------------------------------------------ */

const T = {
  background: '#f7f8fa',
  foreground: '#0f1729',
  card: '#ffffff',
  popover: '#ffffff',
  primary: '#0e7490',
  primaryForeground: '#ffffff',
  primaryHover: '#0b5e74',
  primarySoft: '#e2f0f4',
  secondary: '#eef1f5',
  secondaryForeground: '#28303d',
  muted: '#f1f3f6',
  mutedForeground: '#5b6573',
  accent: '#e2f0f4',
  accentForeground: '#0b5e74',
  destructive: '#c0392b',
  success: '#157f5b',
  warning: '#b7791f',
  info: '#2563eb',
  ai: '#6d4ce0',
  aiTint: '#efeafe',
  border: '#e3e7ed',
  borderMuted: '#eef1f5',
  input: '#d7dce4',
  ring: '#0e7490',
  chart1: '#0e7490',
  chart2: '#2563eb',
  chart3: '#0f766e',
  chart4: '#b7791f',
  chart5: '#7c3aed',
  sidebar: '#ffffff',
  sidebarBorder: '#e7eaef',
};

/** `--radius: 0.625rem` */
const RADIUS = 10;

const FONTS = [
  { family: 'Inter', style: 'Regular' },
  { family: 'Inter', style: 'Medium' },
  { family: 'Inter', style: 'Semi Bold' },
  { family: 'Inter', style: 'Bold' },
];

/* ------------------------------------------------------------------ */
/*  Primitives                                                         */
/* ------------------------------------------------------------------ */

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16) / 255,
    g: parseInt(h.slice(2, 4), 16) / 255,
    b: parseInt(h.slice(4, 6), 16) / 255,
  };
}

const solid = (hex, opacity = 1) => ({ type: 'SOLID', color: hexToRgb(hex), opacity });

/** A soft card shadow — the one elevation the product uses. */
const CARD_SHADOW = {
  type: 'DROP_SHADOW',
  color: { r: 0.06, g: 0.09, b: 0.16, a: 0.06 },
  offset: { x: 0, y: 1 },
  radius: 3,
  spread: 0,
  visible: true,
  blendMode: 'NORMAL',
};

/**
 * Auto-layout frame. `w` pins the width; omit it to hug contents.
 *
 * Figma names its axes relative to the flow direction, not the screen: for a HORIZONTAL frame
 * the *primary* axis is width, for a VERTICAL frame it is height. So pinning a width means
 * touching a different property depending on `direction` — get this backwards and the frame
 * silently hugs instead.
 */
function frame(name, direction, opts) {
  const o = opts || {};
  const horizontal = direction === 'HORIZONTAL';
  const f = figma.createFrame();
  f.name = name;
  f.layoutMode = direction;
  f.primaryAxisSizingMode = o.w && horizontal ? 'FIXED' : 'AUTO';
  f.counterAxisSizingMode = o.w && !horizontal ? 'FIXED' : 'AUTO';
  f.itemSpacing = o.gap || 0;
  f.paddingLeft = o.px !== undefined ? o.px : o.p || 0;
  f.paddingRight = o.px !== undefined ? o.px : o.p || 0;
  f.paddingTop = o.py !== undefined ? o.py : o.p || 0;
  f.paddingBottom = o.py !== undefined ? o.py : o.p || 0;
  f.cornerRadius = o.radius || 0;
  f.fills = o.fill ? [solid(o.fill)] : [];
  f.counterAxisAlignItems = o.align || 'MIN';
  f.primaryAxisAlignItems = o.justify || 'MIN';
  f.clipsContent = false;
  if (o.stroke) {
    f.strokes = [solid(o.stroke)];
    f.strokeWeight = 1;
    f.strokeAlign = 'INSIDE';
  }
  if (o.shadow) f.effects = [CARD_SHADOW];
  if (o.w) f.resize(o.w, f.height);
  return f;
}

/** Fonts are preloaded in `main()`, so this stays synchronous. */
function text(chars, opts) {
  const o = opts || {};
  const t = figma.createText();
  t.fontName = { family: 'Inter', style: o.weight || 'Regular' };
  t.characters = chars;
  t.fontSize = o.size || 14;
  t.fills = [solid(o.color || T.foreground)];
  t.lineHeight = { unit: 'PIXELS', value: o.lh || Math.round((o.size || 14) * 1.45) };
  if (o.ls) t.letterSpacing = { unit: 'PIXELS', value: o.ls };
  t.textAutoResize = 'WIDTH_AND_HEIGHT';
  t.name = chars.length > 40 ? chars.slice(0, 40) + '…' : chars;
  return t;
}

function rect(name, w, h, fill, radius) {
  const r = figma.createRectangle();
  r.name = name;
  r.resize(w, h);
  r.fills = [solid(fill)];
  r.cornerRadius = radius || 0;
  return r;
}

/** A 1px rule that stretches to its parent's width. */
function divider(color) {
  const line = figma.createRectangle();
  line.name = 'Divider';
  line.resize(100, 1);
  line.fills = [solid(color || T.border)];
  line.layoutAlign = 'STRETCH';
  return line;
}

/**
 * Fill the parent's width. Only valid inside a VERTICAL parent — that's the parent's counter
 * axis, which is what layoutAlign controls. The child's own width property differs by its own
 * direction, so switch on that.
 */
function stretch(node) {
  node.layoutAlign = 'STRETCH';
  if (node.layoutMode === 'HORIZONTAL') node.primaryAxisSizingMode = 'FIXED';
  else if (node.layoutMode === 'VERTICAL') node.counterAxisSizingMode = 'FIXED';
  return node;
}

function grow(node) {
  node.layoutGrow = 1;
  return node;
}

/** Transparent flexible gap inside a horizontal auto-layout row. */
function spacer() {
  const s = figma.createFrame();
  s.name = 'Spacer';
  s.resize(1, 1);
  s.fills = [];
  s.layoutGrow = 1;
  return s;
}

/* ------------------------------------------------------------------ */
/*  Local styles                                                       */
/* ------------------------------------------------------------------ */

const PAINTS = [
  ['Surface/Background', T.background],
  ['Surface/Card', T.card],
  ['Surface/Muted', T.muted],
  ['Surface/Secondary', T.secondary],
  ['Surface/Accent', T.accent],
  ['Surface/Sidebar', T.sidebar],
  ['Text/Foreground', T.foreground],
  ['Text/Muted', T.mutedForeground],
  ['Text/On Primary', T.primaryForeground],
  ['Text/Accent', T.accentForeground],
  ['Brand/Primary', T.primary],
  ['Brand/Primary Hover', T.primaryHover],
  ['Brand/Primary Soft', T.primarySoft],
  ['Brand/Ring', T.ring],
  ['Status/Success', T.success],
  ['Status/Warning', T.warning],
  ['Status/Destructive', T.destructive],
  ['Status/Info', T.info],
  ['Status/AI', T.ai],
  ['Status/AI Tint', T.aiTint],
  ['Border/Default', T.border],
  ['Border/Muted', T.borderMuted],
  ['Border/Input', T.input],
  ['Chart/1', T.chart1],
  ['Chart/2', T.chart2],
  ['Chart/3', T.chart3],
  ['Chart/4', T.chart4],
  ['Chart/5', T.chart5],
];

const TYPE_SCALE = [
  ['Display/32', 32, 'Semi Bold', 40, -0.4],
  ['Heading/24', 24, 'Semi Bold', 32, -0.3],
  ['Heading/20', 20, 'Semi Bold', 28, -0.2],
  ['Heading/16', 16, 'Semi Bold', 24, -0.1],
  ['Body/14', 14, 'Regular', 20, 0],
  ['Body Medium/14', 14, 'Medium', 20, 0],
  ['Small/13', 13, 'Regular', 18, 0],
  ['Caption/12', 12, 'Medium', 16, 0.1],
  ['Overline/11', 11, 'Semi Bold', 14, 0.6],
];

async function createLocalStyles() {
  const existingPaints = await figma.getLocalPaintStylesAsync();
  const paintByName = {};
  existingPaints.forEach((s) => (paintByName[s.name] = s));
  PAINTS.forEach(([name, hex]) => {
    const style = paintByName[name] || figma.createPaintStyle();
    style.name = name;
    style.paints = [solid(hex)];
  });

  const existingText = await figma.getLocalTextStylesAsync();
  const textByName = {};
  existingText.forEach((s) => (textByName[s.name] = s));
  TYPE_SCALE.forEach(([name, size, weight, lh, ls]) => {
    const style = textByName[name] || figma.createTextStyle();
    style.name = name;
    style.fontName = { family: 'Inter', style: weight };
    style.fontSize = size;
    style.lineHeight = { unit: 'PIXELS', value: lh };
    style.letterSpacing = { unit: 'PIXELS', value: ls };
  });
}

/* ------------------------------------------------------------------ */
/*  Components                                                         */
/* ------------------------------------------------------------------ */

function buttonComponent(variantName, label, spec) {
  const c = figma.createComponent();
  c.name = variantName;
  c.layoutMode = 'HORIZONTAL';
  c.primaryAxisSizingMode = 'AUTO';
  c.counterAxisSizingMode = 'AUTO';
  c.counterAxisAlignItems = 'CENTER';
  c.paddingLeft = 16;
  c.paddingRight = 16;
  c.paddingTop = 9;
  c.paddingBottom = 9;
  c.itemSpacing = 8;
  c.cornerRadius = RADIUS;
  c.fills = spec.bg ? [solid(spec.bg)] : [];
  if (spec.stroke) {
    c.strokes = [solid(spec.stroke)];
    c.strokeWeight = 1;
    c.strokeAlign = 'INSIDE';
  }
  c.opacity = spec.opacity || 1;
  c.appendChild(text(label, { size: 14, weight: 'Medium', color: spec.fg, lh: 20 }));
  return c;
}

function buildButtonSet(parent) {
  const variants = [
    ['Variant=Primary, State=Default', { bg: T.primary, fg: T.primaryForeground }],
    ['Variant=Primary, State=Hover', { bg: T.primaryHover, fg: T.primaryForeground }],
    ['Variant=Primary, State=Disabled', { bg: T.primary, fg: T.primaryForeground, opacity: 0.45 }],
    ['Variant=Secondary, State=Default', { bg: T.secondary, fg: T.secondaryForeground }],
    ['Variant=Outline, State=Default', { bg: T.card, fg: T.foreground, stroke: T.input }],
    ['Variant=Ghost, State=Default', { bg: null, fg: T.mutedForeground }],
    ['Variant=Destructive, State=Default', { bg: T.destructive, fg: '#ffffff' }],
  ];
  const nodes = variants.map(([name, spec]) => buttonComponent(name, 'Assign task', spec));
  const set = figma.combineAsVariants(nodes, parent);
  set.name = 'Button';
  set.layoutMode = 'HORIZONTAL';
  set.primaryAxisSizingMode = 'AUTO';
  set.counterAxisSizingMode = 'AUTO';
  set.itemSpacing = 16;
  set.paddingLeft = 16;
  set.paddingRight = 16;
  set.paddingTop = 16;
  set.paddingBottom = 16;
  set.counterAxisAlignItems = 'CENTER';
  set.fills = [];
  set.strokes = [solid(T.border)];
  set.strokeWeight = 1;
  set.dashPattern = [4, 4];
  set.cornerRadius = RADIUS;
  return set;
}

function badgeComponent(variantName, label, dot, tint, fg) {
  const c = figma.createComponent();
  c.name = variantName;
  c.layoutMode = 'HORIZONTAL';
  c.primaryAxisSizingMode = 'AUTO';
  c.counterAxisSizingMode = 'AUTO';
  c.counterAxisAlignItems = 'CENTER';
  c.paddingLeft = 10;
  c.paddingRight = 10;
  c.paddingTop = 4;
  c.paddingBottom = 4;
  c.itemSpacing = 6;
  c.cornerRadius = 999;
  c.fills = [solid(tint)];

  const marker = figma.createEllipse();
  marker.name = 'Dot';
  marker.resize(6, 6);
  marker.fills = [solid(dot)];
  c.appendChild(marker);
  c.appendChild(text(label, { size: 12, weight: 'Medium', color: fg, lh: 16 }));
  return c;
}

function buildBadgeSet(parent) {
  const variants = [
    ['Status=Active', 'Active', T.success, '#e6f4ee', '#106349'],
    ['Status=On break', 'On break', T.warning, '#fbf1de', '#8a5c14'],
    ['Status=Idle', 'Idle', T.mutedForeground, T.muted, T.mutedForeground],
    ['Status=Offline', 'Offline', '#9aa3af', T.secondary, T.secondaryForeground],
    ['Status=Overtime', 'Overtime', T.destructive, '#f8e7e4', '#8f2b20'],
  ];
  const nodes = variants.map((v) => badgeComponent(v[0], v[1], v[2], v[3], v[4]));
  const set = figma.combineAsVariants(nodes, parent);
  set.name = 'Status badge';
  set.layoutMode = 'HORIZONTAL';
  set.primaryAxisSizingMode = 'AUTO';
  set.counterAxisSizingMode = 'AUTO';
  set.itemSpacing = 16;
  set.paddingLeft = 16;
  set.paddingRight = 16;
  set.paddingTop = 16;
  set.paddingBottom = 16;
  set.counterAxisAlignItems = 'CENTER';
  set.fills = [];
  set.strokes = [solid(T.border)];
  set.strokeWeight = 1;
  set.dashPattern = [4, 4];
  set.cornerRadius = RADIUS;
  return set;
}

/** Labelled input field. */
function inputField(label, value, placeholder) {
  const wrap = frame(`Input · ${label}`, 'VERTICAL', { gap: 6, w: 320 });
  wrap.appendChild(text(label, { size: 12, weight: 'Medium', color: T.secondaryForeground, lh: 16 }));
  const box = frame('Field', 'HORIZONTAL', {
    w: 320,
    px: 12,
    py: 10,
    radius: RADIUS,
    fill: T.card,
    stroke: placeholder ? T.input : T.ring,
    align: 'CENTER',
  });
  box.appendChild(
    text(value, { size: 14, color: placeholder ? T.mutedForeground : T.foreground, lh: 20 }),
  );
  wrap.appendChild(box);
  return wrap;
}

/**
 * The dashboard stat tile — mirrors `components/shared/StatCard` plus its delta pill.
 */
function statCard(label, value, delta, positive, accent) {
  const card = frame(`Stat · ${label}`, 'VERTICAL', {
    w: 300,
    p: 20,
    gap: 10,
    radius: RADIUS,
    fill: T.card,
    stroke: T.border,
    shadow: true,
  });
  card.appendChild(
    text(label.toUpperCase(), { size: 11, weight: 'Semi Bold', color: T.mutedForeground, lh: 14, ls: 0.6 }),
  );

  const row = stretch(frame('Value row', 'HORIZONTAL', { gap: 10, align: 'CENTER' }));
  row.appendChild(text(value, { size: 28, weight: 'Semi Bold', color: T.foreground, lh: 34, ls: -0.4 }));

  const pill = frame('Delta pill', 'HORIZONTAL', {
    px: 8,
    py: 3,
    radius: 999,
    fill: positive ? '#e6f4ee' : '#f8e7e4',
    align: 'CENTER',
  });
  pill.appendChild(
    text(delta, { size: 12, weight: 'Medium', color: positive ? '#106349' : '#8f2b20', lh: 16 }),
  );
  row.appendChild(pill);
  row.appendChild(spacer());
  card.appendChild(row);

  // Sparkline — the WorkPulse "pulse line" signature.
  const spark = frame('Sparkline', 'HORIZONTAL', { gap: 3, align: 'MAX', w: 260 });
  const heights = [10, 16, 12, 20, 15, 24, 19, 28, 22, 30, 26, 34];
  heights.forEach((h, i) => spark.appendChild(rect(`bar-${i + 1}`, 16, h, accent, 3)));
  card.appendChild(spark);
  return card;
}

/** One row of the task/timesheet table. */
function tableRow(name, project, status, dot, tint, fg, hours, last) {
  const row = frame(`Row · ${name}`, 'HORIZONTAL', {
    w: 1136,
    px: 20,
    py: 14,
    gap: 16,
    align: 'CENTER',
    fill: T.card,
  });

  const avatar = figma.createEllipse();
  avatar.name = 'Avatar';
  avatar.resize(32, 32);
  avatar.fills = [solid(T.primarySoft)];
  row.appendChild(avatar);

  const who = frame('Person', 'VERTICAL', { gap: 2, w: 260 });
  who.appendChild(text(name, { size: 14, weight: 'Medium', color: T.foreground, lh: 20 }));
  who.appendChild(text(project, { size: 12, color: T.mutedForeground, lh: 16 }));
  row.appendChild(who);

  const badge = frame('Status', 'HORIZONTAL', {
    px: 10,
    py: 4,
    gap: 6,
    radius: 999,
    fill: tint,
    align: 'CENTER',
  });
  const d = figma.createEllipse();
  d.name = 'Dot';
  d.resize(6, 6);
  d.fills = [solid(dot)];
  badge.appendChild(d);
  badge.appendChild(text(status, { size: 12, weight: 'Medium', color: fg, lh: 16 }));
  row.appendChild(badge);

  row.appendChild(spacer());
  row.appendChild(text(hours, { size: 14, weight: 'Medium', color: T.foreground, lh: 20 }));
  row.appendChild(text(last, { size: 13, color: T.mutedForeground, lh: 18 }));
  return row;
}

/* ------------------------------------------------------------------ */
/*  01 · Foundations                                                   */
/* ------------------------------------------------------------------ */

function swatch(name, hex) {
  const s = frame(`Swatch · ${name}`, 'VERTICAL', { gap: 8, w: 128 });
  const chip = rect('Chip', 128, 76, hex, RADIUS);
  s.appendChild(chip);
  const meta = frame('Meta', 'VERTICAL', { gap: 2, w: 128 });
  meta.appendChild(text(name, { size: 12, weight: 'Medium', color: T.foreground, lh: 16 }));
  meta.appendChild(text(hex.toUpperCase(), { size: 11, color: T.mutedForeground, lh: 14 }));
  s.appendChild(meta);
  return s;
}

function sectionCard(title, subtitle) {
  const card = frame(title, 'VERTICAL', {
    w: 1360,
    p: 28,
    gap: 20,
    radius: 14,
    fill: T.card,
    stroke: T.border,
  });
  const head = frame('Header', 'VERTICAL', { gap: 4 });
  head.appendChild(text(title, { size: 20, weight: 'Semi Bold', color: T.foreground, lh: 28, ls: -0.2 }));
  if (subtitle) head.appendChild(text(subtitle, { size: 13, color: T.mutedForeground, lh: 18 }));
  card.appendChild(head);
  return card;
}

function buildFoundations() {
  const page = frame('01 · Foundations', 'VERTICAL', {
    w: 1440,
    p: 40,
    gap: 24,
    fill: T.background,
  });
  page.clipsContent = true;

  const title = frame('Title', 'VERTICAL', { gap: 6 });
  title.appendChild(
    text('WorkPulse Design System', { size: 32, weight: 'Semi Bold', color: T.foreground, lh: 40, ls: -0.4 }),
  );
  title.appendChild(
    text('Meridian · Slate & Teal — light. Tokens mirror src/app/globals.css.', {
      size: 14,
      color: T.mutedForeground,
      lh: 20,
    }),
  );
  page.appendChild(title);

  // ---- Brand + neutrals
  const brand = sectionCard('Colour', 'Every value here is published as a local paint style.');
  const rowA = frame('Brand & neutrals', 'HORIZONTAL', { gap: 16 });
  [
    ['Primary', T.primary],
    ['Primary hover', T.primaryHover],
    ['Primary soft', T.primarySoft],
    ['Foreground', T.foreground],
    ['Muted fg', T.mutedForeground],
    ['Border', T.border],
    ['Background', T.background],
    ['Card', T.card],
  ].forEach(([n, h]) => rowA.appendChild(swatch(n, h)));
  brand.appendChild(rowA);

  const rowB = frame('Status & charts', 'HORIZONTAL', { gap: 16 });
  [
    ['Success', T.success],
    ['Warning', T.warning],
    ['Destructive', T.destructive],
    ['Info', T.info],
    ['AI', T.ai],
    ['Chart 2', T.chart2],
    ['Chart 3', T.chart3],
    ['Chart 5', T.chart5],
  ].forEach(([n, h]) => rowB.appendChild(swatch(n, h)));
  brand.appendChild(rowB);
  page.appendChild(brand);

  // ---- Type
  const type = sectionCard('Typography', 'Inter. Nine steps, published as text styles.');
  TYPE_SCALE.forEach(([name, size, weight, lh, ls]) => {
    const row = frame(`Type · ${name}`, 'HORIZONTAL', { gap: 24, align: 'CENTER', w: 1304 });
    const tag = text(name, { size: 12, weight: 'Medium', color: T.mutedForeground, lh: 16 });
    tag.textAutoResize = 'HEIGHT';
    tag.resize(140, tag.height);
    row.appendChild(tag);
    row.appendChild(text('Workforce activity, at a glance', { size, weight, color: T.foreground, lh, ls }));
    type.appendChild(row);
  });
  page.appendChild(type);

  // ---- Radius + elevation
  const shape = sectionCard('Radius & elevation', '--radius: 0.625rem (10px). One shadow, used sparingly.');
  const shapeRow = frame('Shapes', 'HORIZONTAL', { gap: 16, align: 'CENTER' });
  [
    ['radius 6', 6],
    ['radius 10 (default)', RADIUS],
    ['radius 14', 14],
    ['radius 999', 999],
  ].forEach(([label, r]) => {
    const cell = frame(label, 'VERTICAL', { gap: 8, w: 160 });
    const box = rect('Box', 160, 72, T.secondary, r);
    cell.appendChild(box);
    cell.appendChild(text(label, { size: 12, color: T.mutedForeground, lh: 16 }));
    shapeRow.appendChild(cell);
  });

  const elevated = frame('Elevation · card', 'VERTICAL', {
    w: 220,
    p: 16,
    gap: 4,
    radius: RADIUS,
    fill: T.card,
    stroke: T.border,
    shadow: true,
  });
  elevated.appendChild(text('Card', { size: 14, weight: 'Medium', color: T.foreground, lh: 20 }));
  elevated.appendChild(
    text('1px border + 3px/6% shadow', { size: 12, color: T.mutedForeground, lh: 16 }),
  );
  shapeRow.appendChild(elevated);
  shape.appendChild(shapeRow);
  page.appendChild(shape);

  return page;
}

/* ------------------------------------------------------------------ */
/*  02 · Components                                                    */
/* ------------------------------------------------------------------ */

function buildComponents() {
  const page = frame('02 · Components', 'VERTICAL', {
    w: 1440,
    p: 40,
    gap: 24,
    fill: T.background,
  });
  page.clipsContent = true;

  const title = frame('Title', 'VERTICAL', { gap: 6 });
  title.appendChild(text('Components', { size: 32, weight: 'Semi Bold', color: T.foreground, lh: 40, ls: -0.4 }));
  title.appendChild(
    text('Real component sets with variant properties — swap them in the Dashboard frame.', {
      size: 14,
      color: T.mutedForeground,
      lh: 20,
    }),
  );
  page.appendChild(title);

  const buttons = sectionCard('Button', 'Variant × State. Ghost has no fill; Disabled is 45% opacity.');
  buildButtonSet(buttons);
  page.appendChild(buttons);

  const badges = sectionCard('Status badge', 'The five presence states the fleet reports.');
  buildBadgeSet(badges);
  page.appendChild(badges);

  const inputs = sectionCard('Form fields', 'Rest uses --input; focus uses --ring.');
  const inputRow = frame('Fields', 'HORIZONTAL', { gap: 24 });
  inputRow.appendChild(inputField('Search people', 'Search by name or email', true));
  inputRow.appendChild(inputField('Project', 'Atlas migration', false));
  inputs.appendChild(inputRow);
  page.appendChild(inputs);

  const stats = sectionCard('Stat card', 'Label, value, delta pill, and the pulse-line sparkline.');
  const statRow = frame('Stats', 'HORIZONTAL', { gap: 24 });
  statRow.appendChild(statCard('Active now', '142', '+8.2%', true, T.chart1));
  statRow.appendChild(statCard('Avg. focus time', '5h 12m', '+3.4%', true, T.chart3));
  statRow.appendChild(statCard('Idle rate', '11.4%', '-1.9%', false, T.chart4));
  statRow.appendChild(statCard('Overtime hrs', '38', '+12.0%', false, T.chart5));
  stats.appendChild(statRow);
  page.appendChild(stats);

  const table = sectionCard('Table row', 'Avatar, identity, status, hours, last seen.');
  const rows = frame('Rows', 'VERTICAL', { gap: 0, w: 1136, radius: RADIUS, stroke: T.border });
  rows.clipsContent = true;
  rows.appendChild(tableRow('Priya Raghavan', 'Atlas migration', 'Active', T.success, '#e6f4ee', '#106349', '7h 41m', '2 min ago'));
  rows.appendChild(stretch(divider(T.borderMuted)));
  rows.appendChild(tableRow('Daniel Okoye', 'Billing revamp', 'On break', T.warning, '#fbf1de', '#8a5c14', '5h 03m', '14 min ago'));
  rows.appendChild(stretch(divider(T.borderMuted)));
  rows.appendChild(tableRow('Mei Tanaka', 'Fleet telemetry', 'Idle', T.mutedForeground, T.muted, T.mutedForeground, '6h 20m', '38 min ago'));
  table.appendChild(rows);
  page.appendChild(table);

  return page;
}

/* ------------------------------------------------------------------ */
/*  03 · Dashboard                                                     */
/* ------------------------------------------------------------------ */

function navItem(label, active) {
  const item = frame(`Nav · ${label}`, 'HORIZONTAL', {
    w: 216,
    px: 12,
    py: 9,
    gap: 10,
    radius: 8,
    fill: active ? T.accent : null,
    align: 'CENTER',
  });
  item.appendChild(rect('Icon', 16, 16, active ? T.primary : '#9aa3af', 4));
  item.appendChild(
    text(label, {
      size: 14,
      weight: active ? 'Medium' : 'Regular',
      color: active ? T.accentForeground : T.secondaryForeground,
      lh: 20,
    }),
  );
  return item;
}

function buildDashboard() {
  const screen = figma.createFrame();
  screen.name = '03 · Dashboard — 1440×1024';
  screen.resize(1440, 1024);
  screen.fills = [solid(T.background)];
  screen.layoutMode = 'HORIZONTAL';
  screen.primaryAxisSizingMode = 'FIXED';
  screen.counterAxisSizingMode = 'FIXED';
  screen.itemSpacing = 0;
  screen.clipsContent = true;

  // ---- Sidebar
  const sidebar = frame('Sidebar', 'VERTICAL', {
    w: 248,
    px: 16,
    py: 20,
    gap: 6,
    fill: T.sidebar,
  });
  // Parent is HORIZONTAL, so STRETCH pins the *height* — a vertical frame's primary axis.
  sidebar.layoutAlign = 'STRETCH';
  sidebar.primaryAxisSizingMode = 'FIXED';
  sidebar.strokes = [solid(T.sidebarBorder)];
  sidebar.strokeWeight = 1;
  sidebar.strokeAlign = 'INSIDE';
  sidebar.strokeRightWeight = 1;
  sidebar.strokeTopWeight = 0;
  sidebar.strokeBottomWeight = 0;
  sidebar.strokeLeftWeight = 0;

  const brandRow = frame('Brand', 'HORIZONTAL', { gap: 10, py: 4, align: 'CENTER', w: 216 });
  brandRow.appendChild(rect('Mark', 28, 28, T.primary, 8));
  brandRow.appendChild(text('WorkPulse', { size: 16, weight: 'Semi Bold', color: T.foreground, lh: 24 }));
  sidebar.appendChild(brandRow);

  const gap = figma.createFrame();
  gap.name = 'Gap';
  gap.resize(216, 12);
  gap.fills = [];
  sidebar.appendChild(gap);

  sidebar.appendChild(
    text('WORKFORCE', { size: 11, weight: 'Semi Bold', color: T.mutedForeground, lh: 14, ls: 0.6 }),
  );
  ['Dashboard', 'People', 'Attendance', 'Timesheets', 'Projects'].forEach((label) =>
    sidebar.appendChild(navItem(label, label === 'Dashboard')),
  );

  const gap2 = figma.createFrame();
  gap2.name = 'Gap';
  gap2.resize(216, 12);
  gap2.fills = [];
  sidebar.appendChild(gap2);
  sidebar.appendChild(
    text('INSIGHTS', { size: 11, weight: 'Semi Bold', color: T.mutedForeground, lh: 14, ls: 0.6 }),
  );
  ['Productivity', 'Device fleet', 'Reports'].forEach((label) => sidebar.appendChild(navItem(label, false)));
  screen.appendChild(sidebar);

  // ---- Main column
  const main = frame('Main', 'VERTICAL', { gap: 0 });
  main.layoutGrow = 1;
  main.layoutAlign = 'STRETCH';
  main.primaryAxisSizingMode = 'FIXED';

  // Top bar
  const topbar = frame('Top bar', 'HORIZONTAL', {
    px: 28,
    py: 0,
    gap: 16,
    align: 'CENTER',
    fill: T.card,
  });
  topbar.layoutAlign = 'STRETCH';
  topbar.primaryAxisSizingMode = 'FIXED';
  topbar.counterAxisSizingMode = 'FIXED';
  topbar.resize(1192, 64);
  topbar.strokes = [solid(T.border)];
  topbar.strokeWeight = 1;
  topbar.strokeAlign = 'INSIDE';
  topbar.strokeTopWeight = 0;
  topbar.strokeLeftWeight = 0;
  topbar.strokeRightWeight = 0;
  topbar.strokeBottomWeight = 1;

  const search = frame('Search', 'HORIZONTAL', {
    w: 360,
    px: 12,
    py: 8,
    gap: 8,
    radius: RADIUS,
    fill: T.muted,
    align: 'CENTER',
  });
  search.appendChild(rect('Icon', 14, 14, '#9aa3af', 3));
  search.appendChild(text('Search people, projects…  ⌘K', { size: 13, color: T.mutedForeground, lh: 18 }));
  topbar.appendChild(search);
  topbar.appendChild(spacer());
  topbar.appendChild(rect('Notifications', 32, 32, T.muted, 8));
  const you = frame('Account', 'HORIZONTAL', { gap: 8, align: 'CENTER' });
  const av = figma.createEllipse();
  av.name = 'Avatar';
  av.resize(32, 32);
  av.fills = [solid(T.primarySoft)];
  you.appendChild(av);
  you.appendChild(text('Kishore R.', { size: 13, weight: 'Medium', color: T.foreground, lh: 18 }));
  topbar.appendChild(you);
  main.appendChild(topbar);

  // Content
  const content = stretch(frame('Content', 'VERTICAL', { p: 28, gap: 20, fill: T.background }));

  const head = stretch(frame('Page header', 'HORIZONTAL', { align: 'CENTER', gap: 16 }));
  const headText = frame('Heading', 'VERTICAL', { gap: 4 });
  headText.appendChild(text('Dashboard', { size: 24, weight: 'Semi Bold', color: T.foreground, lh: 32, ls: -0.3 }));
  headText.appendChild(
    text('Thursday, 7 August · 168 people in scope', { size: 13, color: T.mutedForeground, lh: 18 }),
  );
  head.appendChild(headText);
  head.appendChild(spacer());

  const range = frame('Range picker', 'HORIZONTAL', {
    px: 14,
    py: 9,
    gap: 8,
    radius: RADIUS,
    fill: T.card,
    stroke: T.input,
    align: 'CENTER',
  });
  range.appendChild(text('Last 7 days', { size: 13, weight: 'Medium', color: T.foreground, lh: 18 }));
  head.appendChild(range);

  const cta = frame('Export button', 'HORIZONTAL', {
    px: 16,
    py: 9,
    gap: 8,
    radius: RADIUS,
    fill: T.primary,
    align: 'CENTER',
  });
  cta.appendChild(text('Export report', { size: 14, weight: 'Medium', color: T.primaryForeground, lh: 20 }));
  head.appendChild(cta);
  content.appendChild(head);

  // Stat row — four cards across the 1136px content width.
  const statRow = stretch(frame('Stat row', 'HORIZONTAL', { gap: 20 }));
  [
    ['Active now', '142', '+8.2%', true, T.chart1],
    ['Avg. focus time', '5h 12m', '+3.4%', true, T.chart3],
    ['Idle rate', '11.4%', '-1.9%', false, T.chart4],
    ['Overtime hrs', '38', '+12.0%', false, T.chart5],
  ].forEach((s) => {
    const c = statCard(s[0], s[1], s[2], s[3], s[4]);
    c.counterAxisSizingMode = 'FIXED';
    grow(c);
    statRow.appendChild(c);
  });
  content.appendChild(statRow);

  // Chart + AI panel
  const midRow = stretch(frame('Mid row', 'HORIZONTAL', { gap: 20 }));

  const chartCard = frame('Activity chart', 'VERTICAL', {
    p: 20,
    gap: 16,
    radius: RADIUS,
    fill: T.card,
    stroke: T.border,
    shadow: true,
  });
  grow(chartCard);
  chartCard.counterAxisSizingMode = 'FIXED';
  const chartHead = stretch(frame('Chart header', 'HORIZONTAL', { align: 'CENTER', gap: 12 }));
  chartHead.appendChild(text('Activity by hour', { size: 16, weight: 'Semi Bold', color: T.foreground, lh: 24 }));
  chartHead.appendChild(spacer());
  ['Active', 'Idle'].forEach((label, i) => {
    const legend = frame(`Legend · ${label}`, 'HORIZONTAL', { gap: 6, align: 'CENTER' });
    legend.appendChild(rect('Key', 8, 8, i === 0 ? T.chart1 : T.chart4, 2));
    legend.appendChild(text(label, { size: 12, color: T.mutedForeground, lh: 16 }));
    chartHead.appendChild(legend);
  });
  chartCard.appendChild(chartHead);

  const bars = stretch(frame('Bars', 'HORIZONTAL', { gap: 10, align: 'MAX' }));
  bars.counterAxisSizingMode = 'FIXED'; // horizontal frame → counter axis is height
  bars.resize(bars.width, 200);
  const series = [58, 96, 132, 158, 172, 150, 96, 64, 140, 176, 168, 128];
  series.forEach((h, i) => {
    const col = frame(`Hour ${9 + i}`, 'VERTICAL', { gap: 4, align: 'CENTER', justify: 'MAX' });
    grow(col);
    col.counterAxisSizingMode = 'FIXED';
    col.appendChild(stretch(rect('Idle', 20, Math.round(h * 0.22), T.chart4, 4)));
    col.appendChild(stretch(rect('Active', 20, h, T.chart1, 4)));
    bars.appendChild(col);
  });
  chartCard.appendChild(bars);
  midRow.appendChild(chartCard);

  const aiCard = frame('AI insight', 'VERTICAL', {
    w: 340,
    p: 20,
    gap: 12,
    radius: RADIUS,
    fill: T.aiTint,
    stroke: '#ddd2fa',
  });
  const aiHead = frame('AI header', 'HORIZONTAL', { gap: 8, align: 'CENTER' });
  aiHead.appendChild(rect('Spark', 16, 16, T.ai, 4));
  aiHead.appendChild(text('Insight', { size: 13, weight: 'Semi Bold', color: '#4b2fa8', lh: 18, ls: 0.2 }));
  aiCard.appendChild(aiHead);
  aiCard.appendChild(
    text('Idle time on Atlas migration rose 19% after 3pm this week.', {
      size: 15,
      weight: 'Medium',
      color: T.foreground,
      lh: 22,
    }),
  );
  aiCard.appendChild(
    text('Three contributors logged blocked-on-review status in the same window. Consider moving the review slot earlier.', {
      size: 13,
      color: T.mutedForeground,
      lh: 19,
    }),
  );
  aiCard.appendChild(text('View breakdown →', { size: 13, weight: 'Medium', color: T.ai, lh: 18 }));
  midRow.appendChild(aiCard);
  content.appendChild(midRow);

  // Table
  const tableCard = frame('People table', 'VERTICAL', {
    gap: 0,
    radius: RADIUS,
    fill: T.card,
    stroke: T.border,
    shadow: true,
  });
  stretch(tableCard);
  tableCard.clipsContent = true;

  const tHead = stretch(
    frame('Table header', 'HORIZONTAL', { px: 20, py: 14, gap: 16, align: 'CENTER', fill: T.card }),
  );
  tHead.appendChild(text('People needing attention', { size: 16, weight: 'Semi Bold', color: T.foreground, lh: 24 }));
  tHead.appendChild(spacer());
  tHead.appendChild(text('View all →', { size: 13, weight: 'Medium', color: T.primary, lh: 18 }));
  tableCard.appendChild(tHead);
  tableCard.appendChild(stretch(divider(T.border)));

  const rows = [
    ['Priya Raghavan', 'Atlas migration', 'Active', T.success, '#e6f4ee', '#106349', '7h 41m', '2 min ago'],
    ['Daniel Okoye', 'Billing revamp', 'On break', T.warning, '#fbf1de', '#8a5c14', '5h 03m', '14 min ago'],
    ['Mei Tanaka', 'Fleet telemetry', 'Idle', T.mutedForeground, T.muted, T.mutedForeground, '6h 20m', '38 min ago'],
    ['Sam Whitfield', 'Payroll audit', 'Overtime', T.destructive, '#f8e7e4', '#8f2b20', '9h 55m', 'Just now'],
  ];
  rows.forEach((r, i) => {
    const row = tableRow(r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7]);
    row.counterAxisSizingMode = 'AUTO';
    stretch(row);
    tableCard.appendChild(row);
    if (i < rows.length - 1) tableCard.appendChild(stretch(divider(T.borderMuted)));
  });
  content.appendChild(tableCard);

  main.appendChild(content);
  screen.appendChild(main);
  return screen;
}

/* ------------------------------------------------------------------ */
/*  Main                                                               */
/* ------------------------------------------------------------------ */

async function main() {
  await Promise.all(FONTS.map((f) => figma.loadFontAsync(f)));
  await createLocalStyles();

  const page = figma.currentPage;

  // Re-running replaces the previous output rather than stacking copies.
  const OUTPUT = ['01 · Foundations', '02 · Components', '03 · Dashboard — 1440×1024'];
  page.children.filter((n) => OUTPUT.indexOf(n.name) !== -1).forEach((n) => n.remove());

  const foundations = buildFoundations();
  const components = buildComponents();
  const dashboard = buildDashboard();

  page.appendChild(foundations);
  page.appendChild(components);
  page.appendChild(dashboard);

  // Lay the three frames out left-to-right with a 120px gutter.
  foundations.x = 0;
  foundations.y = 0;
  components.x = foundations.width + 120;
  components.y = 0;
  dashboard.x = components.x + components.width + 120;
  dashboard.y = 0;

  figma.currentPage.selection = [foundations, components, dashboard];
  figma.viewport.scrollAndZoomIntoView([foundations, components, dashboard]);
  figma.notify('WorkPulse sample file generated — 3 frames, 28 paint styles, 9 text styles.');
  figma.closePlugin();
}

main().catch((err) => {
  figma.notify('Generation failed: ' + err.message, { error: true });
  figma.closePlugin();
});
