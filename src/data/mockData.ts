export interface KioskDevice {
  id: string;
  name: string;
  location: string;
  status: 'online' | 'offline' | 'idle';
  lastActive: string;
  health: {
    camera: 'good' | 'warning' | 'error';
    printerInk: number;
    storage: number;
  };
}

export interface Template {
  id: string;
  thumbnail: string;
  name: string;
  category: string;
  status: 'active' | 'inactive' | 'draft';
  usageCount: number;
  dateRange: string;
}

export interface Session {
  id: string;
  date: string;
  template: string;
  photosCount: number;
  paymentStatus: 'paid' | 'unpaid' | 'pending';
  amount: number;
}

export const MOCK_KIOSKS: KioskDevice[] = [
  {
    id: 'K-001',
    name: 'Kiosk Alpha',
    location: 'Grand Indonesia Mall',
    status: 'online',
    lastActive: 'Just now',
    health: { camera: 'good', printerInk: 85, storage: 45 }
  },
  {
    id: 'K-002',
    name: 'Kiosk Beta',
    location: 'Senayan City',
    status: 'idle',
    lastActive: '35 mins ago',
    health: { camera: 'good', printerInk: 12, storage: 80 }
  },
  {
    id: 'K-003',
    name: 'Kiosk Gamma',
    location: 'Pondok Indah Mall',
    status: 'offline',
    lastActive: '2 hours ago',
    health: { camera: 'error', printerInk: 0, storage: 95 }
  }
];

export const MOCK_TEMPLATES: Template[] = [
  { id: 'T-1', thumbnail: 'https://picsum.photos/seed/bday/200/300', name: 'Birthday Bash', category: 'Birthday', status: 'active', usageCount: 1240, dateRange: 'Always' },
  { id: 'T-2', thumbnail: 'https://picsum.photos/seed/wedding/200/300', name: 'Elegant Wedding', category: 'Wedding', status: 'active', usageCount: 850, dateRange: 'Always' },
  { id: 'T-3', thumbnail: 'https://picsum.photos/seed/grad/200/300', name: 'Class of 2026', category: 'Graduation', status: 'active', usageCount: 2100, dateRange: 'Mar - Jun' },
  { id: 'T-4', thumbnail: 'https://picsum.photos/seed/xmas/200/300', name: 'Winter Wonderland', category: 'Holiday', status: 'inactive', usageCount: 500, dateRange: 'Dec 20 - Jan 5' },
];

export const MOCK_SESSIONS: Session[] = [
  { id: 'S-9821', date: '2026-03-30 14:20', template: 'Birthday Bash', photosCount: 4, paymentStatus: 'paid', amount: 50000 },
  { id: 'S-9820', date: '2026-03-30 14:15', template: 'Elegant Wedding', photosCount: 3, paymentStatus: 'paid', amount: 75000 },
  { id: 'S-9819', date: '2026-03-30 13:50', template: 'Birthday Bash', photosCount: 4, paymentStatus: 'paid', amount: 50000 },
  { id: 'S-9818', date: '2026-03-30 13:45', template: 'Class of 2026', photosCount: 6, paymentStatus: 'pending', amount: 100000 },
];

export const REVENUE_DATA = [
  { name: 'Mon', value: 450000 },
  { name: 'Tue', value: 520000 },
  { name: 'Wed', value: 480000 },
  { name: 'Thu', value: 610000 },
  { name: 'Fri', value: 850000 },
  { name: 'Sat', value: 1200000 },
  { name: 'Sun', value: 1100000 },
];

export const TEMPLATE_USAGE_DATA = [
  { name: 'Birthday', value: 45 },
  { name: 'Wedding', value: 25 },
  { name: 'Graduation', value: 20 },
  { name: 'Corporate', value: 10 },
];
