import xlsx from "xlsx";

// mengubah value cell menjadi uppercase
const getSafeString = (cell) => {
  if (typeof cell === "string") {
    return cell.toUpperCase();
  }
  return ""; // Return empty string kalo bukan string
};

const getRawData = (worksheet) => {
  // kalo worksheet gk ada, return array kosong
  if (!worksheet) {
    return [];
  }
  //merubah worksheet menjadi JSON bentuk array of arrays
  return xlsx.utils.sheet_to_json(worksheet, { header: 1 });
};

// Function untuk mendeteksi excel file berdasarkan formatnya
function detectFileType(workbook, templateType = null) {
  if (templateType) {
    switch (templateType.toUpperCase()) {
      case "BMM":
        return "bmm";
      case "TL":
        return "tl";
      case "TOLI":
        return "toli";
      default:
        break;
    }
  }

  // auto detection based on file structure
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!firstSheet) {
    return "bmm";
  }

  const rawData = getRawData(firstSheet);

  // check for toli (has "kompen toli" in sheet names)
  const hasToliSheets = workbook.SheetNames.some(
    (name) =>
      getSafeString(name).includes("KOMPEN") &&
      getSafeString(name).includes("TOLI")
  );
  if (hasToliSheets) {
    return "toli";
  }
  for (const row of rawData) {
    const isHeader = row.some((cell) => getSafeString(cell).includes("NIM"));

    if (isHeader) {
      const nameColumnCount = row.filter((cell) =>
        getSafeString(cell).startsWith("NAMA")
      ).length;

      if (nameColumnCount > 1) {
        return "tl";
      }

      const hasYearPattern = row.some((cell) => {
        const cellStr = getSafeString(cell);
        return cellStr.includes("MAHASISWA") && /\{2}\s*[A-D]/.test(cellStr);
      });

      if (hasYearPattern) {
        return "tl";
      }

      break;
    }
  }
}

function parseBMM(workbook) {
  let allStudents = [];

  const processedNims = new Set();

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const rawData = getRawData(worksheet);

    let currentHeaderLayout = null;

    for (const row of rawData) {
      const nimIndex = row.findIndex(
        (cell) => getSafeString(cell).replace(/\s/g, "") === "NIM"
      );

      if (nimIndex !== -1) {
        const nameIndex = row.findIndex((cell) =>
          getSafeString(cell).includes("NAMA")
        );
        currentHeaderLayout = { nimIndex, nameIndex };
        continue;
      }

      if (currentHeaderLayout) {
        const nim = row[currentHeaderLayout.nimIndex];
        const name = row[currentHeaderLayout.nameIndex];

        if (
          nim &&
          !isNaN(nim) &&
          typeof name === "string" &&
          name.trim() !== ""
        ) {
          const nimPembanding = String(nim);

          if (!processedNims.has(nimPembanding)) {
            allStudents.push({
              nim: nimPembanding,
              name: name,
              class_group: sheetName,
            });
            processedNims.add(nimPembanding);
          }
        }
      }
    }
  }

  return allStudents;
}

function parsePerSheet(workbook) {
  return parseBMM(workbook);
}

function parseTL(workbook) {
  let allStudents = [];
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const rawData = getRawData(worksheet);

  let currentClassBlocks = [];
  for (const row of rawData) {
    const isHeader = row.some((cell) => getSafeString(cell).includes("NIM"));
    if (isHeader) {
      currentClassBlocks = [];
      row.forEach((cell, cellIndex) => {
        if (getSafeString(cell).startsWith("NAMA")) {
          currentClassBlocks.push({
            nimIndex: cellIndex - 1,
            nameIndex: cellIndex,
            header: cell,
          });
        }
      });
      continue;
    }
    if (currentClassBlocks.length > 0) {
      for (const block of currentClassBlocks) {
        const nim = row[block.nimIndex];
        const name = row[block.nameIndex];
        if (
          nim &&
          !isNaN(nim) &&
          typeof name === "string" &&
          name.trim() !== ""
        ) {
          // regex untuk mengambil ID class group dari NAMA MAHASISWA
          const classMatch = block.header.match(/NAMA MAHASISWA\s+(.*)$/i);
          // buat tau isinya
          // console.log(`[DEBUG] Class match for header "${block.header}":`, classMatch);
          let classGroup = "Unknown";
          if (classMatch && classMatch[1]) {
            const classInfo = classMatch[1].trim();
            const yearClassMatch = classInfo.match(/(\d{2})\s*([A-D])/i);
            if (yearClassMatch) {
              const year = yearClassMatch[1];
              const classLetter = yearClassMatch[2].toUpperCase();
              classGroup = `TL${year}${classLetter}`;
            } else {
              classGroup = classInfo.replace(/\s+/g, "").toUpperCase();
            }
          }
          allStudents.push({ nim: String(nim), name, class_group: classGroup });
        }
      }
    }
  }
  return allStudents;
}

// Function untuk parsing file excel dengan format per kolom
function parsePerColumn(workbook) {
  return parseTL(workbook);
}

function parseTOLI(workbook) {
  let allStudents = [];
  const processedNims = new Set();

  const studentSheets = workbook.SheetNames.filter((sheetName) => {
    const upperName = getSafeString(sheetName);
    return (
      upperName.includes("KOMPEN") &&
      upperName.includes("TOLI") &&
      (upperName.includes("1A") ||
        upperName.includes("1B") ||
        upperName.includes("3B") ||
        upperName.includes("5A") ||
        upperName.includes("5B"))
    );
  });

  for (const sheetName of studentSheets) {
    const worksheet = workbook.Sheets[sheetName];
    const rawData = getRawData(worksheet);

    let currentHeaderLayout = null;

    for (const row of rawData) {
      const nimIndex = row.findIndex(
        (cell) => getSafeString(cell).replace(/\s/g, "") === "NIM"
      );

      if (nimIndex !== -1) {
        const nameIndex = row.findIndex((cell) =>
          getSafeString(cell).includes("NAMA")
        );

        currentHeaderLayout = { nimIndex, nameIndex };
        continue;
      }

      if (currentHeaderLayout) {
        const nim = row[currentHeaderLayout.nimIndex];
        const name = row[currentHeaderLayout.nameIndex];

        if (
          nim &&
          !isNaN(nim) &&
          typeof name === "string" &&
          name.trim() !== ""
        ) {
          const nimPembanding = String(nim);

          if (!processedNims.has(nimPembanding)) {
            const classMatch = sheetName.match(/KOMPEN\s+(TOLI\s+\d+[AB])/i);
            const classGroup = classMatch ? classMatch[1] : sheetName;

            allStudents.push({
              nim: nimPembanding,
              name: name,
              class_group: classGroup,
            });

            processedNims.add(nimPembanding);
          }
        }
      }
    }
  }
  return allStudents;
}

function extractAkronim(fileName) {
  const upperName = fileName.toUpperCase();
  if (upperName.includes("TOLI")) return "TOLI";
  if (upperName.includes("TEKNIK LISTRIK")) return "TL";
  if (upperName.includes("BMM")) return "BMM";
  return "";
}

export {
  detectFileType,
  parsePerSheet,
  parsePerColumn,
  getSafeString,
  getRawData,
  extractAkronim,
  parseBMM,
  parseTL,
  parseTOLI,
};
