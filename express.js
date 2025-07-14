//kode hasil convert ke express js
import express from 'express';
import userRoutes from './routes/users.mjs';
import aboutRoutes from './routes/about.mjs';
import cookieParser from 'cookie-parser';
import session, { Session } from 'express-session';
import { mockUsers } from './data/users.mjs';
import pool from './data/db_setting.mjs';
import studentRoutes from './routes/students.mjs';
import bcrypt from 'bcryptjs';

const app = express();
const port = 5000;
const host = 'localhost';

// Middleware untuk parsing body request (untuk method POST)
app.use(express.json());

// routing menggunakan middleware
app.use('/api/students', studentRoutes); 
app.use(cookieParser("rahasia"));
app.use(session({
  secret: 'secret',
  saveUninitialized: true,
  resave: false,
  cookie: {
    maxAge: 60000*60,
  },
}));
app.use('/api/users', userRoutes);
app.use('/about', aboutRoutes);


// Route untuk homepage (/)
app.get('/', (req, res) => {
  res.cookie('hello','world', {maxAge: 60000*60, signed: true});
  res.status(200).json({
    message: 'Ini adalah homepage!',
  });
});

// Route untuk homepage (/) untuk method selain GET
app.all('/', (req, res) => {
  res.status(400).json({
    message: `Halaman tidak dapat diakses dengan ${req.method} request`,
  });
});


// Route untuk authentication di login session
app.post('/api/auth', async (req, res) => {
  const { username, password, rememberMe } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required.' });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    
    // 1. Find the user in the database by their username
    const [rows] = await connection.query(
      'SELECT * FROM admin_users WHERE username = ?', 
      [username]
    );
    
    connection.release(); // Release the connection as soon as we're done with it

    const user = rows[0];

    // 2. Check if the user was found
    if (!user) {
      return res.status(401).json({ message: 'Incorrect username or password.' });
    }

    // 3. Compare the provided password with the stored hash
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      // Passwords do not match
      return res.status(401).json({ message: 'Incorrect username or password.' });
    }

    // 4. If passwords match, create the session
    // We create a user object for the session, omitting the password hash
    const sessionUser = {
      admin_id: user.admin_id,
      username: user.username,
      full_name: user.nama_lengkap,
      role: user.role
    };

    req.session.user = sessionUser;

    // Handle "Remember Me"
    if (rememberMe) {
      const thirtyDays = 30 * 24 * 60 * 60 * 1000;
      req.session.cookie.maxAge = thirtyDays;
    }

    // Send back a success response
    res.status(200).json(sessionUser);

  } catch (error) {
    if (connection) connection.release();
    console.error('Error during authentication:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

app.get('api/auth/status', (req, res) => {
  req.sessionID.get(req.sessionID, (err, session) => {
    console.log(session)
  });
  return req.session.user 
  ? res.status(200).send(req.session.user) 
  : res.status(401).send({
    message: 'Anda belum login!',
  });
});

// Middleware untuk menangani route yang tidak ditemukan (404)
app.use((req, res) => {
  res.status(404).json({
    message: 'Halaman tidak ditemukan!',
  });
});

app.listen(port, host, () => {
  console.log(`Server berjalan pada http://${host}:${port}`);
});
