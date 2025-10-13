import pool from "../data/db_postgres.js";

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
    connection = await pool.connect();
    await connection.beginTransaction();

    // 1. Get unique program studies from students - STANDARDIZED ONES
    const uniqueProdi = [
      ...new Set(
        students.map((student) => standardizeProdiName(student.class_group))
      ),
    ];
    console.log("Unique program studies found (standardized):", uniqueProdi);

    // 2. Check which ones exist in the prodi table
    const placeholders = uniqueProdi
      .map((_, index) => `$${index + 1}`)
      .join(",");
    const existingProdiQuery = `SELECT nama_prodi FROM prodi WHERE nama_prodi IN (${placeholders})`;
    const existingProdiResult = await connection.query(
      existingProdiQuery,
      uniqueProdi
    );
    const existingProdiNames = existingProdiResult.rows.map(
      (row) => row.nama_prodi
    );

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

      // 4. Insert missing program studies one by one for PostgreSQL
      for (const prodi of missingProdi) {
        await connection.query("INSERT INTO prodi (nama_prodi) VALUES ($1)", [
          prodi,
        ]);
      }
      console.log(`✅ Created ${missingProdi.length} new program studies`);
    }

    // 5. Now insert students with standardized prodi names - one by one for PostgreSQL
    let insertedCount = 0;
    let updatedCount = 0;

    for (const student of students) {
      const standardizedProdi = standardizeProdiName(student.class_group);

      // Check if student exists
      const existingStudent = await connection.query(
        "SELECT nim FROM mahasiswa WHERE nim = $1",
        [student.nim]
      );

      if (existingStudent.rows.length === 0) {
        // Insert new student
        await connection.query(
          "INSERT INTO mahasiswa (nim, nama_mahasiswa, nama_prodi) VALUES ($1, $2, $3)",
          [student.nim, student.name, standardizedProdi]
        );
        insertedCount++;
      } else {
        // Update existing student
        await connection.query(
          "UPDATE mahasiswa SET nama_mahasiswa = $1, nama_prodi = $2 WHERE nim = $3",
          [student.name, standardizedProdi, student.nim]
        );
        updatedCount++;
      }
    }

    await connection.commit();
    console.log("✅ Database operation completed successfully");

    return {
      inserted: insertedCount,
      updated: updatedCount,
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
