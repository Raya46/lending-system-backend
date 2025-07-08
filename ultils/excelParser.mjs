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
function detectFileType(workbook) {
  // Defaultnya banyak sheet
  let detectedType = "perSheet";

  // We only need to check the first sheet to make a decision
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!firstSheet) {
    // If the workbook is empty, return the default
    return detectedType;
  }

  const rawData = getRawData(firstSheet);

  // Loop through the rows to find the first header
  for (const row of rawData) {
    const isHeader = row.some((cell) => getSafeString(cell).includes("NIM"));
    if (isHeader) {
      // untuk header ini. hitung column "NAMA".
      const nameColumnCount = row.filter((cell) =>
        getSafeString(cell).startsWith("NAMA")
      ).length;

      // kalau ada >=1 column "NAMA", maka ini format perColumn
      if (nameColumnCount > 1) {
        detectedType = "perColumn";
      }

      // setelah pengechekan header pertama, hentikann loop.
      break;
    }
  }
  // Return the final decision
  return detectedType;
}

function parsePerSheet(workbook) {
  let allStudents = [];
  // storing NIM yang sudah diproses supaya tidak duplikasi
  const processedNims = new Set();

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const rawData = getRawData(worksheet);

    // varibale untuk menyimpan layout header 
    let currentHeaderLayout = null;

    for (const row of rawData) {
      // Mengubah "N I M" jadi "NIM".
      const nimIndex = row.findIndex(
        (cell) => getSafeString(cell).replace(/\s/g, "") === "NIM"
      );

      if (nimIndex !== -1) {
        // update header layout jika menemukan header baru
        const nameIndex = row.findIndex((cell) =>
          getSafeString(cell).includes("NAMA")
        );
        currentHeaderLayout = { nimIndex, nameIndex };
        continue; // keluar dr if dan lanjut 
      }

      // kalo bukan header, process it sebagai data row
      if (currentHeaderLayout) {
        const nim = row[currentHeaderLayout.nimIndex];
        const name = row[currentHeaderLayout.nameIndex];

        if (
          nim &&!isNaN(nim) &&
          typeof name === "string" &&
          name.trim() !== ""
        ) {
          const nimPembanding = String(nim);

          // --- Duplicate Check ---
          // Jika NIM pada Set() belum ada, maka tambahkan ke allStudents
          if (!processedNims.has(nimPembanding)) {
            allStudents.push({
              nim: nimPembanding,
              name: name,
              class_group: sheetName,
            });
            //Masukin NIM ini ke Set() supaya next time gk usah di proses lg.
            processedNims.add(nimPembanding);
          }
        }
      }
    }
  }
  return allStudents;
}

// Function untuk parsing file excel dengan format per kolom
function parsePerColumn(workbook, prodi) {
  let allStudents = [];
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const rawData = getRawData(worksheet);


  let akronim = "";
  if (prodi) {
    akronim = prodi
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase();
  }

  let currentClassBlocks = [];
  for (const row of rawData) {
    const isHeader = row.some(
      //(cell) => typeof cell === "string" && cell.toUpperCase().includes("NIM")
      (cell) => getSafeString(cell).includes("NIM")
    );
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
            //hasil ID class group td, spasi dihapus dan diuppercase
            const partialId = classMatch[1].replace(/\s/g, "").toUpperCase();
            // jika akronim ada, gabungkan dengan partialId
            classGroup = `${akronim}${partialId}`;
          }
          allStudents.push({ nim: String(nim), name, class_group: classGroup });
        }
      }
    }
  }
  return allStudents;
}

export {
  detectFileType,
  parsePerSheet,
  parsePerColumn,
  getSafeString,
  getRawData,
};
