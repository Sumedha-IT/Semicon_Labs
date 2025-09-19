require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');

const app = express();
app.use(bodyParser.json());

// PostgreSQL connection
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT),
});

// Connection test
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Failed to connect to PostgreSQL:', err.message);
  } else {
    console.log('✅ Connected to PostgreSQL database');
    release();
  }
});

// ------------------- ORGANIZATION ROUTES -------------------

// Create
app.post('/organizations', async (req, res) => {
  const { org_name, type, industry, address, poc_name, poc_email, price_per_unit } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO Organization (org_name, type, industry, address, poc_name, poc_email, price_per_unit)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [org_name, type, industry, address, poc_name, poc_email, price_per_unit]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Read all
app.get('/organizations', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM Organization');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Read one by ID
app.get('/organizations/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM Organization WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update
app.put('/organizations/:id', async (req, res) => {
  const { id } = req.params;
  const { org_name, type, industry, address, poc_name, poc_email, price_per_unit } = req.body;
  try {
    const result = await pool.query(
      `UPDATE Organization SET org_name=$1, type=$2, industry=$3, address=$4,
       poc_name=$5, poc_email=$6, price_per_unit=$7 WHERE id=$8 RETURNING *`,
      [org_name, type, industry, address, poc_name, poc_email, price_per_unit, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete
app.delete('/organizations/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM Organization WHERE id=$1', [id]);
    res.sendStatus(204);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------- USER ROUTES -------------------

// Create with password hashing
app.post('/users', async (req, res) => {
  const {
    name,
    email,
    password_hash,
    role,
    dob,
    address,
    phone_number,
    location,
    client_id,
    client_type,
    registered_device_no
  } = req.body;

  try {
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password_hash, saltRounds);

    const result = await pool.query(
      `INSERT INTO "User" (name, email, password_hash, role, dob, address, phone_number, location, client_id, client_type, registered_device_no)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [name, email, hashedPassword, role, dob, address, phone_number, location, client_id, client_type, registered_device_no]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Read all
app.get('/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM "User"');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Read one by ID
app.get('/users/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM "User" WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update with password re-hashing
app.put('/users/:id', async (req, res) => {
  const { id } = req.params;
  const {
    name,
    email,
    password_hash,
    role,
    dob,
    address,
    phone_number,
    location,
    client_id,
    client_type,
    registered_device_no
  } = req.body;

  try {
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password_hash, saltRounds);

    const result = await pool.query(
      `UPDATE "User" SET name=$1, email=$2, password_hash=$3, role=$4, dob=$5, address=$6,
       phone_number=$7, location=$8, client_id=$9, client_type=$10, registered_device_no=$11 WHERE id=$12 RETURNING *`,
      [name, email, hashedPassword, role, dob, address, phone_number, location, client_id, client_type, registered_device_no, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete
app.delete('/users/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM "User" WHERE id=$1', [id]);
    res.sendStatus(204);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------- SERVER -------------------
app.listen(3000, () => {
  console.log('Server running at http://localhost:3000');
});