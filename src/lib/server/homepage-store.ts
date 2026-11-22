// ==============================================================================
// InfiniCharm — Server-Side Homepage Sections Authority (CMS)
// Governing Invariants: Single Source of Truth, Instant Enablement & Reorder
// ==============================================================================

import fs from 'fs';
import path from 'path';
import type { HomepageSection } from '../../types/index.ts';

function getHomepageFilePath(): string {
  const primaryPath = path.join(process.cwd(), 'src', 'data', 'homepage_sections.json');
  if (fs.existsSync(primaryPath)) {
    return primaryPath;
  }
  const altPath = path.join(process.cwd(), 'data', 'homepage_sections.json');
  if (fs.existsSync(altPath)) {
    return altPath;
  }
  return primaryPath;
}

export function getHomepageSections(onlyEnabled = false): HomepageSection[] {
  try {
    const filePath = getHomepageFilePath();
    if (!fs.existsSync(filePath)) {
      return [];
    }

    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed: HomepageSection[] = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    const sorted = [...parsed].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

    if (onlyEnabled) {
      return sorted.filter((s) => s.isEnabled);
    }

    return sorted;
  } catch (error) {
    console.error('Error reading homepage sections file:', error);
    return [];
  }
}

export function getHomepageSectionById(id: string): HomepageSection | null {
  const sections = getHomepageSections();
  return sections.find((s) => s.id === id) || null;
}

function writeHomepageSectionsToFile(sections: HomepageSection[]): boolean {
  try {
    const filePath = getHomepageFilePath();
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(sections, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('Error writing homepage sections file:', error);
    return false;
  }
}

export function updateHomepageSection(
  id: string,
  updates: Partial<HomepageSection>
): { success: boolean; section?: HomepageSection; error?: string } {
  try {
    const sections = getHomepageSections();
    const idx = sections.findIndex((s) => s.id === id);

    if (idx < 0) {
      return { success: false, error: `Section with ID "${id}" not found.` };
    }

    const updated: HomepageSection = {
      ...sections[idx],
      ...updates,
      id, // protect ID
      updatedAt: new Date().toISOString(),
    };

    sections[idx] = updated;
    writeHomepageSectionsToFile(sections);

    return { success: true, section: updated };
  } catch (error: any) {
    console.error('Failed to update homepage section:', error);
    return { success: false, error: error.message || 'Failed to update section' };
  }
}

export function toggleHomepageSection(
  id: string,
  isEnabled?: boolean
): { success: boolean; section?: HomepageSection; error?: string } {
  const sections = getHomepageSections();
  const existing = sections.find((s) => s.id === id);
  if (!existing) {
    return { success: false, error: `Section "${id}" not found.` };
  }

  const nextState = isEnabled !== undefined ? isEnabled : !existing.isEnabled;
  return updateHomepageSection(id, { isEnabled: nextState });
}

export function reorderHomepageSections(
  orderedIds: string[]
): { success: boolean; sections?: HomepageSection[]; error?: string } {
  try {
    const sections = getHomepageSections();
    const sectionMap = new Map<string, HomepageSection>();
    sections.forEach((s) => sectionMap.set(s.id, s));

    const reordered: HomepageSection[] = [];
    orderedIds.forEach((id, index) => {
      const section = sectionMap.get(id);
      if (section) {
        reordered.push({
          ...section,
          displayOrder: index + 1,
          updatedAt: new Date().toISOString(),
        });
        sectionMap.delete(id);
      }
    });

    // Append any leftover sections
    let currentOrder = reordered.length + 1;
    sectionMap.forEach((section) => {
      reordered.push({
        ...section,
        displayOrder: currentOrder++,
      });
    });

    writeHomepageSectionsToFile(reordered);
    return { success: true, sections: reordered };
  } catch (error: any) {
    console.error('Failed to reorder homepage sections:', error);
    return { success: false, error: error.message || 'Failed to reorder sections' };
  }
}

export function createHomepageSection(
  sectionData: Omit<HomepageSection, 'id' | 'displayOrder' | 'updatedAt'> & {
    id?: string;
    displayOrder?: number;
  }
): { success: boolean; section?: HomepageSection; error?: string } {
  try {
    const sections = getHomepageSections();
    const id = sectionData.id || `sec-${Date.now()}`;
    const displayOrder = sectionData.displayOrder || sections.length + 1;

    const newSection: HomepageSection = {
      ...sectionData,
      id,
      displayOrder,
      updatedAt: new Date().toISOString(),
    };

    sections.push(newSection);
    writeHomepageSectionsToFile(sections);

    return { success: true, section: newSection };
  } catch (error: any) {
    console.error('Failed to create homepage section:', error);
    return { success: false, error: error.message || 'Failed to create section' };
  }
}

export function deleteHomepageSection(id: string): { success: boolean; error?: string } {
  try {
    const sections = getHomepageSections();
    const filtered = sections.filter((s) => s.id !== id);

    if (filtered.length === sections.length) {
      return { success: false, error: `Section with ID "${id}" not found.` };
    }

    // Re-index remaining displayOrders
    const reindexed = filtered.map((s, idx) => ({
      ...s,
      displayOrder: idx + 1,
    }));

    writeHomepageSectionsToFile(reindexed);
    return { success: true };
  } catch (error: any) {
    console.error('Failed to delete homepage section:', error);
    return { success: false, error: error.message || 'Failed to delete section' };
  }
}

