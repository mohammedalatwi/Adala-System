const express = require('express');
const router = express.Router();
const CalendarController = require('../controllers/calendarController');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware.requireAuth);

router.get('/events', CalendarController.getEvents);

module.exports = router;
