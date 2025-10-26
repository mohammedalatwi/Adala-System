const express = require('express');
const router = express.Router();
const clientController = require('../controllers/clientController');
const authMiddleware = require('../middleware/auth');
const validationMiddleware = require('../middleware/validation');

// جميع routes تتطلب مصادقة
router.use(authMiddleware.requireAuth);

// Routes العملاء
router.post('/',
    validationMiddleware.sanitizeBody,
    clientController.createClient
);

router.get('/', clientController.getAllClients);
router.get('/stats', clientController.getClientStats);
router.get('/:id', clientController.getClientById);
router.put('/:id',
    validationMiddleware.sanitizeBody,
    clientController.updateClient
);
router.delete('/:id', clientController.deleteClient);

module.exports = router;