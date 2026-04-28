const express = require("express");
const multer = require("multer");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const sqlite3 = require("sqlite3").verbose();
const admin = require("firebase-admin");

const app = express();
const PORT = process.env.PORT || 3000;

// 🔑 Firebase config
const serviceAccount = require("./firebase-key.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: "ruzfiles-6aec0.appspot.com"
});

const bucket = admin.storage().bucket();

// Base de datos
const db = new sqlite3.Database("files.db");

db.run(`
CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  originalName TEXT,
  url TEXT
)
`);

// Multer (memoria)
const upload = multer({ storage: multer.memoryStorage() });

// Servir frontend
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// 📤 SUBIR ARCHIVO A FIREBASE
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file" });
    }

    const id = uuidv4().slice(0, 8);
    const fileName = Date.now() + "-" + req.file.originalname;

    const file = bucket.file(fileName);

    const stream = file.createWriteStream({
      metadata: {
        contentType: req.file.mimetype
      }
    });

    stream.end(req.file.buffer);

    stream.on("finish", async () => {
      // Hacer público
      await file.makePublic();

      const url = `https://storage.googleapis.com/${bucket.name}/${fileName}`;

      db.run(
        "INSERT INTO files (id, originalName, url) VALUES (?, ?, ?)",
        [id, req.file.originalname, url]
      );

      res.json({
        success: true,
        link: `${req.protocol}://${req.get("host")}/download/${id}`
      });
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error upload" });
  }
});

// 📄 PÁGINA DE DESCARGA PRO
app.get("/download/:id", (req, res) => {
  db.get("SELECT * FROM files WHERE id = ?", [req.params.id], (err, row) => {

    if (!row) return res.send("Archivo no encontrado");

    res.send(`
      <html>
        <head>
          <title>${row.originalName}</title>
          <style>
            body { font-family: Arial; text-align: center; background: #0f172a; color: white; }
            .box { margin-top: 100px; }
            a { display: inline-block; padding: 15px 25px; background: #38bdf8; color: black; border-radius: 10px; text-decoration: none; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="box">
            <h1>${row.originalName}</h1>
            <a href="${row.url}" download>⬇️ Descargar</a>
          </div>
        </body>
      </html>
    `);
  });
});

app.listen(PORT, () => {
  console.log("Servidor listo");
});