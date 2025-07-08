//kode hasil convert ke express js
import express from 'express';
import userRoutes from './routes/users.mjs';
import aboutRoutes from './routes/about.mjs';
import cookieParser from 'cookie-parser';
import session, { Session } from 'express-session';
import { mockUsers } from './data/users.mjs';
import pool from './data/db_setting.mjs';
import studentRoutes from './routes/students.mjs';

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

app.post('/api/auth',(req,res)=>{
  const {body: {username, password, rememberMe}} = req;
  const findUser = mockUsers.find((user) => {
    return user.username === username;
  });
  if(!findUser||findUser.password !== password){
    return res.status(401).json({
      message: 'Username atau password salah!',
    });
  } 
  req.session.user = findUser;
  if(rememberMe){
    req.session.cookie.maxAge = 60000*60*24*30; // 30 hari
  } else {
    req.session.cookie.expires = false; // session berakhir saat browser ditutup
  }
  return res.status(200).send({findUser});
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
