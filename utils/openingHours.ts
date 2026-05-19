/**
 * Opening hours helpers.
 * Identical to the Expo app — pure TypeScript, no RN dependencies.
 */

function parseTimeToMinutes(timeStr: string): number | null {
  const match = timeStr.trim().match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return null;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const ampm = match[3].toUpperCase();
  if (ampm === 'PM' && hours !== 12) hours += 12;
  if (ampm === 'AM' && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

export function getRestaurantStatus(openingHours: string | null | undefined): {
  isOpen: boolean;
  opensAt: string;
} {
  if (!openingHours) return { isOpen: true, opensAt: '' };

  const parts = openingHours.split(/\s*[–—]\s*|\s+-\s+/);
  if (parts.length < 2) return { isOpen: true, opensAt: '' };

  const openMinutes = parseTimeToMinutes(parts[0]);
  const closeMinutes = parseTimeToMinutes(parts[1]);
  const opensAt = parts[0].trim();

  if (openMinutes == null || closeMinutes == null) return { isOpen: true, opensAt };

  const now = new Date();
  const current = now.getHours() * 60 + now.getMinutes();

  let isOpen: boolean;
  if (closeMinutes > openMinutes) {
    isOpen = current >= openMinutes && current < closeMinutes;
  } else {
    isOpen = current >= openMinutes || current < closeMinutes;
  }

  return { isOpen, opensAt };
}
