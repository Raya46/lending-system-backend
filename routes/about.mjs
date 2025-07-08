import express from 'express';
const router = express.Router();

// Route untuk /about dengan method GET
router.get('/', (req, res) => {
  res.status(200).json({
    message: 'Ini adalah about',
  });
});

// Route untuk /about dengan method POST
router.post('/', (req, res) => {
  const { name } = req.body;
  res.status(200).json({
    message: `Hai, ${name}! Ini adalah halaman about`,
  });
});

// Route untuk /about dengan method selain GET dan POST
router.all('/', (req, res) => {
  res.status(400).json({
    message: `Halaman tidak dapat diakses dengan ${req.method} request!`,
  });
});

export default router;