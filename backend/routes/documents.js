const express = require('express');
const router = express.Router();
const documentController = require('../controllers/documentController');
const authMiddleware = require('../middleware/auth');
const validationMiddleware = require('../middleware/validation');

// جميع routes تتطلب مصادقة
router.use(authMiddleware.requireAuth);

// Routes المستندات
router.post('/',
    validationMiddleware.sanitizeBody,
    documentController.createDocument
);

router.get('/', documentController.getAllDocuments);
router.get('/stats', documentController.getDocumentStats);
router.get('/:id', documentController.getDocumentById);
router.put('/:id',
    validationMiddleware.sanitizeBody,
    documentController.updateDocument
);
router.delete('/:id', documentController.deleteDocument);
router.get('/:id/download', documentController.downloadDocument);

module.exports = router;