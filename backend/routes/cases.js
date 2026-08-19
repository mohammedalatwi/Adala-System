const express = require('express');
const router = express.Router();
const caseController = require('../controllers/caseController');
const authMiddleware = require('../middleware/auth');
const validationMiddleware = require('../middleware/validation');

// ✅ جميع routes تتطلب مصادقة
router.use(authMiddleware.requireAuth);

// ✅ Routes CRUD للقضايا
router.post('/',
    caseController.assignDefaultLawyer,
    validationMiddleware.validateCase,
    caseController.createCase
);

router.get('/', caseController.getAllCases);
router.get('/stats', caseController.getCaseStats);
router.get('/:id', caseController.getCaseById);
router.put('/:id',
    validationMiddleware.validateCaseUpdate,
    caseController.updateCase
);
router.delete('/:id', caseController.deleteCase);

module.exports = router;