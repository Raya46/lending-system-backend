export function standardizeProdiName(className) {
  const mapping = {
    "BM 2A": "BM2A",
    "BM 2B": "BM2B",
    "BM-4A": "BM4A",
    "BM-4B": "BM4B",
    "BM-6A": "BM6A",
    "BM-6B": "BM6B",
    "BM-8A": "BM8A",
    "BM-8B": "BM8B",
  };
  return mapping[className] || className.replace(/\s+/g, "");
}

export async function extractAcademicYear(nim) {
  if (!nim || nim.length < 2) return null;
  const yearPrefix = nim.substring(0, 2);
  const currentYear = new Date().getFullYear();
  const currentCentury = Math.floor(currentYear / 100) * 100;

  // convert 2-digit year to 4-digit year
  let academicYear = currentCentury + parseInt(yearPrefix);

  if (academicYear > currentYear) {
    academicYear -= 100;
  }
  return `${academicYear}/${academicYear + 1}`;
}
