import multer from "multer";
import { AppError } from "./appError.js";

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
]);

const storage = multer.memoryStorage();

export const uploadMiddleware = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
  fileFilter(_req, file, callback) {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      callback(new AppError("Only PDF, JPG and PNG files up to 20 MB are allowed.", 400, "INVALID_FILE_TYPE"));
      return;
    }
    callback(null, true);
  },
});

const SPREADSHEET_EXTENSIONS = /\.(xlsx|xlsm)$/i;

/** Excel workbooks for register imports. Browsers report .xlsm inconsistently, so the extension is checked. */
export const spreadsheetUploadMiddleware = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
  fileFilter(_req, file, callback) {
    if (!SPREADSHEET_EXTENSIONS.test(file.originalname)) {
      callback(new AppError("Upload an Excel workbook (.xlsx or .xlsm) up to 20 MB.", 400, "INVALID_FILE_TYPE"));
      return;
    }
    callback(null, true);
  },
});

const POLICY_DOCUMENT_EXTENSIONS = /\.(pdf|docx|doc)$/i;

/** Policy and procedure documents (PDF or Word). */
export const policyDocumentUploadMiddleware = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
  fileFilter(_req, file, callback) {
    if (!POLICY_DOCUMENT_EXTENSIONS.test(file.originalname)) {
      callback(new AppError("Upload the policy as a PDF or Word document (.pdf, .docx, .doc) up to 20 MB.", 400, "INVALID_FILE_TYPE"));
      return;
    }
    callback(null, true);
  },
});

const EVIDENCE_EXTENSIONS = /\.(pdf|docx|doc|xlsx|xlsm|xls|jpg|jpeg|png|msg|eml)$/i;

/** SQM evidence: documents, spreadsheets, images or saved emails. */
export const evidenceUploadMiddleware = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
  fileFilter(_req, file, callback) {
    if (!EVIDENCE_EXTENSIONS.test(file.originalname)) {
      callback(
        new AppError("Attach a PDF, Word, Excel, image (JPG/PNG) or saved email (.msg/.eml) up to 20 MB.", 400, "INVALID_FILE_TYPE"),
      );
      return;
    }
    callback(null, true);
  },
});

const REVIEW_DOCUMENT_EXTENSIONS = /\.(pdf|docx|txt|md)$/i;

/** Documents for AI review: text must be extractable, so PDF, Word (.docx) or plain text. */
export const reviewDocumentUploadMiddleware = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
  fileFilter(_req, file, callback) {
    if (!REVIEW_DOCUMENT_EXTENSIONS.test(file.originalname)) {
      callback(new AppError("Upload a PDF, Word (.docx) or text file up to 20 MB. Save older .doc files as .docx first.", 400, "INVALID_FILE_TYPE"));
      return;
    }
    callback(null, true);
  },
});
