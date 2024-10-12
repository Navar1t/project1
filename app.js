import express from 'express';
import pg from 'pg';
import bodyParser from 'body-parser';
import session from 'express-session';
import path from 'path'; // เพิ่มการนำเข้าโมดูล path
import usersRouter from './public/users.js'; // ใช้ path ให้ถูกต้อง
import cors from 'cors';
import {fileURLToPath} from 'url';

const app = express();
const router = express.Router(); // สร้าง router ใหม่
const { Pool } = pg;

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.urlencoded({ extended: true }));

// PostgreSQL connection
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'project1',
    password: '1',
    port: 5432,
});

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Static folder to serve HTML
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/users', usersRouter);

app.set('view engine', 'ejs'); // ตั้งค่า EJS เป็น view engine

// กำหนดไดเรกทอรีสำหรับ views
app.set('views', path.join(__dirname, 'views'));

// กำหนด template engine
app.set('view engine', 'ejs');

// Route สำหรับหน้า student
app.get('/student', (req, res) => {
    res.render('login'); // ชื่อไฟล์ student.ejs
});

app.get('/std', async (req, res) => {
    try {
        const students = await pool.query('SELECT * FROM student');
        res.render('std', { students: students.rows });
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});

// Route สำหรับการเพิ่มข้อมูลนักเรียน
app.post('/students', async (req, res) => {
    const { prefix_id, first_name, last_name, date_of_birth, curriculum_id, previous_school, address, telephone, email, line_id } = req.body;

    try {
        await pool.query('INSERT INTO student (prefix_id, first_name, last_name, date_of_birth, curriculum_id, previous_school, address, telephone, email, line_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)', 
        [prefix_id, first_name, last_name, date_of_birth, curriculum_id, previous_school, address, telephone, email, line_id]);
        
        res.redirect('/students'); // Redirect ไปยังหน้าข้อมูลนักเรียน
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
console.log(prefix_id)
});

app.get('/login', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM student'); // แทนที่ 'std' ด้วยชื่อตารางของคุณ
        res.render('login', { users: result.rows }); // ส่งข้อมูลไปยังไฟล์ EJS
    } catch (error) {
        console.error('Error executing query', error.stack);
        res.status(500).send('Server Error');
    }
});

app.get('/student', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM student'); // ดึงข้อมูลจากตาราง std
        res.render('student', { users: result.rows }); // ส่งผลลัพธ์ไปยัง std.ejs
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});

app.post('/users', (req, res) => {
    const { name, age, email } = req.body;
  
    // คำสั่ง SQL สำหรับเพิ่มข้อมูลลงในตาราง std
    const sql = 'INSERT INTO student (name, age, email) VALUES ($1, $2, $3)';
    const values = [name, age, email];
  
    pool.query(sql, values, (error, result) => {
      if (error) {
        console.error('Error executing query', error.stack);
        res.status(500).send('Error inserting data');
      } else {
        res.send('เพิ่มข้อมูลในตารางแล้ว');
      }
    });
  });

// Middleware for session-based authentication
app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true,
}));

// Add new user
router.post('/add', async (req, res) => {
    const { name, email } = req.body;

    try {
        // Validate the input
        if (!name || !email) {
            return res.status(400).json({ error: 'Name and email are required' });
        }

        // Insert user into the database
        const result = await pool.query(
            'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *',
            [name, email]
        );

        // Return the new user data as JSON
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).send('Internal Server Error');
    }
});

// Show index page (formerly login page)
app.get('/index', (req, res) => {
    res.render('index');
});

// Handle login
app.post('/index', async (req, res) => {
    const { username, password } = req.body;

    try {
        // Query to find the user by username
        const userQuery = await pool.query('SELECT * FROM users WHERE username = $1', [username]);

        if (userQuery.rows.length > 0) {
            const user = userQuery.rows[0];

            // Check if the password matches (no hashing)
            if (password === user.password_hash) {
                req.session.userId = user.user_id; // Store user ID in session
                res.redirect('/login'); // Redirect to the login page after successful login
            } else {
                res.render('index', { error: 'Invalid username or password' });
            }
        } else {
            res.render('index', { error: 'Invalid username or password' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// Home route for rendering login permissions
app.get('/login', async (req, res) => {
    if (!req.session.userId) {
        return res.redirect('/index'); // Redirect to login page if not logged in
    }

    const userId = req.session.userId;

    // Example query for permissions; update as needed
    const userPermissionsQuery = `
        SELECT r.resource_name, p.permission_name
        FROM acl a
        JOIN resources r ON a.resource_id = r.resource_id
        JOIN permissions p ON a.permission_id = p.permission_id
        WHERE a.user_id = $1;
    `;

    const permissions = await pool.query(userPermissionsQuery, [userId]);

    // Render the login page with user permissions
    res.render('login', { permissions: permissions.rows }); // Make sure login.ejs is set up correctly
});

// Logout route
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/index'); // Redirect to home page after logout
});

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Static folder to serve HTML
app.use(express.static(path.join(process.cwd(), 'public'))); // ใช้ process.cwd() เพื่อให้แน่ใจว่า path ถูกต้อง

// Routes
app.use('/std', usersRouter);

// Define the port
const PORT = process.env.PORT || 3000;

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

export default router; // ใช้ export default แทน module.exports