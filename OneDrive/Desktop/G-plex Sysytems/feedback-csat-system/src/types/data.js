export const SERVICE_CATEGORIES = [
  'Technical Support',
  'Billing & Payments',
  'Sales & Onboarding',
  'Product Quality',
  'Delivery & Logistics',
  'Customer Service',
];

export const TICKET_STATUSES = [
  { value: 'Open', label: 'Open', color: 'bg-rose-50 text-rose-700 border-rose-200' },
  { value: 'In Progress', label: 'In Progress', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { value: 'Resolved', label: 'Resolved', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { value: 'Closed', label: 'Closed', color: 'bg-slate-100 text-slate-700 border-slate-200' },
];

export const PRIORITY_LEVELS = [
  { value: 'Urgent', label: 'Urgent', badge: 'bg-red-100 text-red-800' },
  { value: 'High', label: 'High', badge: 'bg-orange-100 text-orange-800' },
  { value: 'Medium', label: 'Medium', badge: 'bg-blue-100 text-blue-800' },
  { value: 'Low', label: 'Low', badge: 'bg-slate-100 text-slate-800' },
];

export const DEPARTMENTS = [
  'Tier 2 Escalations',
  'Finance & Invoicing',
  'Product Engineering',
  'Logistics Operations',
  'Client Success',
  'Executive Office',
];

export const INITIAL_TICKETS = [
  {
    id: 'CMP-2026-1041',
    customerName: 'Sarah Jenkins',
    email: 'sarah.j@novasoft.io',
    phone: '+1 (555) 234-8901',
    category: 'Billing & Payments',
    rating: 1,
    priority: 'Urgent',
    incidentDate: '2026-10-11',
    createdAt: '2026-10-11T09:15:00Z',
    status: 'In Progress',
    assignedDept: 'Finance & Invoicing',
    assignedTo: 'Marcus Vance',
    title: 'Duplicate subscription charge on annual renewal',
    description: 'We were billed twice on our Mastercard for the annual Enterprise license ($4,800 x 2). Our accounting team flagged this immediately and our finance director is requesting a priority refund.',
    attachmentName: 'bank_statement_duplicate_charge.pdf',
    notes: [
      { id: 1, author: 'System', date: '2026-10-11T09:15:00Z', text: 'Ticket submitted via Public Portal.' },
      { id: 2, author: 'Marcus Vance', date: '2026-10-11T11:30:00Z', text: 'Reviewed Stripe logs. Confirmed duplicate token transaction. Void transaction initiated; refund receipt attached.' },
    ],
    resolutionDate: null,
    resolutionNotes: null,
  },
  {
    id: 'CMP-2026-1042',
    customerName: 'David K. Ochieng',
    email: 'david.ochieng@safariagri.com',
    phone: '+254 712 345 678',
    category: 'Technical Support',
    rating: 2,
    priority: 'High',
    incidentDate: '2026-10-12',
    createdAt: '2026-10-12T14:20:00Z',
    status: 'In Progress',
    assignedDept: 'Tier 2 Escalations',
    assignedTo: 'Jane Mutua',
    title: 'CSV export failing on reports dashboard with error 504',
    description: 'Every time we attempt to download our monthly operational audit CSV with more than 5,000 records, the request times out after 60 seconds with an HTTP 504 Gateway error. This blocks our month-end audit.',
    attachmentName: 'screenshot_error_504.png',
    notes: [
      { id: 1, author: 'System', date: '2026-10-12T14:20:00Z', text: 'Ticket submitted via Public Portal.' },
      { id: 2, author: 'Jane Mutua', date: '2026-10-13T08:45:00Z', text: 'Identified unindexed query in reports endpoint. Engineering deployed patch in staging.' },
    ],
    resolutionDate: null,
    resolutionNotes: null,
  },
  {
    id: 'CMP-2026-1043',
    customerName: 'Elena Rostova',
    email: 'erostova@helsinkilogistics.fi',
    phone: '+358 40 123 4567',
    category: 'Delivery & Logistics',
    rating: 2,
    priority: 'High',
    incidentDate: '2026-10-09',
    createdAt: '2026-10-09T16:00:00Z',
    status: 'Resolved',
    assignedDept: 'Logistics Operations',
    assignedTo: 'Kari Lindholm',
    title: 'Shipment delayed by 4 business days without customs dispatch tracking',
    description: 'The agricultural sensor hardware consignment arrived 4 days past the guaranteed delivery window. Customs notification was never forwarded to our receiving warehouse.',
    attachmentName: 'airway_bill_tracking.pdf',
    notes: [
      { id: 1, author: 'System', date: '2026-10-09T16:00:00Z', text: 'Ticket submitted via Public Portal.' },
      { id: 2, author: 'Kari Lindholm', date: '2026-10-10T10:15:00Z', text: 'Contacted carrier DHL Freight. Cleared customs delay and arranged expedited courier to site.' },
    ],
    resolutionDate: '2026-10-11T13:30:00Z',
    resolutionNotes: 'Consignment successfully delivered to client warehouse. Issued a $250 shipping credit voucher on account.',
  },
  {
    id: 'CMP-2026-1044',
    customerName: 'Michael Chang',
    email: 'm.chang@apexhorizon.com',
    phone: '+1 (415) 890-3412',
    category: 'Product Quality',
    rating: 3,
    priority: 'Medium',
    incidentDate: '2026-10-08',
    createdAt: '2026-10-08T11:10:00Z',
    status: 'Resolved',
    assignedDept: 'Product Engineering',
    assignedTo: 'Alex Rivera',
    title: 'Mobile app navigation bar overlaps notch on iOS 18',
    description: 'When running the dashboard on iPhone 16 Pro Max, the top navigation buttons get partially clipped by the dynamic island. Functional but degrades user experience.',
    attachmentName: 'notch_clipping.jpg',
    notes: [
      { id: 1, author: 'System', date: '2026-10-08T11:10:00Z', text: 'Ticket submitted via Public Portal.' },
      { id: 2, author: 'Alex Rivera', date: '2026-10-09T09:20:00Z', text: 'CSS safe-area-inset-top padding adjusted in v2.4.1.' },
    ],
    resolutionDate: '2026-10-10T15:00:00Z',
    resolutionNotes: 'Fixed in mobile release v2.4.1. Customer confirmed resolution.',
  },
  {
    id: 'CMP-2026-1045',
    customerName: 'Grace Wambui',
    email: 'grace.w@centralgrowers.co.ke',
    phone: '+254 722 998 877',
    category: 'Customer Service',
    rating: 4,
    priority: 'Low',
    incidentDate: '2026-10-13',
    createdAt: '2026-10-13T10:00:00Z',
    status: 'Resolved',
    assignedDept: 'Client Success',
    assignedTo: 'Samson Kariuki',
    title: 'Request for additional user training session on seed quality module',
    description: 'Our team onboarded 4 new field inspectors who need a dedicated 45-minute walkthrough of the lot certification and germination testing workflows.',
    attachmentName: null,
    notes: [
      { id: 1, author: 'System', date: '2026-10-13T10:00:00Z', text: 'Feedback submitted via Public Portal.' },
      { id: 2, author: 'Samson Kariuki', date: '2026-10-13T12:00:00Z', text: 'Scheduled Zoom onboarding session for Thursday at 2:00 PM EAT.' },
    ],
    resolutionDate: '2026-10-14T16:00:00Z',
    resolutionNotes: 'Conducted walkthrough session and shared recorded training video and PDF user guide.',
  },
  {
    id: 'CMP-2026-1046',
    customerName: 'Robert Sterling',
    email: 'rsterling@sterlingholdings.co.uk',
    phone: '+44 20 7946 0912',
    category: 'Sales & Onboarding',
    rating: 5,
    priority: 'Low',
    incidentDate: '2026-10-14',
    createdAt: '2026-10-14T08:30:00Z',
    status: 'Closed',
    assignedDept: 'Client Success',
    assignedTo: 'Chloe Bennett',
    title: 'Outstanding onboarding experience and prompt contract turnaround',
    description: 'We wanted to commend Chloe and the enterprise sales engineering team. Contract review, security questionnaire, and initial sandbox setup were completed in under 48 hours.',
    attachmentName: null,
    notes: [
      { id: 1, author: 'System', date: '2026-10-14T08:30:00Z', text: 'Commendation submitted via Public Portal.' },
      { id: 2, author: 'Chloe Bennett', date: '2026-10-14T09:10:00Z', text: 'Sent formal thank you note to client and forwarded review to VP of Operations.' },
    ],
    resolutionDate: '2026-10-14T10:00:00Z',
    resolutionNotes: 'Acknowledged and logged as positive benchmark in monthly CSAT showcase.',
  },
  {
    id: 'CMP-2026-1047',
    customerName: 'Ananya Patel',
    email: 'ananya.p@zenithanalytics.in',
    phone: '+91 98765 43210',
    category: 'Technical Support',
    rating: 1,
    priority: 'Urgent',
    incidentDate: '2026-10-15',
    createdAt: '2026-10-15T07:45:00Z',
    status: 'Open',
    assignedDept: 'Tier 2 Escalations',
    assignedTo: 'Marcus Vance',
    title: 'API Webhook signatures failing validation intermittently',
    description: 'Our automated ingestion pipeline rejected 142 events over the last 6 hours because HMAC-SHA256 signatures produced by the dispatch worker failed header verification. Critical data sync disruption.',
    attachmentName: 'failed_headers_payload.json',
    notes: [
      { id: 1, author: 'System', date: '2026-10-15T07:45:00Z', text: 'Ticket submitted via Public Portal.' },
    ],
    resolutionDate: null,
    resolutionNotes: null,
  },
  {
    id: 'CMP-2026-1048',
    customerName: 'Jean-Luc Dubois',
    email: 'jldubois@vignobles-provence.fr',
    phone: '+33 4 91 12 34 56',
    category: 'Product Quality',
    rating: 4,
    priority: 'Medium',
    incidentDate: '2026-10-12',
    createdAt: '2026-10-12T13:00:00Z',
    status: 'Resolved',
    assignedDept: 'Product Engineering',
    assignedTo: 'Alex Rivera',
    title: 'Feature request for multi-currency automated exchange rate lookup',
    description: 'The invoicing module handles Euros and KES well, but would save significant manual time if daily European Central Bank rates were fetched automatically at midnight.',
    attachmentName: null,
    notes: [
      { id: 1, author: 'System', date: '2026-10-12T13:00:00Z', text: 'Feedback submitted via Public Portal.' },
      { id: 2, author: 'Alex Rivera', date: '2026-10-13T11:00:00Z', text: 'Added to Q4 product roadmap. Shared beta test invitation with client.' },
    ],
    resolutionDate: '2026-10-13T14:30:00Z',
    resolutionNotes: 'Client enrolled in early beta testing channel for ECB auto-feed.',
  },
  {
    id: 'CMP-2026-1049',
    customerName: 'Carlos Mendoza',
    email: 'carlos.m@agrotropical.cr',
    phone: '+506 2234 5678',
    category: 'Billing & Payments',
    rating: 2,
    priority: 'High',
    incidentDate: '2026-10-14',
    createdAt: '2026-10-14T11:45:00Z',
    status: 'Open',
    assignedDept: 'Finance & Invoicing',
    assignedTo: 'Jane Mutua',
    title: 'VAT withholding tax deduction not reflected on credit note',
    description: 'We submitted tax certificate withholding #CR-90412 for 2% WHT. The credit note issued last Friday only reflected the subtotal and did not adjust the statutory withholding line.',
    attachmentName: 'withholding_cert_2026.pdf',
    notes: [
      { id: 1, author: 'System', date: '2026-10-14T11:45:00Z', text: 'Ticket submitted via Public Portal.' },
    ],
    resolutionDate: null,
    resolutionNotes: null,
  },
  {
    id: 'CMP-2026-1050',
    customerName: 'Fatima Al-Mansoor',
    email: 'fatima@almansoor-trade.ae',
    phone: '+971 4 234 5678',
    category: 'Sales & Onboarding',
    rating: 5,
    priority: 'Low',
    incidentDate: '2026-10-15',
    createdAt: '2026-10-15T09:30:00Z',
    status: 'Closed',
    assignedDept: 'Client Success',
    assignedTo: 'Chloe Bennett',
    title: 'Exceptional response speed and multi-warehouse setup support',
    description: 'The team helped us configure 6 regional distribution warehouses in under an hour. Very intuitive software and very competent support staff.',
    attachmentName: null,
    notes: [
      { id: 1, author: 'System', date: '2026-10-15T09:30:00Z', text: 'Commendation submitted via Public Portal.' },
    ],
    resolutionDate: '2026-10-15T11:00:00Z',
    resolutionNotes: 'Logged and acknowledged. Customer satisfaction score: 100%.',
  },
];

const STORAGE_KEY = 'servicepulse_csat_tickets_v1';

export function getStoredTickets() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_TICKETS));
      return INITIAL_TICKETS;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to read localStorage:', err);
    return INITIAL_TICKETS;
  }
}

export function saveTickets(tickets) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets));
  } catch (err) {
    console.error('Failed to write localStorage:', err);
  }
}

export function generateTicketId(existingTickets) {
  const year = new Date().getFullYear();
  const maxNum = existingTickets.reduce((max, t) => {
    const match = t.id.match(/CMP-\d+-(\d+)/);
    if (match) {
      const num = parseInt(match[1], 10);
      return num > max ? num : max;
    }
    return max;
  }, 1050);
  return `CMP-${year}-${maxNum + 1}`;
}
