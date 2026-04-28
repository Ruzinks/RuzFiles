const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const sqlite3 = require("sqlite3").verbose();

const app = express();
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

// Configuración subida
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

// Ruta principal
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Subir archivo
app.post("/upload", upload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No se subió archivo" });
    }

    const id = uuidv4().slice(0, 8);

    db.run(
      "INSERT INTO files (id, originalName, storedName) VALUES (?, ?, ?)",
      [id, req.file.originalname, req.file.filename]
    );

    // 🔥 Link público correcto
    const link = `${req.protocol}://${req.get("host")}/file/${id}`;

    res.json({ success: true, link });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al subir archivo" });
  }
});

// Descargar archivo
app.get("/file/:id", (req, res) => {
  db.get("SELECT * FROM files WHERE id = ?", [req.params.id], (err, row) => {

    if (err) {
      console.error(err);
      return res.status(500).send("Error del servidor");
    }

    if (!row) {
      return res.status(404).send("Archivo no encontrado");
    }

    const filePath = path.join(uploadDir, row.storedName);

    console.log("Intentando descargar:", filePath);

    if (!fs.existsSync(filePath)) {
      return res.status(404).send("Archivo no existe en el servidor");
    }

    res.download(filePath, row.originalName, (err) => {
      if (err) {
        console.error("Error al descargar:", err);
      }
    });
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
