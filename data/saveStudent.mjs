import pool from "./db_setting.mjs"; // Make sure this path to your db.mjs file is correct

/*
    Saves an array of student objects to the database.
    Inserts new students and updates existing ones based on their NIM.
    @param {Array<Object>} students - An array of student objects, e.g., [{ nim, name, class_group }]
    @returns {Promise<Object>} An object with the count of inserted and updated rows.
*/

async function saveStudentsToDB(students) {
    // If the student list is empty, do nothing.
    if (!students || students.length === 0) {
        console.log("No student data to save.");
        return { inserted: 0, updated: 0 };
    }

    // 1. Format the data for the SQL query.
    // Converts [{nim, name, class}, ...] into [[nim, name, class], ...]
    const values = students.map((student) => [
        student.nim,
        student.name,
        student.class_group,
    ]);

    // 2. The SQL query with placeholders.
    // This single command handles both inserting and updating.
    const sql = `
    INSERT INTO mahasiswa (nim, nama_mahasiswa, nama_prodi) 
    VALUES ? 
    ON DUPLICATE KEY UPDATE 
    nama_mahasiswa = VALUES(nama_mahasiswa), 
    nama_prodi = VALUES(nama_prodi)`;

    let connection;
    try {
        // 3. Get a connection from the pool and run the query.
        connection = await pool.getConnection();
        const [result] = await connection.query(sql, [values]);

        console.log("Database operation result:", result);
        // Return a summary of the database operation.
        return {
            inserted:
                result.affectedRows > result.warnings
                    ? result.affectedRows - result.warnings
                    : 0,
            updated: result.warnings,
        };
    } catch (error) {
        console.error("Error saving students to database:", error);
        throw error; // Pass the error up to be handled by the route's catch block
    } finally {
        // 4. Always release the connection back to the pool.
        if (connection) connection.release();
    }
}

export default saveStudentsToDB;
