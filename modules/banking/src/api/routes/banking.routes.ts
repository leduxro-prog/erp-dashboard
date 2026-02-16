import { Router } from 'express';
import multer from 'multer';
import { BankingController } from '../controllers/BankingController';
import { authenticate, requireRole } from '@shared/middleware/auth.middleware';

// Configure multer for file upload (memory storage for PDF processing)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    // Accept PDF files
    if (
      file.mimetype === 'application/pdf' ||
      file.mimetype === 'text/plain' ||
      file.originalname.endsWith('.pdf') ||
      file.originalname.endsWith('.txt')
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF or text files (.pdf, .txt) are allowed'));
    }
  },
});

export function createBankingRoutes(controller: BankingController): Router {
  const router = Router();

  // Apply authentication to all routes
  router.use(authenticate);

  // Apply admin role check to admin routes
  const adminOnly = requireRole(['admin']);

  // Bank Accounts
  router.get('/accounts', (req, res, next) => controller.listAccounts(req, res, next));
  router.post('/accounts', adminOnly, (req, res, next) => controller.createAccount(req, res, next));

  // Statement Import
  router.post('/statements/import', upload.single('file'), (req, res, next) => controller.importStatement(req, res, next));

  // Transactions
  router.get('/transactions', (req, res, next) => controller.listTransactions(req, res, next));

  // Payment Matching
  router.post('/matches/suggest', (req, res, next) => controller.suggestMatches(req, res, next));
  router.post('/matches/:matchId/confirm', (req, res, next) => controller.confirmMatch(req, res, next));
  router.post('/matches/:matchId/reject', (req, res, next) => controller.rejectMatch(req, res, next));

  return router;
}

export { BankingController };
