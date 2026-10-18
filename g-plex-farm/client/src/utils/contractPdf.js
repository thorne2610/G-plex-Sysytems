import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const kes = (n) => `KES ${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const kg = (n) => `${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })} kg`;
const BRAND = [21, 61, 45];

/** Season report for one contract: plan vs actual, deliveries, settlement and payments. */
export function generateContractReportPDF(c) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const w = doc.internal.pageSize.getWidth();
  doc.setFillColor(...BRAND); doc.rect(0, 0, w, 26, 'F');
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
  doc.text('G-Plex Farm ERP', 14, 12);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  doc.text('CONTRACT FARMING - SEASON REPORT', 14, 19);
  doc.text(`Generated ${new Date().toLocaleDateString()}`, w - 14, 12, { align: 'right' });
  doc.text(`REF ${c.contract_no}`, w - 14, 19, { align: 'right' });

  doc.setTextColor(15, 23, 42); doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
  doc.text(`${c.grower_name} - ${c.crop}${c.variety ? ` (${c.variety})` : ''}`, 14, 36);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(100, 116, 139);
  doc.text(`Farmer ${c.grower_code} - ${c.grower_location || 'location not recorded'} - Season ${c.season || 'n/a'} - Status ${String(c.status).toUpperCase()}`, 14, 42);

  const planned = Number(c.expected_yield_kg || 0);
  const actual = Number(c.accepted_kg || 0);
  autoTable(doc, {
    startY: 48, theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2.5 },
    headStyles: { fillColor: BRAND, textColor: [255, 255, 255] },
    head: [['MEASURE', 'PLANNED', 'ACTUAL']],
    body: [
      ['Acreage', `${c.contracted_acres} ac contracted`, c.verified_acres ? `${c.verified_acres} ac verified` : 'Not inspected'],
      ['Yield', kg(planned), `${kg(actual)} accepted${planned > 0 ? ` (${Math.round((actual / planned) * 100)}% of plan)` : ''}`],
      ['Yield per acre', c.verified_acres ? kg(planned / c.verified_acres) : '-', c.yield_per_acre_kg ? kg(c.yield_per_acre_kg) : '-'],
      ['Price per kg', kes(c.agreed_price_per_kg), '-'],
      ['Input budget vs issued', kes(c.input_budget), kes(c.inputs_value)],
    ],
  });

  let y = doc.lastAutoTable.finalY + 6;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(15, 23, 42);
  doc.text('Settlement', 14, y);
  const s = c.settlement;
  autoTable(doc, {
    startY: y + 3, theme: 'striped',
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2.5 },
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255] },
    head: [['ITEM', 'AMOUNT']],
    body: s ? [
      ['Value of produce accepted', kes(s.gross_value)],
      ['Less: input credit recovered', kes(s.input_recovery)],
      [`Less: other deductions${s.other_deductions_note ? ` (${s.other_deductions_note})` : ''}`, kes(s.other_deductions)],
      ['Net payable to farmer', kes(s.net_payable)],
      ['Paid so far', kes(c.paid)],
      ['Balance due', kes(c.balance_due)],
    ] : [['Not settled yet', '-']],
  });

  y = doc.lastAutoTable.finalY + 6;
  doc.setFont('helvetica', 'bold'); doc.text('Deliveries', 14, y);
  autoTable(doc, {
    startY: y + 3, theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255] },
    head: [['DATE', 'DELIVERED', 'REJECTED', 'GRADE', 'PRICE/KG', 'VALUE']],
    body: (c.deliveries || []).length
      ? c.deliveries.map((d) => [d.delivery_date, kg(d.quantity_kg), kg(d.rejected_kg), d.grade || '-', kes(d.price_per_kg), kes(d.gross_value)])
      : [['-', '-', '-', '-', '-', '-']],
  });

  y = doc.lastAutoTable.finalY + 6;
  if (y > 240) { doc.addPage(); y = 20; }
  doc.setFont('helvetica', 'bold'); doc.text('Field visits and inspections', 14, y);
  autoTable(doc, {
    startY: y + 3, theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255] },
    head: [['DATE', 'TYPE', 'OFFICER', 'ACRES', 'STAGE', 'FINDINGS']],
    body: (c.visits || []).length
      ? c.visits.map((v) => [v.visit_date, String(v.visit_type).replace('_', ' '), v.officer || '-', v.acres_verified ?? '-', v.crop_stage || '-', v.findings || '-'])
      : [['-', '-', '-', '-', '-', '-']],
    columnStyles: { 5: { cellWidth: 60 } },
  });

  const pages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i); doc.setFontSize(8); doc.setTextColor(148, 163, 184);
    doc.text('CONFIDENTIAL - FARMER CONTRACT RECORD', 14, 290);
    doc.text(`Page ${i} of ${pages}`, w - 14, 290, { align: 'right' });
  }
  doc.save(`${c.contract_no}_Season_Report.pdf`);
}
