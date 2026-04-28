const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const sqlite3 = require("sqlite3").verbose();

const app = express();
const PORT = 3000;

// Servir frontend
app.use(express.static("public"));

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
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueName = uuidv4() + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });

// Subir archivo
app.post("/upload", upload.single("file"), (req, res) => {
  const id = uuidv4().slice(0, 8);

  db.run(
    "INSERT INTO files (id, originalName, storedName) VALUES (?, ?, ?)",
    [id, req.file.originalname, req.file.filename]
  );

  const link = `http://localhost:${PORT}/file/${id}`;
  res.json({ link });
});

// Descargar archivo
app.get("/file/:id", (req, res) => {
  db.get("SELECT * FROM files WHERE id = ?", [req.params.id], (err, row) => {
    if (!row) {
      return res.status(404).send("Archivo no encontrado");
    }

    const filePath = path.join(__dirname, "uploads", row.storedName);
    res.download(filePath, row.originalName);
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor en http://localhost:${PORT}`);
});