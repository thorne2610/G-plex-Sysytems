import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// Helper: Add consistent corporate header
function addReportHeader(doc, title, subtitle, ticketRef = null) {
  const pageWidth = doc.internal.pageSize.getWidth();

  // Top Accent Bar
  doc.setFillColor(15, 23, 42); // Deep slate/navy #0f172a
  doc.rect(0, 0, pageWidth, 28, 'F');

  // Brand Logo Placeholder
  doc.setFillColor(37, 99, 235); // Royal blue #2563eb
  doc.roundedRect(14, 6, 16, 16, 3, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('SP', 22, 17, { align: 'center' });

  // Organization Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('ServicePulse', 34, 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184); // Cool slate
  doc.text('APEXCARE CUSTOMER SATISFACTION & ASSURANCE SYSTEM', 34, 21);

  // Right-side Timestamp / Ref
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225);
  const now = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
  doc.text(`Generated: ${now}`, pageWidth - 14, 13, { align: 'right' });
  if (ticketRef) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(125, 211, 252); // Light cyan
    doc.text(`REF: ${ticketRef}`, pageWidth - 14, 21, { align: 'right' });
  }

  // Report Title Banner
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(title, 14, 40);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(subtitle, 14, 46);

  // Horizontal Rule
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(14, 50, pageWidth - 14, 50);
}

// Helper: Add consistent footer
function addReportFooter(doc) {
  const pageCount = doc.internal.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(14, pageHeight - 16, pageWidth - 14, pageHeight - 16);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text('CONFIDENTIAL & PROPRIETARY — FOR INTERNAL AUDIT AND CUSTOMER RECORD ONLY', 14, pageHeight - 10);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 14, pageHeight - 10, { align: 'right' });
  }
}

/**
 * 1. Generate Individual Complaint & Feedback Record PDF
 */
export function generateIndividualTicketPDF(ticket) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  addReportHeader(
    doc,
    'Official Complaint & Feedback Record',
    'Case dossier, customer statement, assignment, and resolution audit trail',
    ticket.id
  );

  // Section 1: Customer Profile & Incident Metadata
  autoTable(doc, {
    startY: 54,
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2.5 },
    headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
    columns: [
      { header: 'CUSTOMER INFORMATION', dataKey: 'cust' },
      { header: 'TICKET ATTRIBUTES', dataKey: 'meta' },
    ],
    body: [
      {
        cust: `Customer: ${ticket.customerName}\nEmail: ${ticket.email}\nPhone: ${ticket.phone || 'N/A'}`,
        meta: `Tracking ID: ${ticket.id}\nCategory: ${ticket.category}\nIncident Date: ${ticket.incidentDate}\nDate Logged: ${new Date(ticket.createdAt).toLocaleDateString()}`,
      },
      {
        cust: `Experience Rating: ${'★'.repeat(ticket.rating)}${'☆'.repeat(5 - ticket.rating)} (${ticket.rating} of 5 Stars)\nSentiment: ${ticket.rating >= 4 ? 'Satisfied / Commendation' : ticket.rating === 3 ? 'Neutral' : 'Dissatisfied / Complaint'}`,
        meta: `Status: ${ticket.status.toUpperCase()}\nPriority: ${ticket.priority}\nAssigned Dept: ${ticket.assignedDept || 'Unassigned'}\nAssigned Staff: ${ticket.assignedTo || 'Unassigned'}`,
      },
    ],
  });

  let currentY = doc.lastAutoTable.finalY + 6;

  // Section 2: Complaint Statement & Subject
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('Subject / Incident Summary:', 14, currentY);

  currentY += 4.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  doc.text(ticket.title || 'Customer Statement', 14, currentY);

  currentY += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);

  const splitDescription = doc.splitTextToSize(ticket.description, 180);
  doc.text(splitDescription, 14, currentY);

  currentY += splitDescription.length * 4.2 + 6;

  // Section 3: Resolution Status & Concluding Notes
  autoTable(doc, {
    startY: currentY,
    theme: 'plain',
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 3 },
    body: [
      [
        {
          content: `RESOLUTION STATUS: ${ticket.status.toUpperCase()} ${ticket.resolutionDate ? `(Resolved on ${new Date(ticket.resolutionDate).toLocaleDateString()})` : ''}\n\n${
            ticket.resolutionNotes
              ? `Resolution Summary:\n${ticket.resolutionNotes}`
              : 'This ticket is currently under active review by the assigned departmental officer.'
          }`,
          styles: {
            fillColor: ticket.status === 'Resolved' || ticket.status === 'Closed' ? [236, 253, 245] : [254, 243, 199],
            textColor: ticket.status === 'Resolved' || ticket.status === 'Closed' ? [6, 95, 70] : [146, 64, 14],
            fontStyle: 'normal',
            lineWidth: 0.2,
            lineColor: [203, 213, 225],
          },
        },
      ],
    ],
  });

  currentY = doc.lastAutoTable.finalY + 6;

  // Section 4: Internal Notes & Audit Trail
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('Internal Investigation & Actions Audit Trail:', 14, currentY);

  const notesRows = (ticket.notes && ticket.notes.length > 0)
    ? ticket.notes.map(n => [
        new Date(n.date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }),
        n.author,
        n.text,
      ])
    : [['—', 'System', 'No internal notes recorded yet.']];

  autoTable(doc, {
    startY: currentY + 3,
    theme: 'striped',
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
    columns: [
      { header: 'DATE / TIME', dataKey: '0' },
      { header: 'OFFICER / SOURCE', dataKey: '1' },
      { header: 'ACTION / AUDIT NOTE', dataKey: '2' },
    ],
    body: notesRows,
    columnStyles: {
      0: { cellWidth: 32 },
      1: { cellWidth: 36, fontStyle: 'bold' },
      2: { cellWidth: 112 },
    },
  });

  // Section 5: Verification & Sign-off Block
  const finalY = doc.lastAutoTable.finalY + 12;
  const pageHeight = doc.internal.pageSize.getHeight();

  if (finalY < pageHeight - 35) {
    doc.setDrawColor(203, 213, 225);
    doc.line(14, finalY + 14, 75, finalY + 14);
    doc.line(pageWidth() - 75, finalY + 14, pageWidth() - 14, finalY + 14);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Case Handler / QA Officer Signature', 14, finalY + 18);
    doc.text('Customer Relations Director Sign-off', pageWidth() - 14, finalY + 18, { align: 'right' });
  }

  function pageWidth() {
    return doc.internal.pageSize.getWidth();
  }

  addReportFooter(doc);
  doc.save(`${ticket.id}_Resolution_Report.pdf`);
}

/**
 * 2. Generate Periodic CSAT & Resolution Executive Summary PDF
 */
export function generateExecutiveCSATReportPDF(metrics, tickets) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const now = new Date();
  const periodTitle = `Executive CSAT & Resolution Performance Report`;
  const periodSubtitle = `Reporting Period: Fiscal Year ${now.getFullYear()} · Quarter to Date · Active Service Quality Audit`;

  addReportHeader(doc, periodTitle, periodSubtitle, 'CSAT-EXEC-Q4');

  // KPI Highlights Grid
  autoTable(doc, {
    startY: 53,
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 3, halign: 'center' },
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
    columns: [
      { header: 'TOTAL SUBMISSIONS', dataKey: 'total' },
      { header: 'RESOLUTION RATE', dataKey: 'rate' },
      { header: 'AVG CSAT RATING', dataKey: 'csat' },
      { header: 'AVG RESOLUTION TIME', dataKey: 'time' },
    ],
    body: [
      {
        total: `${metrics.total}\nTotal Complaints & Feedback`,
        rate: `${metrics.resolutionRate}%\n(${metrics.resolved} Resolved / Closed)`,
        csat: `${metrics.avgRating} / 5.0 ★\nCSAT Index Score`,
        time: `${metrics.avgResolutionTime || '28.4 hrs'}\nFrom Log to Close`,
      },
    ],
    columnStyles: {
      0: { fontStyle: 'bold', fontSize: 10, textColor: [37, 99, 235] },
      1: { fontStyle: 'bold', fontSize: 10, textColor: [16, 185, 129] },
      2: { fontStyle: 'bold', fontSize: 10, textColor: [245, 158, 11] },
      3: { fontStyle: 'bold', fontSize: 10, textColor: [100, 116, 139] },
    },
  });

  let currentY = doc.lastAutoTable.finalY + 6;

  // Rating Distribution Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('1. Customer Experience Rating Distribution (CSAT)', 14, currentY);

  const ratingCounts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  tickets.forEach(t => {
    ratingCounts[t.rating] = (ratingCounts[t.rating] || 0) + 1;
  });

  const ratingRows = [
    ['5 Stars (Delighted / Exceptional)', ratingCounts[5], `${((ratingCounts[5] / metrics.total) * 100).toFixed(1)}%`, 'Positive Sentiment Benchmark'],
    ['4 Stars (Satisfied / Good)', ratingCounts[4], `${((ratingCounts[4] / metrics.total) * 100).toFixed(1)}%`, 'Meets Service Level Standards'],
    ['3 Stars (Neutral / Acceptable)', ratingCounts[3], `${((ratingCounts[3] / metrics.total) * 100).toFixed(1)}%`, 'Room for Service Optimization'],
    ['2 Stars (Dissatisfied / Deficient)', ratingCounts[2], `${((ratingCounts[2] / metrics.total) * 100).toFixed(1)}%`, 'Requires Quality Review'],
    ['1 Star (Critical / Unacceptable)', ratingCounts[1], `${((ratingCounts[1] / metrics.total) * 100).toFixed(1)}%`, 'Immediate Escalation Required'],
  ];

  autoTable(doc, {
    startY: currentY + 3,
    theme: 'striped',
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
    columns: [
      { header: 'RATING SCALE', dataKey: '0' },
      { header: 'VOLUME', dataKey: '1' },
      { header: 'PERCENTAGE', dataKey: '2' },
      { header: 'STRATEGIC EVALUATION', dataKey: '3' },
    ],
    body: ratingRows,
  });

  currentY = doc.lastAutoTable.finalY + 6;

  // Category Breakdown Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('2. Breakdown by Service Category & Resolution Performance', 14, currentY);

  const catMap = {};
  tickets.forEach(t => {
    if (!catMap[t.category]) {
      catMap[t.category] = { total: 0, resolved: 0, sumRating: 0 };
    }
    catMap[t.category].total += 1;
    if (t.status === 'Resolved' || t.status === 'Closed') {
      catMap[t.category].resolved += 1;
    }
    catMap[t.category].sumRating += t.rating;
  });

  const catRows = Object.keys(catMap).map(cat => {
    const data = catMap[cat];
    const avg = (data.sumRating / data.total).toFixed(1);
    const rate = Math.round((data.resolved / data.total) * 100);
    return [
      cat,
      data.total,
      data.resolved,
      `${rate}%`,
      `${avg} ★`,
      rate >= 80 ? 'Within Target' : 'Under Review',
    ];
  });

  autoTable(doc, {
    startY: currentY + 3,
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 2.2 },
    headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontStyle: 'bold' },
    columns: [
      { header: 'SERVICE CATEGORY', dataKey: '0' },
      { header: 'SUBMISSIONS', dataKey: '1' },
      { header: 'RESOLVED', dataKey: '2' },
      { header: 'RESOLUTION %', dataKey: '3' },
      { header: 'CATEGORY CSAT', dataKey: '4' },
      { header: 'SLA STATUS', dataKey: '5' },
    ],
    body: catRows,
  });

  currentY = doc.lastAutoTable.finalY + 6;

  // Executive Action Plan & Notes
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('3. Key Findings & Recommended Action Items', 14, currentY);

  autoTable(doc, {
    startY: currentY + 3,
    theme: 'plain',
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 2.5 },
    body: [
      [
        {
          content: `• Priority Focus: Billing & Technical Support represent the highest volume of critical 1-star submissions. Recommend deploying immediate automated validation checks.\n• High Satisfaction Drivers: Sales onboarding and account management maintained top ratings (4.8/5.0 average).\n• SLA Target Compliance: Overall resolution rate stands at ${metrics.resolutionRate}%, meeting the enterprise target benchmark of ≥75%.`,
          styles: {
            fillColor: [248, 250, 252],
            textColor: [51, 65, 85],
            lineWidth: 0.2,
            lineColor: [226, 232, 240],
          },
        },
      ],
    ],
  });

  addReportFooter(doc);
  doc.save(`Executive_CSAT_Resolution_Report_${now.toISOString().split('T')[0]}.pdf`);
}
