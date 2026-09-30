import { TimetableSchedule, ScheduledSection } from '../types';
import { resolveSlotToPositions } from './schedulerSolver';

export function createTimetableCanvas(tt: TimetableSchedule): HTMLCanvasElement {
  const scale = 2; // Retina 2x resolution
  const padding = 28;
  const contentWidth = 1180;
  const totalWidth = contentWidth + padding * 2;

  const headerHeight = 64;
  const gridHeaderHeight = 48;
  const dayHeight = 72; // 40px theory + 32px lab
  const gridHeight = gridHeaderHeight + (5 * dayHeight);
  
  const summaryHeaderHeight = 32;
  const summaryRowHeight = 28;
  const summaryHeight = summaryHeaderHeight + (tt.sections.length * summaryRowHeight) + 32;
  const footerHeight = 32;

  const totalHeight = padding + headerHeight + 16 + gridHeight + 24 + summaryHeight + footerHeight + padding;

  const canvas = document.createElement('canvas');
  canvas.width = totalWidth * scale;
  canvas.height = totalHeight * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error("Could not acquire 2D canvas context");
  ctx.scale(scale, scale);

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, totalWidth, totalHeight);

  // Top Header Card
  const hdrX = padding;
  const hdrY = padding;
  const hdrW = contentWidth;
  const hdrH = headerHeight;

  // Header Gradient
  const grad = ctx.createLinearGradient(hdrX, hdrY, hdrX + hdrW, hdrY);
  grad.addColorStop(0, '#0a3d7a');
  grad.addColorStop(0.5, '#1e40af');
  grad.addColorStop(1, '#4c1d95');
  ctx.fillStyle = grad;
  roundRect(ctx, hdrX, hdrY, hdrW, hdrH, 12);
  ctx.fill();

  // Header Text
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px Inter, -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`AutoScheduler — Option ${tt.id}`, hdrX + 18, hdrY + 22);

  ctx.fillStyle = '#93c5fd';
  ctx.font = '11px Inter, -apple-system, sans-serif';
  ctx.fillText('100% Conflict-Free Schedule • Academic Timetable Matrix', hdrX + 18, hdrY + 44);

  // Stats Badge
  let totalCreds = 0;
  tt.sections.forEach(s => totalCreds += s.credits);
  const badgeText = `${tt.sections.length} Courses  |  ${totalCreds.toFixed(1)} Credits`;
  ctx.font = 'bold 12px Inter, -apple-system, sans-serif';
  const badgeW = ctx.measureText(badgeText).width + 24;
  const badgeX = hdrX + hdrW - badgeW - 16;
  const badgeY = hdrY + (hdrH - 28) / 2;

  ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
  roundRect(ctx, badgeX, badgeY, badgeW, 28, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText(badgeText, badgeX + badgeW / 2, badgeY + 14);

  // PREPARE GRID MAPPINGS
  const theoryMap: Record<string, { section: ScheduledSection; slot: string }> = {};
  const labMap: Record<string, { section: ScheduledSection; slot: string }> = {};
  tt.sections.forEach(sec => {
    if (sec.theorySlot && sec.theorySlot !== 'N/A') {
      const positions = resolveSlotToPositions(sec.theorySlot);
      positions.forEach(p => {
        theoryMap[`${p.day}_${p.slotId}`] = { section: sec, slot: sec.theorySlot };
      });
    }
    if (sec.labSlot && sec.labSlot !== 'N/A') {
      const positions = resolveSlotToPositions(sec.labSlot);
      positions.forEach(p => {
        const blockId = Math.ceil(p.slotId / 2);
        labMap[`${p.day}_${blockId}`] = { section: sec, slot: sec.labSlot };
      });
    }
  });

  // DRAW TIMETABLE GRID
  const gridY = hdrY + hdrH + 16;
  const colDayW = 55;
  const colTypeW = 50;
  const lunchW = 35;
  const actualSlotW = (contentWidth - colDayW - colTypeW - lunchW) / 8;

  // Header Row 1
  const r1Y = gridY;
  const r1H = 24;
  ctx.fillStyle = '#0a3d7a';
  ctx.fillRect(hdrX, r1Y, contentWidth, r1H);
  ctx.strokeStyle = '#0d4a94';
  ctx.lineWidth = 1;
  ctx.strokeRect(hdrX, r1Y, contentWidth, r1H);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px Inter, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('DAY', hdrX + colDayW / 2, r1Y + 24);
  ctx.fillText('TYPE', hdrX + colDayW + colTypeW / 2, r1Y + 24);
  ctx.fillText('MORNING SESSIONS', hdrX + colDayW + colTypeW + (actualSlotW * 4) / 2, r1Y + 12);
  ctx.fillText('LUNCH', hdrX + colDayW + colTypeW + actualSlotW * 4 + lunchW / 2, r1Y + 24);
  ctx.fillText('AFTERNOON SESSIONS', hdrX + colDayW + colTypeW + actualSlotW * 4 + lunchW + (actualSlotW * 4) / 2, r1Y + 12);

  // Header Row 2
  const r2Y = r1Y + r1H;
  const r2H = 24;
  ctx.fillStyle = '#0d4a94';
  ctx.fillRect(hdrX + colDayW + colTypeW, r2Y, actualSlotW * 4, r2H);
  ctx.fillRect(hdrX + colDayW + colTypeW + actualSlotW * 4 + lunchW, r2Y, actualSlotW * 4, r2H);

  const timeSlots = [
    '08:00 - 08:50', '09:00 - 09:50', '10:00 - 10:50', '11:00 - 11:50',
    '12:45 - 13:35', '13:45 - 14:35', '14:45 - 15:35', '15:45 - 16:35'
  ];

  ctx.fillStyle = '#e2e8f0';
  ctx.font = '10px Inter, -apple-system, sans-serif';
  for (let i = 0; i < 4; i++) {
    const x = hdrX + colDayW + colTypeW + i * actualSlotW + actualSlotW / 2;
    ctx.fillText(timeSlots[i], x, r2Y + 12);
  }
  for (let i = 0; i < 4; i++) {
    const x = hdrX + colDayW + colTypeW + actualSlotW * 4 + lunchW + i * actualSlotW + actualSlotW / 2;
    ctx.fillText(timeSlots[4 + i], x, r2Y + 12);
  }

  // Draw Grid Days
  const days = ['MON', 'TUE', 'WED', 'THU', 'FRI'];
  let currentDayY = r2Y + r2H;

  days.forEach(day => {
    const thRowY = currentDayY;
    const thRowH = 40;
    const lbRowY = thRowY + thRowH;
    const lbRowH = 32;

    // Day cell
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(hdrX, thRowY, colDayW, thRowH + lbRowH);
    ctx.strokeStyle = '#cbd5e1';
    ctx.strokeRect(hdrX, thRowY, colDayW, thRowH + lbRowH);
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 12px Inter, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(day, hdrX + colDayW / 2, thRowY + (thRowH + lbRowH) / 2);

    // Theory Label
    ctx.fillStyle = '#f0f9ff';
    ctx.fillRect(hdrX + colDayW, thRowY, colTypeW, thRowH);
    ctx.strokeStyle = '#cbd5e1';
    ctx.strokeRect(hdrX + colDayW, thRowY, colTypeW, thRowH);
    ctx.fillStyle = '#0369a1';
    ctx.font = 'bold 10px Inter, -apple-system, sans-serif';
    ctx.fillText('Theory', hdrX + colDayW + colTypeW / 2, thRowY + thRowH / 2);

    // Lab Label
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(hdrX + colDayW, lbRowY, colTypeW, lbRowH);
    ctx.strokeStyle = '#cbd5e1';
    ctx.strokeRect(hdrX + colDayW, lbRowY, colTypeW, lbRowH);
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 10px Inter, -apple-system, sans-serif';
    ctx.fillText('Lab', hdrX + colDayW + colTypeW / 2, lbRowY + lbRowH / 2);

    // Lunch Column
    const lunchX = hdrX + colDayW + colTypeW + actualSlotW * 4;
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(lunchX, thRowY, lunchW, thRowH + lbRowH);
    ctx.strokeStyle = '#94a3b8';
    ctx.strokeRect(lunchX, thRowY, lunchW, thRowH + lbRowH);
    ctx.fillStyle = '#475569';
    ctx.font = 'bold 9px Inter, -apple-system, sans-serif';
    ctx.fillText('LUNCH', lunchX + lunchW / 2, thRowY + (thRowH + lbRowH) / 2);

    // Morning Theory Slots 1..4
    for (let s = 1; s <= 4; s++) {
      const slotX = hdrX + colDayW + colTypeW + (s - 1) * actualSlotW;
      const cell = theoryMap[`${day}_${s}`];
      drawTheorySlotCell(ctx, slotX, thRowY, actualSlotW, thRowH, cell);
    }

    // Afternoon Theory Slots 5..8
    for (let s = 5; s <= 8; s++) {
      const slotX = lunchX + lunchW + (s - 5) * actualSlotW;
      const cell = theoryMap[`${day}_${s}`];
      drawTheorySlotCell(ctx, slotX, thRowY, actualSlotW, thRowH, cell);
    }

    // Lab Blocks 1..4
    const lb1X = hdrX + colDayW + colTypeW;
    drawLabBlockCell(ctx, lb1X, lbRowY, actualSlotW * 2, lbRowH, labMap[`${day}_1`]);

    const lb2X = hdrX + colDayW + colTypeW + actualSlotW * 2;
    drawLabBlockCell(ctx, lb2X, lbRowY, actualSlotW * 2, lbRowH, labMap[`${day}_2`]);

    const lb3X = lunchX + lunchW;
    drawLabBlockCell(ctx, lb3X, lbRowY, actualSlotW * 2, lbRowH, labMap[`${day}_3`]);

    const lb4X = lunchX + lunchW + actualSlotW * 2;
    drawLabBlockCell(ctx, lb4X, lbRowY, actualSlotW * 2, lbRowH, labMap[`${day}_4`]);

    currentDayY += (thRowH + lbRowH);
  });

  // DRAW SUMMARY REGISTRATION TABLE
  const sumY = currentDayY + 24;
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 13px Inter, -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Course Registration & Faculty Allocation Summary', hdrX, sumY);

  const tableTopY = sumY + 12;
  const cols = [
    { title: '#', w: 35, align: 'center' as const },
    { title: 'Course Code', w: 105, align: 'left' as const },
    { title: 'Course Title', w: 310, align: 'left' as const },
    { title: 'Category', w: 90, align: 'left' as const },
    { title: 'Theory Slot', w: 95, align: 'center' as const },
    { title: 'Theory Faculty', w: 195, align: 'left' as const },
    { title: 'Lab Slot', w: 110, align: 'center' as const },
    { title: 'Lab Faculty', w: 180, align: 'left' as const },
    { title: 'Credits', w: 60, align: 'center' as const }
  ];

  let curX = hdrX;
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(hdrX, tableTopY, contentWidth, summaryHeaderHeight);
  ctx.strokeStyle = '#cbd5e1';
  ctx.strokeRect(hdrX, tableTopY, contentWidth, summaryHeaderHeight);

  ctx.fillStyle = '#334155';
  ctx.font = 'bold 11px Inter, -apple-system, sans-serif';
  cols.forEach(c => {
    ctx.textAlign = c.align;
    const tx = c.align === 'center' ? curX + c.w / 2 : curX + 8;
    ctx.fillText(c.title, tx, tableTopY + summaryHeaderHeight / 2);
    curX += c.w;
  });

  let rowY = tableTopY + summaryHeaderHeight;
  tt.sections.forEach((sec, idx) => {
    ctx.fillStyle = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
    ctx.fillRect(hdrX, rowY, contentWidth, summaryRowHeight);
    ctx.strokeStyle = '#e2e8f0';
    ctx.strokeRect(hdrX, rowY, contentWidth, summaryRowHeight);

    curX = hdrX;
    ctx.font = '11px Inter, -apple-system, sans-serif';

    // 1: Index
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'center';
    ctx.fillText(String(idx + 1), curX + cols[0].w / 2, rowY + summaryRowHeight / 2);
    curX += cols[0].w;

    // 2: Code
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 11px Inter, -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(sec.courseCode, curX + 8, rowY + summaryRowHeight / 2);
    curX += cols[1].w;

    // 3: Title
    ctx.font = '11px Inter, -apple-system, sans-serif';
    ctx.fillStyle = '#1e293b';
    ctx.fillText(truncateCanvasText(ctx, sec.courseTitle, cols[2].w - 16), curX + 8, rowY + summaryRowHeight / 2);
    curX += cols[2].w;

    // 4: Category
    ctx.fillStyle = '#475569';
    ctx.fillText(sec.category || 'Core', curX + 8, rowY + summaryRowHeight / 2);
    curX += cols[3].w;

    // 5: Theory Slot
    ctx.fillStyle = '#1d4ed8';
    ctx.font = 'bold 11px Inter, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(sec.theorySlot || '—', curX + cols[4].w / 2, rowY + summaryRowHeight / 2);
    curX += cols[4].w;

    // 6: Theory Faculty
    ctx.font = '11px Inter, -apple-system, sans-serif';
    ctx.fillStyle = '#334155';
    ctx.textAlign = 'left';
    ctx.fillText(truncateCanvasText(ctx, sec.theoryFaculty || '—', cols[5].w - 16), curX + 8, rowY + summaryRowHeight / 2);
    curX += cols[5].w;

    // 7: Lab Slot
    ctx.fillStyle = '#b45309';
    ctx.font = 'bold 11px Inter, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(sec.labSlot || '—', curX + cols[6].w / 2, rowY + summaryRowHeight / 2);
    curX += cols[6].w;

    // 8: Lab Faculty
    ctx.font = '11px Inter, -apple-system, sans-serif';
    ctx.fillStyle = '#334155';
    ctx.textAlign = 'left';
    ctx.fillText(truncateCanvasText(ctx, sec.labFaculty || '—', cols[7].w - 16), curX + 8, rowY + summaryRowHeight / 2);
    curX += cols[7].w;

    // 9: Credits
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 11px Inter, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(sec.credits), curX + cols[8].w / 2, rowY + summaryRowHeight / 2);

    rowY += summaryRowHeight;
  });

  ctx.fillStyle = '#94a3b8';
  ctx.font = '10px Inter, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Generated by AutoScheduler • High-Resolution Export', totalWidth / 2, rowY + 24);

  return canvas;
}

function drawTheorySlotCell(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, cell?: { section: ScheduledSection; slot: string }) {
  if (cell) {
    ctx.fillStyle = '#e0f2fe';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#cbd5e1';
    ctx.strokeRect(x, y, w, h);

    ctx.fillStyle = '#1e3a8a';
    ctx.font = 'bold 9px Inter, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(cell.slot, x + w / 2, y + 9);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 11px Inter, -apple-system, sans-serif';
    ctx.fillText(cell.section.courseCode, x + w / 2, y + 21);

    ctx.fillStyle = '#475569';
    ctx.font = '9px Inter, -apple-system, sans-serif';
    ctx.fillText(truncateCanvasText(ctx, cell.section.theoryFaculty, w - 8), x + w / 2, y + 32);
  } else {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#e2e8f0';
    ctx.strokeRect(x, y, w, h);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '10px Inter, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Free', x + w / 2, y + h / 2);
  }
}

function drawLabBlockCell(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, cell?: { section: ScheduledSection; slot: string }) {
  if (cell) {
    ctx.fillStyle = '#fef3c7';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#fde68a';
    ctx.strokeRect(x, y, w, h);

    ctx.fillStyle = '#78350f';
    ctx.font = 'bold 9px Inter, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${cell.slot}  •  ${cell.section.courseCode} Lab`, x + w / 2, y + 11);

    ctx.fillStyle = '#451a03';
    ctx.font = '9px Inter, -apple-system, sans-serif';
    ctx.fillText(truncateCanvasText(ctx, cell.section.labFaculty || cell.section.theoryFaculty, w - 10), x + w / 2, y + 23);
  } else {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#e2e8f0';
    ctx.strokeRect(x, y, w, h);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '10px Inter, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Free', x + w / 2, y + h / 2);
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  if (w < 2 * r) r = w / 2;
  if (h < 2 * r) r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function truncateCanvasText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (!text) return '';
  if (ctx.measureText(text).width <= maxW) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(s + '…').width > maxW) {
    s = s.slice(0, -1);
  }
  return s + '…';
}

export function downloadImage(tt: TimetableSchedule, format: 'png' | 'jpeg'): void {
  const canvas = createTimetableCanvas(tt);
  const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
  const ext = format === 'jpeg' ? 'jpg' : 'png';
  const filename = `AutoScheduler_Option_${tt.id}.${ext}`;

  if (canvas.toBlob) {
    canvas.toBlob(blob => {
      if (!blob) {
        triggerDownload(canvas.toDataURL(mimeType, 0.95), filename);
      } else {
        const url = URL.createObjectURL(blob);
        triggerDownload(url, filename);
        setTimeout(() => URL.revokeObjectURL(url), 4000);
      }
    }, mimeType, 0.95);
  } else {
    triggerDownload(canvas.toDataURL(mimeType, 0.95), filename);
  }
}

export function downloadPdf(tt: TimetableSchedule): void {
  const canvas = createTimetableCanvas(tt);
  const filename = `AutoScheduler_Option_${tt.id}.pdf`;
  const jspdfObj = (window as any).jspdf;

  if (jspdfObj && jspdfObj.jsPDF) {
    const { jsPDF } = jspdfObj;
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageWidth = 297;
    const pageHeight = 210;
    const margin = 8;
    const maxW = pageWidth - margin * 2;
    const maxH = pageHeight - margin * 2;

    const imgRatio = canvas.width / canvas.height;
    let renderW = maxW;
    let renderH = renderW / imgRatio;

    if (renderH > maxH) {
      renderH = maxH;
      renderW = renderH * imgRatio;
    }

    const posX = margin + (maxW - renderW) / 2;
    const posY = margin + (maxH - renderH) / 2;
    const imgData = canvas.toDataURL('image/jpeg', 0.98);

    pdf.addImage(imgData, 'JPEG', posX, posY, renderW, renderH, undefined, 'FAST');
    pdf.save(filename);
  } else {
    window.print();
  }
}

function triggerDownload(url: string, filename: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    if (document.body.contains(a)) document.body.removeChild(a);
  }, 2000);
}
