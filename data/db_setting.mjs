import mysql from 'mysql2/promise';

// We use '/promise' to use async/await syntax

// Create a connection 'pool'. A pool is more efficient than a single connection
// as it manages multiple connections that your app can reuse.

const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    pasword: '',
    database: 'lab_komputer',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// You can add a quick function to test the connection (optional but good practice)

async function testConnection() {
    try { 
        const connection = await pool.getConnection(); // Get a connection from the pool
        console.log("successfully connected to the database");
        connection.release(); // Release the connection back to the pool
    }
    catch (error){
        console.error("Error connecting to the database:", error);
    }
};

//testing the connection
testConnection();
// Export the pool for use in other parts of your application
export default pool;