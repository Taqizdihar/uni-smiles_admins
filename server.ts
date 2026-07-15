import express, { type Request, type Response, type NextFunction } from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cors from "cors";

// Load environment variables
dotenv.config();

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception inside backend process:", err);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fallbackDataPath = path.join(__dirname, "db.json");
let fallbackStore: any = { users: [], kiosks: [], templates: [], sessions: [] };

try {
  fallbackStore = JSON.parse(fs.readFileSync(fallbackDataPath, "utf8"));
} catch (err) {
  console.warn("Using empty fallback data store because db.json could not be loaded:", err);
}

function saveFallbackStore() {
  fs.writeFileSync(fallbackDataPath, JSON.stringify(fallbackStore, null, 2));
}

// MySQL Connection Pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: parseInt(process.env.DB_PORT || "3306"),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD ?? "",
  database: process.env.DB_NAME || "unismiles_db",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Helper to safely parse JSON columns from MySQL
function parseJsonColumn(val: any, fallback: any = []) {
  if (val === null || val === undefined) return fallback;
  if (typeof val === "string") {
    try {
      return JSON.parse(val);
    } catch {
      return val;
    }
  }
  return val;
}

function authenticateToken(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: "Authentication token required" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "fallback_secret_key_if_missing");
    (req as any).user = decoded;
    next();
  } catch (err: any) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

function authorizeRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user || !user.role || !allowedRoles.includes(user.role)) {
      return res.status(403).json({ error: "Forbidden: Access denied" });
    }
    next();
  };
}

async function ensureColumn(tableName: string, columnName: string, definition: string) {
  const [rows]: any = await pool.query(`SHOW COLUMNS FROM \`${tableName}\` LIKE ?`, [columnName]);
  if (rows.length === 0) {
    await pool.query(`ALTER TABLE \`${tableName}\` ADD COLUMN ${definition}`);
  }
}

async function insertUserRecord(userData: Record<string, any>) {
  const [columnRows]: any = await pool.query(`SHOW COLUMNS FROM users`);
  const columnNames = columnRows.map((col: any) => col.Field);
  const passwordField = columnNames.includes("password_hash") ? "password_hash" : "password";

  const [idColumns]: any = await pool.query(`SHOW COLUMNS FROM users LIKE 'id'`);
  const idColumn = idColumns[0];
  const idIsAutoIncrement = /int|bigint/.test(idColumn?.Type || "") || idColumn?.Extra?.includes("auto_increment");

  const baseColumns = ["name", "email", passwordField, "role", "partner", "serviceMode", "assignedKiosks", "status", "lastActive", "notes"];
  const baseValues = [
    userData.name,
    userData.email,
    userData.password ?? null,
    userData.role ?? "Viewer",
    userData.partner ?? "All Partners",
    userData.serviceMode ?? "Self-managed",
    JSON.stringify(userData.assignedKiosks ?? []),
    userData.status ?? "Active",
    userData.lastActive ?? "New",
    userData.notes ?? ""
  ];

  if (idIsAutoIncrement) {
    const placeholders = baseColumns.map(() => "?").join(", ");
    await pool.query(
      `INSERT INTO users (${baseColumns.join(", ")}) VALUES (${placeholders})`,
      baseValues
    );
    return null;
  }

  const id = userData.id ?? Date.now().toString();
  const placeholders = baseColumns.map(() => "?").join(", ");
  await pool.query(
    `INSERT INTO users (id, ${baseColumns.join(", ")}) VALUES (?, ${placeholders})`,
    [id, ...baseValues]
  );
  return id;
}

// Inisialisasi Database (Auto-migration & Auto-seeding)
async function initializeDatabase(): Promise<boolean> {
  console.log("Checking MySQL database connection and schema...");
  try {
    // 0. Create database if it doesn't exist using a direct temporary connection
    const tempConn = await mysql.createConnection({
      host: process.env.DB_HOST || "127.0.0.1",
      port: parseInt(process.env.DB_PORT || "3306"),
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD ?? ""
    });
    await tempConn.query(`
      CREATE DATABASE IF NOT EXISTS unismiles_db
      CHARACTER SET utf8mb4
      COLLATE utf8mb4_unicode_ci
    `);
    await tempConn.end();

    // 1. Create tables
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) NOT NULL,
        password VARCHAR(255) NULL,
        role VARCHAR(50) NOT NULL,
        partner VARCHAR(100) NOT NULL,
        serviceMode VARCHAR(100) NOT NULL,
        assignedKiosks JSON NULL,
        status VARCHAR(50) NOT NULL,
        lastActive VARCHAR(100) NOT NULL,
        notes TEXT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await ensureColumn("users", "password", "password VARCHAR(255) NULL");
    await ensureColumn("users", "password_hash", "password_hash VARCHAR(255) NULL");
    await ensureColumn("users", "role", "role VARCHAR(50) NOT NULL DEFAULT 'Viewer'");
    await ensureColumn("users", "partner", "partner VARCHAR(100) NOT NULL DEFAULT 'All Partners'");
    await ensureColumn("users", "partner_name", "partner_name VARCHAR(100) NULL");
    await ensureColumn("users", "serviceMode", "serviceMode VARCHAR(100) NOT NULL DEFAULT 'Self-managed'");
    await ensureColumn("users", "assignedKiosks", "assignedKiosks JSON NULL");
    await ensureColumn("users", "status", "status VARCHAR(50) NOT NULL DEFAULT 'Active'");
    await ensureColumn("users", "lastActive", "lastActive VARCHAR(100) NOT NULL DEFAULT 'New'");
    await ensureColumn("users", "notes", "notes TEXT NULL");

    await pool.query(`
      CREATE TABLE IF NOT EXISTS kiosks (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        location VARCHAR(100) NOT NULL,
        status VARCHAR(50) NOT NULL,
        health JSON NOT NULL,
        config JSON NOT NULL,
        createdAt VARCHAR(100) NOT NULL,
        lastHeartbeat VARCHAR(100) NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await ensureColumn("kiosks", "health", "health JSON NOT NULL");
    await ensureColumn("kiosks", "config", "config JSON NOT NULL");
    await ensureColumn("kiosks", "createdAt", "createdAt VARCHAR(100) NOT NULL");
    await ensureColumn("kiosks", "lastHeartbeat", "lastHeartbeat VARCHAR(100) NULL");

    await pool.query(`
      CREATE TABLE IF NOT EXISTS frame_templates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL COMMENT 'Nama template frame',
        slot_count INT NOT NULL DEFAULT 1 COMMENT 'Jumlah slot foto dalam frame',
        layout_config TEXT NULL COMMENT 'JSON konfigurasi posisi layout slot',
        is_active TINYINT(1) DEFAULT 1 COMMENT 'Status aktif (1) atau tidak aktif (0)',
        category VARCHAR(100) NULL COMMENT 'Kategori template',
        imageUrl LONGTEXT NULL COMMENT 'URL gambar template',
        usage_count INT NOT NULL DEFAULT 0 COMMENT 'Jumlah penggunaan',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id VARCHAR(100) PRIMARY KEY COMMENT 'ID Sesi (menggunakan timestamp/UUID)',
        session_code VARCHAR(100) NULL COMMENT 'Kode sesi unik alternatif',
        frame_template_id INT NULL COMMENT 'Template frame yang digunakan',
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ended_at TIMESTAMP NULL,
        status VARCHAR(50) DEFAULT 'active' COMMENT 'status: active, completed, abandoned',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        amount INT NOT NULL DEFAULT 0,
        CONSTRAINT fk_session_frame FOREIGN KEY (frame_template_id) REFERENCES frame_templates(id) 
          ON DELETE SET NULL 
          ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS photos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        filename VARCHAR(255) NOT NULL COMMENT 'Nama file PNG di disk',
        url VARCHAR(500) NOT NULL COMMENT 'URL lengkap untuk download',
        session_id VARCHAR(100) NULL COMMENT 'Timestamp sesi foto',
        file_size INT NULL COMMENT 'Ukuran file dalam bytes',
        layout_id VARCHAR(20) NULL COMMENT 'Layout yang dipilih (1x1, 4x1, dll)',
        email_sent_to VARCHAR(255) NULL COMMENT 'Email tujuan pengiriman (jika dikirim via email)',
        email_sent_at TIMESTAMP NULL COMMENT 'Waktu pengiriman email',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Waktu foto dibuat',
        CONSTRAINT fk_photo_session FOREIGN KEY (session_id) REFERENCES sessions(id) 
          ON DELETE SET NULL 
          ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS gesture_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        session_id VARCHAR(100) NOT NULL COMMENT 'Relasi ke sesi',
        gesture_type VARCHAR(50) NOT NULL COMMENT 'Tipe gesture (wave, fist, thumbs_up, dll)',
        confidence_score FLOAT NOT NULL COMMENT 'Tingkat akurasi deteksi (0.0 - 1.0)',
        action_triggered VARCHAR(100) NOT NULL COMMENT 'Aksi yang dijalankan (trigger_photo, next_filter, dll)',
        detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_gesture_session FOREIGN KEY (session_id) REFERENCES sessions(id) 
          ON DELETE CASCADE 
          ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS filters (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL COMMENT 'Nama filter',
        type VARCHAR(50) NOT NULL COMMENT 'Tipe filter (color, overlay, sticker)',
        preview_url VARCHAR(500) NULL COMMENT 'Preview url untuk icon filter',
        is_active TINYINT(1) DEFAULT 1 COMMENT 'Status aktif',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS photo_filters (
        id INT AUTO_INCREMENT PRIMARY KEY,
        photo_id INT NOT NULL,
        filter_id INT NOT NULL,
        applied_order INT DEFAULT 1 COMMENT 'Urutan penerapan filter',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_pf_photo FOREIGN KEY (photo_id) REFERENCES photos(id) 
          ON DELETE CASCADE 
          ON UPDATE CASCADE,
        CONSTRAINT fk_pf_filter FOREIGN KEY (filter_id) REFERENCES filters(id) 
          ON DELETE CASCADE 
          ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Ensure all required columns exist on existing tables
    await ensureColumn("sessions", "amount", "amount INT NOT NULL DEFAULT 0");
    await ensureColumn("sessions", "session_code", "session_code VARCHAR(100) NULL");
    await ensureColumn("sessions", "frame_template_id", "frame_template_id INT NULL");
    await ensureColumn("sessions", "started_at", "started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
    await ensureColumn("sessions", "ended_at", "ended_at TIMESTAMP NULL");
    await ensureColumn("sessions", "status", "status VARCHAR(50) DEFAULT 'active'");
    await ensureColumn("sessions", "created_at", "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP");

    await ensureColumn("frame_templates", "slot_count", "slot_count INT NOT NULL DEFAULT 1");
    await ensureColumn("frame_templates", "layout_config", "layout_config TEXT NULL");
    await ensureColumn("frame_templates", "is_active", "is_active TINYINT(1) DEFAULT 1");
    await ensureColumn("frame_templates", "category", "category VARCHAR(100) NULL");
    await ensureColumn("frame_templates", "imageUrl", "imageUrl LONGTEXT NULL");
    await ensureColumn("frame_templates", "usage_count", "usage_count INT NOT NULL DEFAULT 0");

    await ensureColumn("kiosks", "health", "health JSON NOT NULL");
    await ensureColumn("kiosks", "config", "config JSON NOT NULL");
    await ensureColumn("kiosks", "createdAt", "createdAt VARCHAR(100) NULL");
    await ensureColumn("kiosks", "lastHeartbeat", "lastHeartbeat VARCHAR(100) NULL");

    await ensureColumn("users", "password", "password VARCHAR(255) NULL");
    await ensureColumn("users", "password_hash", "password_hash VARCHAR(255) NULL");
    await ensureColumn("users", "role", "role VARCHAR(50) NOT NULL DEFAULT 'Viewer'");
    await ensureColumn("users", "partner", "partner VARCHAR(100) NOT NULL DEFAULT 'All Partners'");
    await ensureColumn("users", "partner_name", "partner_name VARCHAR(100) NULL");
    await ensureColumn("users", "serviceMode", "serviceMode VARCHAR(100) NOT NULL DEFAULT 'Self-managed'");
    await ensureColumn("users", "assignedKiosks", "assignedKiosks JSON NULL");
    await ensureColumn("users", "status", "status VARCHAR(50) NOT NULL DEFAULT 'Active'");
    await ensureColumn("users", "lastActive", "lastActive VARCHAR(100) NOT NULL DEFAULT 'New'");
    await ensureColumn("users", "notes", "notes TEXT NULL");

    console.log("Database tables verified successfully.");

    // 2. Perform auto-seeding if users table is empty
    const [userRows]: any = await pool.query("SELECT COUNT(*) as count FROM users");
    if (userRows[0].count === 0) {
      console.log("Users table is empty.");
    }

    // Set default lastHeartbeat values if null
    try {
      const [kioskColumnRows]: any = await pool.query("SHOW COLUMNS FROM kiosks LIKE 'lastHeartbeat'");
      if (kioskColumnRows.length > 0) {
        const [idCols]: any = await pool.query("SHOW COLUMNS FROM kiosks LIKE 'id'");
        const [deviceCodeCols]: any = await pool.query("SHOW COLUMNS FROM kiosks LIKE 'device_code'");
        
        let targetCol = null;
        if (deviceCodeCols.length > 0) {
          targetCol = 'device_code';
        } else if (idCols.length > 0 && !idCols[0].Type.toLowerCase().includes('int')) {
          targetCol = 'id';
        }

        if (targetCol) {
          await pool.query(
            `UPDATE kiosks SET lastHeartbeat = ? WHERE ${targetCol} = ? AND lastHeartbeat IS NULL`,
            [new Date(Date.now() - 3 * 60 * 1000).toISOString(), 'dummy-kiosk-1']
          );
          await pool.query(
            `UPDATE kiosks SET lastHeartbeat = ? WHERE ${targetCol} = ? AND lastHeartbeat IS NULL`,
            [new Date(Date.now() - 45 * 60 * 1000).toISOString(), 'dummy-kiosk-2']
          );
          await pool.query(
            `UPDATE kiosks SET lastHeartbeat = ? WHERE ${targetCol} = ? AND lastHeartbeat IS NULL`,
            [new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), 'dummy-kiosk-3']
          );
        }
      }
    } catch (seedErr) {
      console.warn("Skipped kiosk heartbeat seeding due to schema mismatch:", seedErr);
    }

    // Seed default frame templates
    const requiredTemplates = [
      { id: 1, name: "Gold Birthday Frame", slot_count: 4, is_active: 1, category: "Birthday", imageUrl: "https://picsum.photos/seed/bdayframe/300/450" },
      { id: 2, name: "Classic Wedding Rose", slot_count: 3, is_active: 1, category: "Wedding", imageUrl: "https://picsum.photos/seed/wedding/300/450" },
      { id: 3, name: "Graduation Class of 2026", slot_count: 4, is_active: 1, category: "Graduation", imageUrl: "https://picsum.photos/seed/graduation/300/450" },
      { id: 4, name: "Corporate Gala Night", slot_count: 4, is_active: 1, category: "Corporate", imageUrl: "https://picsum.photos/seed/corporate/300/450" },
      { id: 5, name: "Retro Fun Frame", slot_count: 2, is_active: 1, category: "General", imageUrl: "https://picsum.photos/seed/retro/300/450" }
    ];

    for (const t of requiredTemplates) {
      const [exists]: any = await pool.query("SELECT COUNT(*) as count FROM frame_templates WHERE id = ?", [t.id]);
      if (exists[0].count === 0) {
        try {
          await pool.query(
            `INSERT INTO frame_templates (id, name, slot_count, is_active, category, imageUrl, usage_count)
             VALUES (?, ?, ?, ?, ?, ?, 0)`,
            [t.id, t.name, t.slot_count, t.is_active, t.category, t.imageUrl]
          );
        } catch (templateErr: any) {
          if (templateErr?.code === "ER_BAD_FIELD_ERROR" || templateErr?.code === "ER_NO_DEFAULT_FOR_FIELD") {
            try {
              await pool.query(
                `INSERT INTO frame_templates (id, name, slot_count, is_active, category, usage_count)
                 VALUES (?, ?, ?, ?, ?, 0)`,
                [t.id, t.name, t.slot_count, t.is_active, t.category]
              );
            } catch (fallbackErr: any) {
              if (fallbackErr?.code === "ER_NO_DEFAULT_FOR_FIELD") {
                await pool.query(
                  `INSERT INTO frame_templates (id, name, slot_count, is_active, category, image_url, usage_count)
                   VALUES (?, ?, ?, ?, ?, ?, 0)`,
                  [t.id, t.name, t.slot_count, t.is_active, t.category, t.imageUrl || ""]
                );
              } else {
                throw fallbackErr;
              }
            }
          } else {
            throw templateErr;
          }
        }
      }
    }

    // Seed default filters
    const defaultFilters = [
      { id: 1, name: "Original", type: "color", preview_url: "https://picsum.photos/seed/original/100/100", is_active: 1 },
      { id: 2, name: "Black & White", type: "color", preview_url: "https://picsum.photos/seed/bw/100/100", is_active: 1 },
      { id: 3, name: "Vintage", type: "color", preview_url: "https://picsum.photos/seed/vintage/100/100", is_active: 1 },
      { id: 4, name: "Warm Tone", type: "color", preview_url: "https://picsum.photos/seed/warm/100/100", is_active: 1 },
      { id: 5, name: "Cool Tone", type: "color", preview_url: "https://picsum.photos/seed/cool/100/100", is_active: 1 },
      { id: 6, name: "Cinematic", type: "color", preview_url: "https://picsum.photos/seed/cinematic/100/100", is_active: 1 }
    ];

    for (const f of defaultFilters) {
      const [exists]: any = await pool.query("SELECT COUNT(*) as count FROM filters WHERE id = ?", [f.id]);
      if (exists[0].count === 0) {
        await pool.query(
          `INSERT INTO filters (id, name, type, preview_url, is_active)
           VALUES (?, ?, ?, ?, ?)`,
          [f.id, f.name, f.type, f.preview_url, f.is_active]
        );
      }
    }

    // Seed sessions history if empty/small or not exactly 20 or missing target ID
    const [sessRows]: any = await pool.query("SELECT COUNT(*) as count FROM sessions");
    const [hasTarget]: any = await pool.query("SELECT COUNT(*) as count FROM sessions WHERE id = '#US-117391'");
    if (sessRows[0].count !== 20 || hasTarget[0].count === 0) {
      console.log("Generating exactly 20 mock sessions with diverse templates and statuses...");
      await pool.query("DELETE FROM photo_filters");
      await pool.query("DELETE FROM gesture_logs");
      await pool.query("DELETE FROM photos");
      await pool.query("DELETE FROM sessions");
      
      const templatesList = [
        { id: 1, name: "Gold Birthday Frame", amount: 35000 },
        { id: 2, name: "Classic Wedding Rose", amount: 50000 },
        { id: 3, name: "Graduation Class of 2026", amount: 45000 },
        { id: 4, name: "Corporate Gala Night", amount: 40000 },
        { id: 5, name: "Retro Fun Frame", amount: 25000 }
      ];
      
      const nowMs = Date.now();
      const oneHour = 60 * 60 * 1000;
      
      for (let i = 0; i < 20; i++) {
        // Cycle templates evenly so we have diverse templates, including Corporate Gala Night
        const randTemplate = templatesList[i % templatesList.length];
        const sessId = i === 0 ? "#US-117391" : `#US-${117000 + i}`; // Sequential but realistic looking IDs, first one is target ID
        const sessTime = new Date(nowMs - i * 3 * oneHour);
        const endedTime = new Date(sessTime.getTime() + 5 * 60 * 1000);
        
        // Distribute statuses: 7 Success, 7 Failed, 6 Pending mapped to ENUMs
        let displayStatus = "completed";
        if (i >= 7 && i < 14) {
          displayStatus = "failed";
        } else if (i >= 14) {
          displayStatus = "active";
        }
        
        try {
          await pool.query(
            `INSERT INTO sessions (id, session_code, frame_template_id, started_at, ended_at, status, amount)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              sessId,
              sessId,
              randTemplate.id,
              sessTime,
              endedTime,
              displayStatus,
              randTemplate.amount
            ]
          );
        } catch (sessionErr: any) {
          if (sessionErr?.code === "ER_BAD_FIELD_ERROR") {
            await pool.query(
              `INSERT INTO sessions (id, session_code, frame_template_id, started_at, ended_at, status)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [
                sessId,
                sessId,
                randTemplate.id,
                sessTime,
                endedTime,
                displayStatus
              ]
            );
          } else {
            throw sessionErr;
          }
        }

        await pool.query(
          `UPDATE frame_templates SET usage_count = usage_count + 1 WHERE id = ?`,
          [randTemplate.id]
        );
        
        if (displayStatus === "Success") {
          const photosCount = 2; // Fixed number of photos for success sessions to keep it clean
          for (let idx = 0; idx < photosCount; idx++) {
            const url = `https://picsum.photos/seed/photo-${i}-${idx}/200/300`;
            const filename = `photo-${i}-${idx}.png`;
            const fileSize = 250000;
            const layoutId = "4x1";
            
            const [photoResult]: any = await pool.query(
              `INSERT INTO photos (filename, url, session_id, file_size, layout_id, created_at)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [
                filename,
                url,
                sessId,
                fileSize,
                layoutId,
                endedTime
              ]
            );
            const photoId = photoResult.insertId;

            const randomFilterId = (idx % 6) + 1;
            await pool.query(
              `INSERT INTO photo_filters (photo_id, filter_id, applied_order)
               VALUES (?, ?, 1)`,
              [photoId, randomFilterId]
            );
          }
        }
        
        // Insert gesture logs to make it look active
        const gestures = ["wave", "fist", "thumbs_up"];
        const actions = ["trigger_photo", "next_filter", "confirm_print"];
        const randIdx = i % gestures.length;
        await pool.query(
          `INSERT INTO gesture_logs (session_id, gesture_type, confidence_score, action_triggered, detected_at)
           VALUES (?, ?, ?, ?, ?)`,
          [
            sessId,
            gestures[randIdx],
            0.85,
            actions[randIdx],
            sessTime
          ]
        );
      }
      console.log("Mock session history generated successfully with exactly 20 sessions.");
    }
  } catch (err) {
    console.error("Database initialization failed:", err);
    return false;
  }
}

// Initialize Gemini AI SDK securely on the backend
const apiKey = process.env.GEMINI_API_KEY || "";
if (!apiKey) {
  console.warn("WARNING: GEMINI_API_KEY is not defined in the environment. AI Generator will fall back to smart simulated responses.");
}
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
  let databaseReady = false;

  app.use(express.json({ limit: "50mb" })); // Increase limit for template image uploads
  app.use(cors());

  // Initialize DB before starting backend routes
  try {
    databaseReady = await initializeDatabase();
  } catch (dbErr) {
    console.error("Error initializing database:", dbErr);
  }

  function isDatabaseAvailable() {
    return databaseReady;
  }

  async function queryWithFallback<T>(operation: () => Promise<T>, fallback: T): Promise<T> {
    if (!isDatabaseAvailable()) {
      return fallback;
    }

    try {
      return await operation();
    } catch (err) {
      console.warn("Database query failed, falling back to local JSON data:", err);
      return fallback;
    }
  }

  // --- API Routes ---

  // Auth Routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { name, email, password } = req.body;
      if (!name || !email || !password) {
        return res.status(400).json({ error: "Name, email, and password are required" });
      }
      
      if (isDatabaseAvailable()) {
        const [existingUsers]: any = await pool.query("SELECT id FROM users WHERE email = ?", [email]);
        if (existingUsers.length > 0) {
          return res.status(400).json({ error: "Email already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const role = "Admin Mitra";
        const partner_name = "All Partners";

        const [idColumns]: any = await pool.query("SHOW COLUMNS FROM users LIKE 'id'");
        const idColumn = idColumns[0];
        const idIsAutoIncrement = /int|bigint/.test(idColumn?.Type || "") || idColumn?.Extra?.includes("auto_increment");

        if (idIsAutoIncrement) {
          await pool.query(
            "INSERT INTO users (name, email, password_hash, role, partner_name) VALUES (?, ?, ?, ?, ?)",
            [name, email, hashedPassword, role, partner_name]
          );
        } else {
          const id = Date.now().toString();
          await pool.query(
            "INSERT INTO users (id, name, email, password_hash, role, partner_name) VALUES (?, ?, ?, ?, ?, ?)",
            [id, name, email, hashedPassword, role, partner_name]
          );
        }
      } else {
        const existingUser = fallbackStore.users.find((u: any) => u.email === email);
        if (existingUser) {
          return res.status(400).json({ error: "Email already exists" });
        }
        fallbackStore.users.push({
          id: Date.now().toString(),
          name,
          email,
          password: await bcrypt.hash(password, 10),
          role: "Admin Mitra",
          partner: "All Partners",
          serviceMode: "Self-managed",
          assignedKiosks: [],
          status: "Active",
          lastActive: "New",
          notes: ""
        });
        saveFallbackStore();
      }

      res.status(201).json({ success: true, message: "User registered successfully" });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: "Registration failed", details: err.message });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }

      let user: any = null;
      if (isDatabaseAvailable()) {
        const [users]: any = await pool.query("SELECT * FROM users WHERE email = ?", [email]);
        if (users.length === 0) {
          return res.status(401).json({ error: "Invalid credentials" });
        }
        user = users[0];
      } else {
        user = fallbackStore.users.find((entry: any) => entry.email === email);
        if (!user) {
          return res.status(401).json({ error: "Invalid credentials" });
        }
      }

      const storedPassword = user.password ?? user.password_hash ?? "";
      const isValidPassword = await bcrypt.compare(password, storedPassword);
      if (!isValidPassword) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const jwtSecret = process.env.JWT_SECRET || "fallback_secret_key_if_missing";
      const userPartnerName = user.partner_name ?? user.partner ?? "All Partners";
      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role, partner_name: userPartnerName },
        jwtSecret,
        { expiresIn: "1d" }
      );

      res.json({
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          partner_name: userPartnerName
        }
      });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: "Login failed", details: err.message });
    }
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "UniSmiles backend with MySQL is fully operational." });
  });

  // --- Users API ---
  app.get("/api/users", async (req, res) => {
    try {
      if (!isDatabaseAvailable()) {
        const mapped = fallbackStore.users.map((u: any) => ({
          ...u,
          assignedKiosks: parseJsonColumn(u.assignedKiosks)
        }));
        return res.json(mapped);
      }

      const [rows]: any = await pool.query("SELECT * FROM users");
      const mapped = rows.map((u: any) => ({
        ...u,
        assignedKiosks: parseJsonColumn(u.assignedKiosks)
      }));
      res.json(mapped);
    } catch (err: any) {
      res.status(500).json({ error: "Failed to fetch users", details: err.message });
    }
  });

  app.post("/api/users", async (req, res) => {
    const newUser = {
      id: Date.now().toString(),
      name: req.body.name,
      email: req.body.email,
      role: req.body.role,
      partner: req.body.partner || "All Partners",
      serviceMode: req.body.serviceMode || "Self-managed",
      assignedKiosks: req.body.assignedKiosks || [],
      status: req.body.status || "Active",
      lastActive: "New",
      notes: req.body.notes || ""
    };

    try {
      const createdId = await insertUserRecord({
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        partner: newUser.partner,
        serviceMode: newUser.serviceMode,
        assignedKiosks: newUser.assignedKiosks,
        status: newUser.status,
        lastActive: newUser.lastActive,
        notes: newUser.notes
      });
      res.status(201).json({ ...newUser, id: createdId ?? newUser.id });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to create user", details: err.message });
    }
  });

  app.put("/api/users/:id", async (req, res) => {
    const { id } = req.params;
    try {
      const [rows]: any = await pool.query("SELECT * FROM users WHERE id = ?", [id]);
      if (rows.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      const existingUser = rows[0];
      const updatedUser = {
        name: req.body.name !== undefined ? req.body.name : existingUser.name,
        email: req.body.email !== undefined ? req.body.email : existingUser.email,
        role: req.body.role !== undefined ? req.body.role : existingUser.role,
        partner: req.body.partner !== undefined ? req.body.partner : existingUser.partner,
        serviceMode: req.body.serviceMode !== undefined ? req.body.serviceMode : existingUser.serviceMode,
        assignedKiosks: req.body.assignedKiosks !== undefined ? req.body.assignedKiosks : parseJsonColumn(existingUser.assignedKiosks),
        status: req.body.status !== undefined ? req.body.status : existingUser.status,
        lastActive: req.body.lastActive !== undefined ? req.body.lastActive : existingUser.lastActive,
        notes: req.body.notes !== undefined ? req.body.notes : existingUser.notes
      };

      await pool.query(
        `UPDATE users SET name = ?, email = ?, role = ?, partner = ?, serviceMode = ?, assignedKiosks = ?, status = ?, lastActive = ?, notes = ? WHERE id = ?`,
        [
          updatedUser.name,
          updatedUser.email,
          updatedUser.role,
          updatedUser.partner,
          updatedUser.serviceMode,
          JSON.stringify(updatedUser.assignedKiosks),
          updatedUser.status,
          updatedUser.lastActive,
          updatedUser.notes,
          id
        ]
      );

      res.json({ ...updatedUser, id });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to update user", details: err.message });
    }
  });

  app.delete("/api/users/:id", async (req, res) => {
    const { id } = req.params;
    try {
      const [result]: any = await pool.query("DELETE FROM users WHERE id = ?", [id]);
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json({ success: true, message: "User deleted successfully." });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to delete user", details: err.message });
    }
  });

  app.use("/api/users", authenticateToken, authorizeRole('Super Admin'));
  app.use("/api/kiosks", authenticateToken, authorizeRole('Super Admin', 'Admin Mitra'));
  app.use("/api/templates", authenticateToken, authorizeRole('Super Admin', 'Admin Mitra'));
  app.use("/api/sessions", authenticateToken, authorizeRole('Super Admin', 'Admin Mitra'));
  app.use("/api/analytics", authenticateToken, authorizeRole('Super Admin', 'Admin Mitra'));

  // --- Kiosks API ---
  app.get("/api/kiosks", async (req, res) => {
    try {
      if (!isDatabaseAvailable()) {
        const mapped = fallbackStore.kiosks.map((k: any) => ({
          ...k,
          health: parseJsonColumn(k.health_status ?? k.health, {}),
          config: parseJsonColumn(k.config_settings ?? k.config, {})
        }));
        return res.json(mapped);
      }

      const [rows]: any = await pool.query("SELECT * FROM kiosks");
      const mapped = rows.map((k: any) => ({
        ...k,
        health: parseJsonColumn(k.health_status ?? k.health, {}),
        config: parseJsonColumn(k.config_settings ?? k.config, {})
      }));
      res.json(mapped);
    } catch (err: any) {
      res.status(500).json({ error: "Failed to fetch kiosks", details: err.message });
    }
  });

  app.post("/api/kiosks", async (req, res) => {
    const newKiosk = {
      id: Date.now().toString(),
      name: req.body.name,
      location: req.body.location,
      status: "offline",
      health: {
        printerInk: 100,
        storage: 0,
        camera: "good"
      },
      config: req.body.config || { brightness: 80, volume: 50, maintenanceMode: false },
      createdAt: new Date().toISOString()
    };

    try {
      await pool.query(
        `INSERT INTO kiosks (id, name, location, status, health, config, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          newKiosk.id,
          newKiosk.name,
          newKiosk.location,
          newKiosk.status,
          JSON.stringify(newKiosk.health),
          JSON.stringify(newKiosk.config),
          newKiosk.createdAt
        ]
      );
      res.status(201).json(newKiosk);
    } catch (err: any) {
      res.status(500).json({ error: "Failed to create kiosk", details: err.message });
    }
  });

  app.put("/api/kiosks/:id", async (req, res) => {
    const { id } = req.params;
    try {
      const [rows]: any = await pool.query("SELECT * FROM kiosks WHERE id = ?", [id]);
      if (rows.length === 0) {
        return res.status(404).json({ error: "Kiosk not found" });
      }

      const existingKiosk = rows[0];
      const updatedKiosk = {
        name: req.body.name !== undefined ? req.body.name : existingKiosk.name,
        location: req.body.location !== undefined ? req.body.location : existingKiosk.location,
        status: req.body.status !== undefined ? req.body.status : existingKiosk.status,
        health: req.body.health !== undefined ? req.body.health : parseJsonColumn(existingKiosk.health_status ?? existingKiosk.health, {}),
        config: req.body.config !== undefined ? req.body.config : parseJsonColumn(existingKiosk.config_settings ?? existingKiosk.config, {}),
        createdAt: existingKiosk.createdAt
      };

      await pool.query(
        `UPDATE kiosks SET name = ?, location = ?, status = ?, health = ?, config = ? WHERE id = ?`,
        [
          updatedKiosk.name,
          updatedKiosk.location,
          updatedKiosk.status,
          JSON.stringify(updatedKiosk.health),
          JSON.stringify(updatedKiosk.config),
          id
        ]
      );

      res.json({ ...updatedKiosk, id });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to update kiosk", details: err.message });
    }
  });

  app.post("/api/kiosks/:id/restart", async (req, res) => {
    const { id } = req.params;
    try {
      const [rows]: any = await pool.query("SELECT * FROM kiosks WHERE id = ?", [id]);
      if (rows.length === 0) {
        return res.status(404).json({ error: "Kiosk not found" });
      }

      // Set to restarting
      await pool.query("UPDATE kiosks SET status = 'restarting' WHERE id = ?", [id]);

      // Simulate 3-second reboot, then switch to online
      setTimeout(async () => {
        try {
          await pool.query("UPDATE kiosks SET status = 'online' WHERE id = ?", [id]);
          console.log(`Kiosk ${id} finished restarting and is now online.`);
        } catch (errTimeout) {
          console.error(`Error completing restart for kiosk ${id}:`, errTimeout);
        }
      }, 3000);

      res.json({ success: true, message: "Kiosk reboot sequence initiated." });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to restart kiosk", details: err.message });
    }
  });

  app.delete("/api/kiosks/:id", async (req, res) => {
    const { id } = req.params;
    try {
      const [result]: any = await pool.query("DELETE FROM kiosks WHERE id = ?", [id]);
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "Kiosk not found" });
      }
      res.json({ success: true, message: "Kiosk deleted successfully." });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to delete kiosk", details: err.message });
    }
  });

  // --- Templates API ---
  app.get("/api/templates", async (req, res) => {
    try {
      if (!isDatabaseAvailable()) {
        const mapped = fallbackStore.templates.map((r: any) => ({
          id: String(r.id),
          name: r.name,
          category: r.category || "General",
          imageUrl: r.imageUrl || "",
          status: r.status || "active",
          usageCount: r.usageCount || 0,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt
        }));
        return res.json(mapped);
      }

      const [rows]: any = await pool.query("SELECT * FROM frame_templates ORDER BY created_at DESC");
      const mapped = rows.map((r: any) => ({
        id: String(r.id),
        name: r.name,
        category: r.category || "General",
        imageUrl: r.imageUrl || "",
        status: r.is_active ? "active" : "inactive",
        usageCount: r.usage_count || 0,
        createdAt: r.created_at,
        updatedAt: r.updated_at
      }));
      res.json(mapped);
    } catch (err: any) {
      res.status(500).json({ error: "Failed to fetch templates", details: err.message });
    }
  });

  app.post("/api/templates", async (req, res) => {
    const name = req.body.name;
    const category = req.body.category || "General";
    const imageUrl = req.body.imageUrl || "";
    const isActive = req.body.status === "active" ? 1 : 0;

    try {
      const [result]: any = await pool.query(
        `INSERT INTO frame_templates (name, category, imageUrl, is_active, slot_count, usage_count)
         VALUES (?, ?, ?, ?, 4, 0)`,
        [name, category, imageUrl, isActive]
      );
      
      const newId = result.insertId;
      res.status(201).json({
        id: String(newId),
        name,
        category,
        imageUrl,
        status: isActive ? "active" : "inactive",
        usageCount: 0,
        createdAt: new Date().toISOString()
      });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to create template", details: err.message });
    }
  });

  app.put("/api/templates/:id", async (req, res) => {
    const { id } = req.params;
    const numericId = parseInt(id);
    try {
      const [rows]: any = await pool.query("SELECT * FROM frame_templates WHERE id = ?", [numericId]);
      if (rows.length === 0) {
        return res.status(404).json({ error: "Template not found" });
      }

      const existing = rows[0];
      const name = req.body.name !== undefined ? req.body.name : existing.name;
      const category = req.body.category !== undefined ? req.body.category : existing.category;
      const imageUrl = req.body.imageUrl !== undefined ? req.body.imageUrl : existing.imageUrl;
      const isActive = req.body.status !== undefined ? (req.body.status === "active" ? 1 : 0) : existing.is_active;
      const usageCount = req.body.usageCount !== undefined ? req.body.usageCount : existing.usage_count;

      await pool.query(
        `UPDATE frame_templates SET name = ?, category = ?, imageUrl = ?, is_active = ?, usage_count = ? WHERE id = ?`,
        [name, category, imageUrl, isActive, usageCount, numericId]
      );

      res.json({
        id: String(numericId),
        name,
        category,
        imageUrl,
        status: isActive ? "active" : "inactive",
        usageCount,
        createdAt: existing.created_at,
        updatedAt: new Date().toISOString()
      });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to update template", details: err.message });
    }
  });

  app.delete("/api/templates/:id", async (req, res) => {
    const { id } = req.params;
    const numericId = parseInt(id);
    try {
      const [result]: any = await pool.query("DELETE FROM frame_templates WHERE id = ?", [numericId]);
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "Template not found" });
      }
      res.json({ success: true, message: "Template deleted successfully." });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to delete template", details: err.message });
    }
  });

  // --- Sessions API ---
  app.get("/api/sessions", async (req, res) => {
    try {
      if (!isDatabaseAvailable()) {
        const mapped = fallbackStore.sessions.map((s: any) => ({
          id: String(s.id),
          timestamp: s.timestamp,
          template: s.template || "Retro Fun Frame",
          photos: s.photos || [],
          amount: s.amount || 0,
          status: s.status || "Success"
        }));
        return res.json(mapped);
      }

      const [sessionRows]: any = await pool.query(`
        SELECT 
          s.id,
          s.started_at as timestamp,
          t.name as template,
          s.amount,
          s.status,
          GROUP_CONCAT(DISTINCT p.url ORDER BY p.id SEPARATOR '|') as photo_urls
        FROM sessions s
        LEFT JOIN frame_templates t ON s.frame_template_id = t.id
        LEFT JOIN photos p ON p.session_id = s.id
        GROUP BY s.id, s.started_at, t.name, s.amount, s.status
        ORDER BY s.started_at DESC
      `);

      if (sessionRows.length === 0) {
        return res.json([]);
      }

      const mapped = sessionRows.map((s: any) => {
        let displayStatus = s.status || "Success";
        if (s.status === "completed") displayStatus = "Success";
        else if (s.status === "failed") displayStatus = "Failed";
        else if (s.status === "active") displayStatus = "Pending";
        else if (s.status === "abandoned") displayStatus = "Failed";

        return {
          id: String(s.id),
          timestamp: s.timestamp instanceof Date ? s.timestamp.toISOString() : s.timestamp,
          template: s.template || "Retro Fun Frame",
          photos: s.photo_urls ? s.photo_urls.split('|').filter(Boolean) : [],
          amount: s.amount || 0,
          status: displayStatus
        };
      });

      res.json(mapped);
    } catch (err: any) {
      res.status(500).json({ error: "Failed to fetch sessions", details: err.message });
    }
  });

  app.post("/api/sessions", async (req, res) => {
    const id = req.body.id || "#US-" + Math.floor(1000 + Math.random() * 9000);
    const timestamp = req.body.timestamp || new Date().toISOString();
    const templateName = req.body.template;
    const photos = req.body.photos || [];
    const amount = req.body.amount || 0;
    const status = req.body.status || "Success";

    try {
      let templateId: number | null = null;
      if (templateName) {
        const [tRows]: any = await pool.query("SELECT id FROM frame_templates WHERE name = ?", [templateName]);
        if (tRows.length > 0) {
          templateId = tRows[0].id;
        }
      }

      await pool.query(
        `INSERT INTO sessions (id, session_code, frame_template_id, started_at, status, amount)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          id,
          id,
          templateId,
          new Date(timestamp),
          status,
          amount
        ]
      );

      if (templateId) {
        await pool.query(
          `UPDATE frame_templates SET usage_count = usage_count + 1 WHERE id = ?`,
          [templateId]
        );
      }

      for (const url of photos) {
        const filename = path.basename(url) || "photo.png";
        const fileSize = 250000;
        await pool.query(
          `INSERT INTO photos (filename, url, session_id, file_size, layout_id)
           VALUES (?, ?, ?, ?, ?)`,
          [filename, url, id, fileSize, "4x1"]
        );
      }

      res.status(201).json({
        id,
        timestamp,
        template: templateName,
        photos,
        amount,
        status
      });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to create session", details: err.message });
    }
  });

  // Helper for formatting last active relative time in Indonesian
  function formatLastSeen(isoString: string | null | undefined) {
    if (!isoString) return "Belum terhubung";
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 1) return "Baru saja";
    if (diffMins < 60) return `${diffMins} menit lalu`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} jam lalu`;
    
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return "Kemarin";
    return `${diffDays} hari lalu`;
  }

  // --- Analytics API Endpoint ---
  app.get("/api/analytics", async (req, res) => {
    try {
      if (!isDatabaseAvailable()) {
        const sessions = fallbackStore.sessions || [];
        const kiosks = fallbackStore.kiosks || [];
        const templates = fallbackStore.templates || [];
        const totalSessions = sessions.length;
        const totalRevenue = sessions.reduce((sum: number, s: any) => sum + (Number(s.amount) || 0), 0);
        const photosPrinted = sessions.reduce((sum: number, s: any) => sum + (Array.isArray(s.photos) ? s.photos.length : 0), 0);
        const onlineKiosks = kiosks.filter((k: any) => k.status === "online").length;
        const revenueChart = Array.from({ length: 7 }, (_, idx) => ({
          name: new Date(Date.now() - (6 - idx) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
          value: 0
        }));
        const popularityChart = templates.map((t: any) => ({
          name: t.category || "General",
          value: 0
        }));
        return res.json({
          stats: {
            totalSessions: { value: totalSessions, growth: 0, trend: "up" },
            photosPrinted: { value: photosPrinted, growth: 0, trend: "up" },
            revenue: { value: totalRevenue, growth: 0, trend: "up" },
            revenueToday: { value: totalRevenue }
          },
          activeKiosks: { online: onlineKiosks, total: kiosks.length },
          revenueChart,
          popularityChart,
          kioskStatus: kiosks.map((k: any) => ({
            id: k.id,
            name: k.name,
            location: k.location,
            status: k.status,
            lastSeen: k.lastHeartbeat || "Belum terhubung"
          })),
          topTemplate: templates[0] ? { name: templates[0].name, category: templates[0].category || "General", usageCount: templates[0].usageCount || 0 } : null,
          hasData: totalSessions > 0
        });
      }

      const rangeDays = parseInt((req.query.range as string) || "7");
      
      const now = new Date();
      const currentStart = new Date(now.getTime() - rangeDays * 24 * 60 * 60 * 1000).toISOString();
      const prevStart = new Date(now.getTime() - 2 * rangeDays * 24 * 60 * 60 * 1000).toISOString();
      const nowStr = now.toISOString();

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStartStr = today.toISOString();
      
      // 1. Fetch current and previous KPI metrics
      const [currentSessionsAndRevenue]: any = await pool.query(`
        SELECT 
          COUNT(id) as totalSessions,
          COALESCE(SUM(amount), 0) as totalRevenue
        FROM sessions
        WHERE started_at >= ? AND started_at <= ?
      `, [currentStart, nowStr]);

      const [currentPhotos]: any = await pool.query(`
        SELECT COUNT(p.id) as photosPrinted
        FROM photos p
        JOIN sessions s ON p.session_id = s.id
        WHERE s.started_at >= ? AND s.started_at <= ?
      `, [currentStart, nowStr]);

      const [prevSessionsAndRevenue]: any = await pool.query(`
        SELECT 
          COUNT(id) as totalSessions,
          COALESCE(SUM(amount), 0) as totalRevenue
        FROM sessions
        WHERE started_at >= ? AND started_at < ?
      `, [prevStart, currentStart]);

      const [prevPhotos]: any = await pool.query(`
        SELECT COUNT(p.id) as photosPrinted
        FROM photos p
        JOIN sessions s ON p.session_id = s.id
        WHERE s.started_at >= ? AND s.started_at < ?
      `, [prevStart, currentStart]);

      const [todayRevenueRows]: any = await pool.query(`
        SELECT COALESCE(SUM(amount), 0) as total
        FROM sessions
        WHERE started_at >= ? AND started_at <= ?
      `, [todayStartStr, nowStr]);

      const currentMetrics = {
        totalSessions: currentSessionsAndRevenue[0].totalSessions,
        totalRevenue: currentSessionsAndRevenue[0].totalRevenue,
        photosPrinted: currentPhotos[0].photosPrinted
      };

      const prevMetrics = {
        totalSessions: prevSessionsAndRevenue[0].totalSessions,
        totalRevenue: prevSessionsAndRevenue[0].totalRevenue,
        photosPrinted: prevPhotos[0].photosPrinted
      };

      const revenueToday = todayRevenueRows[0].total;

      const calcGrowth = (curr: number, prev: number) => {
        if (prev === 0) return curr > 0 ? 100 : 0;
        const growthVal = ((curr - prev) / prev) * 100;
        return parseFloat(growthVal.toFixed(1));
      };

      const stats = {
        totalSessions: {
          value: currentMetrics.totalSessions,
          growth: calcGrowth(currentMetrics.totalSessions, prevMetrics.totalSessions),
          trend: currentMetrics.totalSessions >= prevMetrics.totalSessions ? 'up' : 'down'
        },
        photosPrinted: {
          value: currentMetrics.photosPrinted,
          growth: calcGrowth(currentMetrics.photosPrinted, prevMetrics.photosPrinted),
          trend: currentMetrics.photosPrinted >= prevMetrics.photosPrinted ? 'up' : 'down'
        },
        revenue: {
          value: currentMetrics.totalRevenue,
          growth: calcGrowth(currentMetrics.totalRevenue, prevMetrics.totalRevenue),
          trend: currentMetrics.totalRevenue >= prevMetrics.totalRevenue ? 'up' : 'down'
        },
        revenueToday: {
          value: revenueToday
        }
      };

      // 2. Kiosk status count and details
      const [kiosksRows]: any = await pool.query("SELECT id, name, location, status, lastHeartbeat FROM kiosks");
      const totalKiosks = kiosksRows.length;
      const onlineKiosks = kiosksRows.filter((k: any) => k.status === 'online').length;

      // 3. Revenue Overview Chart data
      const [revenueChartRows]: any = await pool.query(`
        SELECT 
          DATE_FORMAT(started_at, '%Y-%m-%d') as date,
          COALESCE(SUM(amount), 0) as value
        FROM sessions
        WHERE started_at >= ? AND started_at <= ?
        GROUP BY DATE_FORMAT(started_at, '%Y-%m-%d')
        ORDER BY date ASC
      `, [currentStart, nowStr]);

      const chartMap = new Map();
      for (let i = 0; i < rangeDays; i++) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const dateStr = d.toISOString().substring(0, 10);
        chartMap.set(dateStr, 0);
      }
      revenueChartRows.forEach((row: any) => {
        if (chartMap.has(row.date)) {
          chartMap.set(row.date, row.value);
        }
      });
      const revenueChart = Array.from(chartMap.entries())
        .map(([name, value]) => ({ name, value }))
        .reverse();

      // 4. Popularity Chart data
      const [popularityRows]: any = await pool.query(`
        SELECT 
          t.category,
          COUNT(s.id) as count
        FROM sessions s
        JOIN frame_templates t ON s.frame_template_id = t.id
        WHERE s.started_at >= ? AND s.started_at <= ?
        GROUP BY t.category
      `, [currentStart, nowStr]);

      const totalCategorySessions = popularityRows.reduce((sum: number, r: any) => sum + r.count, 0);
      const popularityChart = popularityRows.map((r: any) => ({
        name: r.category || "General",
        value: totalCategorySessions > 0 ? Math.round((r.count / totalCategorySessions) * 100) : 0
      }));

      // 5. Top Template details
      const [topTemplateRows]: any = await pool.query(`
        SELECT 
          t.name,
          t.category,
          COUNT(s.id) as usageCount
        FROM sessions s
        JOIN frame_templates t ON s.frame_template_id = t.id
        WHERE s.started_at >= ? AND s.started_at <= ?
        GROUP BY t.name, t.category
        ORDER BY usageCount DESC
        LIMIT 1
      `, [currentStart, nowStr]);

      const topTemplate = topTemplateRows.length > 0 ? {
        name: topTemplateRows[0].name,
        category: topTemplateRows[0].category || "General",
        usageCount: topTemplateRows[0].usageCount
      } : null;

      const [allSessionsCount]: any = await pool.query("SELECT COUNT(*) as count FROM sessions");
      const hasData = allSessionsCount[0].count > 0;

      res.json({
        stats,
        activeKiosks: {
          online: onlineKiosks,
          total: totalKiosks
        },
        revenueChart,
        popularityChart,
        kioskStatus: kiosksRows.map((k: any) => ({
          id: k.id,
          name: k.name,
          location: k.location,
          status: k.status,
          lastSeen: formatLastSeen(k.lastHeartbeat)
        })),
        topTemplate,
        hasData
      });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to generate analytics", details: err.message });
    }
  });

  // --- Secure Gemini AI API Endpoints ---
  app.post("/api/ai/marketing", async (req, res) => {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required." });
    }

    if (!ai) {
      return res.json({
        text: `[SIMULASI AI - Kunci API Gemini tidak dikonfigurasi]\n\nSaya merekomendasikan ide berikut untuk "${prompt}":\n"Yuk datang ke Smart Photo Booth terdekat! 📸✨ Ekspresikan gayamu bersama UniSmiles dan buat kenangan manis tak terlupakan bareng bestie-mu! Gunakan promo akhir pekan gratis 1 cetak tambahan! 🌈💖 #UniSmiles #PhotoBoothBandung"`
      });
    }

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          systemInstruction: "You are UniSmiles AI, a marketing assistant for a Smart Photo Booth business in Indonesia. Your tone is fun, youthful, and professional. Help generate captions, promo text, and pose ideas.",
        }
      });
      res.json({ text: response.text });
    } catch (error: any) {
      console.error("Gemini AI API error:", error);
      res.status(500).json({ error: "Failed to generate AI content.", details: error.message });
    }
  });

  app.post("/api/ai/layout", async (req, res) => {
    const { eventType } = req.body;
    if (!eventType) {
      return res.status(400).json({ error: "eventType is required." });
    }

    if (!ai) {
      return res.json({
        layout: { photosCount: 4, textOverlays: [`Simulated ${eventType} Event`, new Date().toLocaleDateString()] }
      });
    }

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Suggest a photo strip layout for a ${eventType} event. Include number of photos (2, 3, 4, or 6) and suggested text overlays. Return as JSON.`,
        config: {
          responseMimeType: "application/json",
        }
      });
      res.json({ layout: JSON.parse(response.text || "{}") });
    } catch (error: any) {
      console.error("Gemini AI Layout API error:", error);
      res.status(500).json({ error: "Failed to suggest AI layout.", details: error.message });
    }
  });

  // --- Vite Middleware (Development vs Production) ---

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`===================================================`);
    console.log(`🚀 Server successfully launched on http://localhost:${PORT}`);
    console.log(`⚙️  Running in ${process.env.NODE_ENV !== "production" ? "development" : "production"} mode`);
    console.log(`===================================================`);
  });
}

startServer();
