import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// SQLite stores UTC as "YYYY-MM-DD HH:MM:SS"; resolution dates are ISO strings.
export function parseDbDate(value) {
  if (!value) return null;
  const text = String(value);
  const d = new Date(text.includes('T') ? text : `${text.replace(' ', 'T')}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}
const fmtDate = (v) => { const d = parseDbDate(v); return d ? d.toLocaleDateString() : 'N/A'; };
const fmtDateTime = (v) => {
  const d = parseDbDate(v);
  return d ? d.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '-';
};
const isDone = (s) => s === 'Resolved' || s === 'Closed';

const BRAND = [21, 61, 45];   // G-Plex dark green
const ACCENT = [58, 125, 68];

function addHeader(doc, title, subtitle, ref) {
  const w = doc.internal.pageSize.getWidth();
  doc.setFillColor(...BRAND);
  doc.rect(0, 0, w, 28, 'F');
  doc.setFillColor(...ACCENT);
  doc.roundedRect(14, 6, 16, 16, 3, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('GP', 22, 17, { align: 'center' });
  doc.setFontSize(14);
  doc.text('G-Plex Farm ERP', 34, 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(190, 210, 195);
  doc.text('CUSTOMER FEEDBACK & SATISFACTION (CSAT)', 34, 21);
  doc.setTextColor(220, 230, 222);
  doc.text(`Generated: ${new Date().toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}`, w - 14, 13, { align: 'right' });
  if (ref) {
    doc.setFont('helvetica', 'bold');
    doc.text(`REF: ${ref}`, w - 14, 21, { align: 'right' });
  }
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(title, 14, 40);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(subtitle, 14, 46);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(14, 50, w - 14, 50);
}

function addFooter(doc) {
  const pages = doc.internal.getNumberOfPages();
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.line(14, h - 16, w - 14, h - 16);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text('CONFIDENTIAL - FOR INTERNAL AND CUSTOMER RECORD USE ONLY', 14, h - 10);
    doc.text(`Page ${i} of ${pages}`, w - 14, h - 10, { align: 'right' });
  }
}

/** One ticket: customer statement, assignment, resolution and audit trail. */
export function generateTicketPDF(ticket) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const w = doc.internal.pageSize.getWidth();
  addHeader(doc, 'Complaint & Feedback Record',
    'Case record, customer statement, assignment and resolution trail', ticket.ticket_no);

  const rating = Number(ticket.rating) || 0;
  const sentiment = rating >= 4 ? 'Satisfied' : rating === 3 ? 'Neutral' : 'Dissatisfied';

  autoTable(doc, {
    startY: 54,
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2.5 },
    headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
    head: [['CUSTOMER INFORMATION', 'TICKET ATTRIBUTES']],
    body: [
      [
        `Customer: ${ticket.customer_name}\nEmail: ${ticket.email || 'N/A'}\nPhone: ${ticket.phone || 'N/A'}`,
        `Ticket No: ${ticket.ticket_no}\nCategory: ${ticket.category}\nIncident date: ${ticket.incident_date || 'N/A'}\nDate logged: ${fmtDate(ticket.created_at)}`,
      ],
      [
        `CSAT rating: ${rating} of 5\nSentiment: ${sentiment}`,
        `Status: ${String(ticket.status).toUpperCase()}\nPriority: ${ticket.priority}\nDepartment: ${ticket.assigned_dept || 'Unassigned'}\nAssigned to: ${ticket.assigned_to || 'Unassigned'}`,
      ],
    ],
  });

  let y = doc.lastAutoTable.finalY + 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('Subject / Incident Summary', 14, y);
  y += 5;
  doc.setFontSize(9.5);
  doc.text(doc.splitTextToSize(ticket.title || 'Customer statement', w - 28), 14, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  const desc = doc.splitTextToSize(ticket.description || 'No further description provided.', w - 28);
  doc.text(desc, 14, y);
  y += desc.length * 4.2 + 6;

  const done = isDone(ticket.status);
  autoTable(doc, {
    startY: y,
    theme: 'plain',
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 3 },
    body: [[{
      content: `RESOLUTION STATUS: ${String(ticket.status).toUpperCase()}${ticket.resolution_date ? ` (on ${fmtDate(ticket.resolution_date)})` : ''}\n\n${
        ticket.resolution_notes ? `Resolution summary:\n${ticket.resolution_notes}` : 'This ticket is still under review by the assigned officer.'}`,
      styles: {
        fillColor: done ? [236, 253, 245] : [254, 243, 199],
        textColor: done ? [6, 95, 70] : [146, 64, 14],
        lineWidth: 0.2,
        lineColor: [203, 213, 225],
      },
    }]],
  });

  y = doc.lastAutoTable.finalY + 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('Investigation Notes and Actions', 14, y);

  const notes = (ticket.notes || []).map((n) => [fmtDateTime(n.created_at), n.author, n.note]);
  autoTable(doc, {
    startY: y + 3,
    theme: 'striped',
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
    head: [['DATE / TIME', 'OFFICER', 'NOTE']],
    body: notes.length ? notes : [['-', 'System', 'No notes recorded yet.']],
    columnStyles: { 0: { cellWidth: 32 }, 1: { cellWidth: 36, fontStyle: 'bold' }, 2: { cellWidth: 112 } },
  });

  const signY = doc.lastAutoTable.finalY + 12;
  if (signY < doc.internal.pageSize.getHeight() - 35) {
    doc.setDrawColor(203, 213, 225);
    doc.line(14, signY + 14, 75, signY + 14);
    doc.line(w - 75, signY + 14, w - 14, signY + 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Case handler signature', 14, signY + 18);
    doc.text('Manager sign-off', w - 14, signY + 18, { align: 'right' });
  }

  addFooter(doc);
  doc.save(`${ticket.ticket_no}_Feedback_Record.pdf`);
}

/** Management summary built only from real figures: summary = /feedback/summary data. */
export function generateExecutivePDF(summary, tickets, filtersLabel = 'All tickets') {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const now = new Date();
  addHeader(doc, 'CSAT & Resolution Performance Report',
    `Generated ${now.toLocaleDateString()} · ${filtersLabel}`, 'CSAT-SUMMARY');

  const total = summary.total || 0;
  autoTable(doc, {
    startY: 53,
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 3, halign: 'center' },
    headStyles: { fillColor: BRAND, textColor: [255, 255, 255], fontStyle: 'bold' },
    head: [['TOTAL TICKETS', 'RESOLUTION RATE', 'AVERAGE CSAT', 'AVG RESOLUTION TIME']],
    body: [[
      `${total}`,
      `${summary.resolution_rate}%\n(${summary.resolved} resolved/closed)`,
      `${Number(summary.avg_rating || 0).toFixed(1)} / 5`,
      summary.avg_resolution_hours == null ? 'No resolved tickets yet' : `${summary.avg_resolution_hours} hrs`,
    ]],
  });

  let y = doc.lastAutoTable.finalY + 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('1. Rating distribution', 14, y);
  const label = { 5: '5 - Delighted', 4: '4 - Satisfied', 3: '3 - Neutral', 2: '2 - Dissatisfied', 1: '1 - Critical' };
  autoTable(doc, {
    startY: y + 3,
    theme: 'striped',
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
    head: [['RATING', 'TICKETS', 'SHARE']],
    body: (summary.distribution || []).map((r) => [label[r.rating], r.count, total ? `${((r.count / total) * 100).toFixed(1)}%` : '0%']),
  });

  y = doc.lastAutoTable.finalY + 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('2. By category', 14, y);
  const cats = summary.by_category || [];
  autoTable(doc, {
    startY: y + 3,
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 2.2 },
    headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontStyle: 'bold' },
    head: [['CATEGORY', 'TICKETS', 'RESOLVED', 'RESOLVED %', 'AVG CSAT']],
    body: cats.map((c) => [c.category, c.total, c.resolved, `${c.total ? Math.round((c.resolved / c.total) * 100) : 0}%`, Number(c.avg_rating || 0).toFixed(1)]),
  });

  y = doc.lastAutoTable.finalY + 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('3. Findings (calculated from the data above)', 14, y);
  const findings = [];
  const lowRated = {};
  (tickets || []).filter((t) => t.rating <= 2).forEach((t) => { lowRated[t.category] = (lowRated[t.category] || 0) + 1; });
  const worst = Object.entries(lowRated).sort((a, b) => b[1] - a[1])[0];
  if (worst) findings.push(`Most 1-2 star tickets: ${worst[0]} (${worst[1]}).`);
  const best = [...cats].filter((c) => c.total > 0).sort((a, b) => b.avg_rating - a.avg_rating)[0];
  if (best) findings.push(`Highest rated category: ${best.category} (${Number(best.avg_rating).toFixed(1)} / 5).`);
  findings.push(`${summary.open + summary.in_progress} ticket(s) still open or in progress; ${summary.urgent_open} urgent and unresolved.`);
  findings.push(`Overall resolution rate is ${summary.resolution_rate}% against a 75% target set in this report; adjust the target to your own service standard.`);
  autoTable(doc, {
    startY: y + 3,
    theme: 'plain',
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2.5 },
    body: [[{ content: findings.map((f) => `- ${f}`).join('\n'), styles: { fillColor: [248, 250, 252], textColor: [51, 65, 85], lineWidth: 0.2, lineColor: [226, 232, 240] } }]],
  });

  addFooter(doc);
  doc.save(`CSAT_Report_${now.toISOString().split('T')[0]}.pdf`);
}
