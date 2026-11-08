// W12 SOUVENIR — PDF typesetting of the keepsake report
// (DOCS/ARCHITECTURE.md §Surfaces, Souvenir). Serif pages (jsPDF's built-in
// Times stands in for Playfair), a full-bleed plum cover with a brass rule,
// then flowing, paginated sections. Palette mirrors src/shared/tokens.css.

import { jsPDF } from 'jspdf';
import type { ReportSection, SouvenirReport } from './report';

/** A4 in points. */
const PAGE = { width: 595.28, height: 841.89 } as const;
const MARGIN = { top: 78, side: 68, bottom: 92 } as const;
const CONTENT_WIDTH = PAGE.width - 2 * MARGIN.side;
const LINE_STEP = 17;
const PARAGRAPH_GAP = 9;
const SECTION_GAP = 30;

/** tokens.css palette as RGB triples. */
const COLORS = {
  plum: [42, 26, 51],
  plumDeep: [28, 17, 34],
  brass: [201, 164, 92],
  brassDim: [111, 90, 53],
  parchment: [243, 234, 216],
  parchmentMuted: [185, 169, 150],
} as const;

function lines(doc: jsPDF, text: string, maxWidth = CONTENT_WIDTH): string[] {
  return doc.splitTextToSize(text, maxWidth) as string[];
}

/** Section writer that owns the vertical cursor and page breaks. */
class ContentWriter {
  y = MARGIN.top;
  private started = false;
  private readonly doc: jsPDF;

  constructor(doc: jsPDF) {
    this.doc = doc;
  }

  /** Space before a section; open a fresh page when this one cannot hold it. */
  beginSection(minimumHeight: number): void {
    if (this.started) this.y += SECTION_GAP;
    if (!this.started || this.y + minimumHeight > PAGE.height - MARGIN.bottom) {
      this.doc.addPage();
      this.y = MARGIN.top;
      this.started = true;
    }
  }

  /** Break to a new page if `needed` points do not fit below the cursor. */
  room(needed: number): void {
    if (this.y + needed > PAGE.height - MARGIN.bottom) {
      this.doc.addPage();
      this.y = MARGIN.top;
    }
  }
}

/** Full-bleed plum cover: wordmark, title, brass rule, birth facts. */
function drawCover(doc: jsPDF, report: SouvenirReport): void {
  doc.setFillColor(...COLORS.plum);
  doc.rect(0, 0, PAGE.width, PAGE.height, 'F');

  const centerX = PAGE.width / 2;

  doc.setFont('times', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(...COLORS.brass);
  doc.setCharSpace(4);
  doc.text('NATALLY', centerX, 206, { align: 'center' });
  doc.setCharSpace(0);

  doc.setFontSize(27);
  doc.setTextColor(...COLORS.parchment);
  let y = 292;
  for (const titleLine of lines(doc, report.title, PAGE.width - 2 * 92)) {
    doc.text(titleLine, centerX, y, { align: 'center' });
    y += 34;
  }

  const ruleY = y + 10;
  doc.setDrawColor(...COLORS.brass);
  doc.setLineWidth(1.2);
  doc.line(centerX - 110, ruleY, centerX + 110, ruleY);

  doc.setFontSize(11.5);
  doc.setTextColor(...COLORS.parchmentMuted);
  y = ruleY + 44;
  const facts = (report.sections[0]?.body ?? '').split('\n');
  for (const fact of facts) {
    for (const factLine of lines(doc, fact, PAGE.width - 2 * 110)) {
      doc.text(factLine, centerX, y, { align: 'center' });
      y += 17;
    }
  }

  doc.setFontSize(9.5);
  doc.setTextColor(...COLORS.brassDim);
  doc.text('Set by Natally · your astrologer companion', centerX, PAGE.height - 64, {
    align: 'center',
  });
}

/** One keepsake section: heading, short brass rule, flowing paragraphs. */
function drawSection(doc: jsPDF, writer: ContentWriter, section: ReportSection): void {
  const headingLines = lines(doc, section.heading);
  writer.beginSection(headingLines.length * 22 + 40);

  doc.setFont('times', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(...COLORS.plum);
  for (const headingLine of headingLines) {
    writer.room(22);
    doc.text(headingLine, MARGIN.side, writer.y);
    writer.y += 22;
  }

  writer.y += 6;
  doc.setDrawColor(...COLORS.brass);
  doc.setLineWidth(1);
  doc.line(MARGIN.side, writer.y, MARGIN.side + 56, writer.y);
  writer.y += 24;

  doc.setFont('times', 'normal');
  doc.setFontSize(11.5);
  doc.setTextColor(...COLORS.plumDeep);
  for (const paragraph of section.body.split('\n\n')) {
    for (const line of lines(doc, paragraph)) {
      writer.room(LINE_STEP);
      doc.text(line, MARGIN.side, writer.y);
      writer.y += LINE_STEP;
    }
    writer.y += PARAGRAPH_GAP;
  }
}

/** Running footer on every content page: wordmark left, page count right. */
function drawFooters(doc: jsPDF): void {
  const total = doc.getNumberOfPages();
  for (let page = 2; page <= total; page++) {
    doc.setPage(page);
    doc.setFont('times', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.brassDim);
    doc.text('Natally', MARGIN.side, PAGE.height - 48);
    doc.text(`${page} / ${total}`, PAGE.width - MARGIN.side, PAGE.height - 48, {
      align: 'right',
    });
  }
}

/** Typeset the keepsake: plum cover, then all sections after the cover. */
export function exportPdf(report: SouvenirReport): Blob {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
  drawCover(doc, report);
  const writer = new ContentWriter(doc);
  for (const section of report.sections.slice(1)) {
    drawSection(doc, writer, section);
  }
  drawFooters(doc);
  return doc.output('blob');
}

/** Download filename from the report title: `natally-<slug>.pdf`. */
export function souvenirFileName(report: SouvenirReport): string {
  const slug = report.title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `natally-${slug || 'souvenir'}.pdf`;
}

/** Typeset the report and hand the blob to the browser as a download. */
export function downloadPdf(report: SouvenirReport): void {
  const blob = exportPdf(report);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = souvenirFileName(report);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
