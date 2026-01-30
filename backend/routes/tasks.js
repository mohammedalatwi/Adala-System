const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const authMiddleware = require('../middleware/auth');

// جميع المسارات تتطلب مصادقة
router.use(authMiddleware.requireAuth);

router.post('/', taskController.createTask);
router.get('/', taskController.getAllTasks);
router.get('/:id', taskController.getTaskById);
router.put('/:id', taskController.updateTask);
router.delete('/:id', taskController.deleteTask);

module.exports = router;
