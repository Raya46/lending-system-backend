import pool from "../data/db_setting.js";

function standardizeProdiName(className) {
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
  return mapping[className] || className;
}

async function saveStudentsToDB(students) {
  if (!students || students.length === 0) {
    console.log("No student data to save.");
    return { inserted: 0, updated: 0 };
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // 1. Get unique program studies from students - STANDARDIZED ONES
    const uniqueProdi = [
      ...new Set(
        students.map((student) => standardizeProdiName(student.class_group))
      ),
    ];
    console.log("Unique program studies found (standardized):", uniqueProdi);

    // 2. Check which ones exist in the prodi table
    const existingProdiQuery = `SELECT nama_prodi FROM prodi WHERE nama_prodi IN (${uniqueProdi
      .map(() => "?")
      .join(",")})`;
    const [existingProdi] = await connection.query(
      existingProdiQuery,
      uniqueProdi
    );
    const existingProdiNames = existingProdi.map((row) => row.nama_prodi);

    console.log("Existing program studies in database:", existingProdiNames);

    // 3. Find missing program studies
    const missingProdi = uniqueProdi.filter(
      (prodi) => !existingProdiNames.includes(prodi)
    );

    if (missingProdi.length > 0) {
      console.log(
        "Missing program studies that will be created:",
        missingProdi
      );

      // 4. Insert missing program studies
      const insertProdiValues = missingProdi.map((prodi) => [prodi]);
      const insertProdiSql = `INSERT INTO prodi (nama_prodi) VALUES ?`;
      await connection.query(insertProdiSql, [insertProdiValues]);
      console.log(`✅ Created ${missingProdi.length} new program studies`);
    }

    // 5. Now insert students with standardized prodi names
    const values = students.map((student) => [
      student.nim,
      student.name,
      standardizeProdiName(student.class_group), // Apply standardization
    ]);

    const sql = `
        INSERT INTO mahasiswa (nim, nama_mahasiswa, nama_prodi) 
        VALUES ? 
        ON DUPLICATE KEY UPDATE 
        nama_mahasiswa = VALUES(nama_mahasiswa), 
        nama_prodi = VALUES(nama_prodi)`;

    const [result] = await connection.query(sql, [values]);

    await connection.commit();
    console.log("✅ Database operation completed successfully");

    return {
      inserted:
        result.affectedRows > result.changedRows
          ? result.affectedRows - result.changedRows
          : 0,
      updated: result.changedRows,
      newProdiCreated: missingProdi.length,
    };
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error("Error saving students to database:", error);
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

export default saveStudentsToDB;
