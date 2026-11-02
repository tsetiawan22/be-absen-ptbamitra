import multer from "multer";
import path from "path";
import fs from "fs";

const ALLOWED_TYPES = ["image/jpeg", "image/png"];
const MAX_SIZE = 3 * 1024 * 1024; // 3 MB

function makeStorage(subdir: string) {
  const dest = path.join(__dirname, "../../../uploads", subdir);
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });

  return multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dest),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
    },
  });
}

const fileFilter = (_req: any, file: any, cb: any) => {
  if (ALLOWED_TYPES.includes(file.mimetype)) cb(null, true);
  else cb(new Error("Hanya file JPEG/PNG yang diizinkan"), false);
};

export const multerWajahOptions = {
  storage: makeStorage("wajah"),
  fileFilter,
  limits: { fileSize: MAX_SIZE },
};

export const multerAbsenOptions = {
  storage: makeStorage("absen"),
  fileFilter,
  limits: { fileSize: MAX_SIZE },
};

export const uploadWajah = multer(multerWajahOptions);
export const uploadAbsen = multer(multerAbsenOptions);
