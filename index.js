const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const sqlite3 = require("sqlite3").verbose();

const app = express();

// ⚠️ IMPORTANTE para Render
const PORT = process.env.PORT || 3000;

// Servir frontend
app.use(express.static(path.join(__dirname, "public")));

// Crear carpeta uploads si no existe
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Base de datos
const db = new sqlite3.Database("files.db");

db.run(`
CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  originalName TEXT,
  storedName TEXT
)
`);

// Configuración de subida
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = uuidv4() + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });

// 🔥 Ruta principal (evita "Cannot GET /")
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// 📤 Subir archivo
app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No se subió archivo" });
  }

  const id = uuidv4().slice(0, 8);

  db.run(
    "INSERT INTO files (id, originalName, storedName) VALUES (?, ?, ?)",
    [id, req.file.originalname, req.file.filename]
  );

  // 🔥 LINK REAL (NO localhost)
  const link = `${req.protocol}://${req.get("host")}/file/${id}`;

  res.json({ link });
});

// 📥 Descargar archivo
app.get("/file/:id", (req, res) => {
  db.get("SELECT * FROM files WHERE id = ?", [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).send("Error del servidor");
    }

    if (!row) {
      return res.status(404).send("Archivo no encontrado");
    }

    const filePath = path.join(uploadDir, row.storedName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).send("Archivo no existe en el servidor");
    }

    res.download(filePath, row.originalName);
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor en puerto ${PORT}`);
});
