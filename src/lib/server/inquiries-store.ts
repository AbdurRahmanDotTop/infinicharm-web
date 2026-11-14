import fs from 'fs';
import path from 'path';
import type { CustomerInquiry } from '../../types/index.ts';

const INQUIRIES_FILE_PATH = path.join(process.cwd(), 'src', 'data', 'inquiries.json');

function ensureFile(filePath: string = INQUIRIES_FILE_PATH): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, '[]\n', 'utf8');
  }
}

function writeAtomic(filePath: string, data: CustomerInquiry[]): void {
  ensureFile(filePath);
  const tmp = `${filePath}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, filePath);
}

export function listInquiries(filePath: string = INQUIRIES_FILE_PATH): CustomerInquiry[] {
  try {
    ensureFile(filePath);
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CustomerInquiry[]) : [];
  } catch {
    return [];
  }
}

export function getInquiryById(
  id: string,
  filePath: string = INQUIRIES_FILE_PATH
): CustomerInquiry | null {
  return listInquiries(filePath).find((i) => i.id === id) || null;
}

export function createInquiryRecord(
  input: {
    name: string;
    email: string;
    phone: string;
    subject: string;
    message: string;
    source?: string;
  },
  filePath: string = INQUIRIES_FILE_PATH
): CustomerInquiry {
  const all = listInquiries(filePath);
  const now = new Date().toISOString();
  const y = now.slice(0, 4);
  const m = now.slice(5, 7);
  const id = `INQ-${y}${m}-${Math.floor(1000 + Math.random() * 9000)}`;

  const created: CustomerInquiry = {
    id,
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    phone: input.phone.trim(),
    subject: input.subject.trim() || 'General Customer Inquiry',
    message: input.message.trim(),
    status: 'NEW',
    source: input.source?.trim() || 'contact_page',
    notificationStatus: 'PENDING',
    createdAt: now,
    updatedAt: now,
  };

  writeAtomic(filePath, [created, ...all]);
  return created;
}

export function updateInquiryRecord(
  id: string,
  updates: Partial<
    Pick<CustomerInquiry, 'status' | 'adminResponse' | 'notificationStatus'>
  >,
  filePath: string = INQUIRIES_FILE_PATH
): CustomerInquiry | null {
  const all = listInquiries(filePath);
  const idx = all.findIndex((i) => i.id === id);
  if (idx === -1) return null;

  const updated: CustomerInquiry = {
    ...all[idx],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  all[idx] = updated;
  writeAtomic(filePath, all);
  return updated;
}

export function deleteInquiryRecord(
  id: string,
  filePath: string = INQUIRIES_FILE_PATH
): boolean {
  const all = listInquiries(filePath);
  const next = all.filter((i) => i.id !== id);
  if (next.length === all.length) return false;
  writeAtomic(filePath, next);
  return true;
}

