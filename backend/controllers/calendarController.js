const CalendarService = require('../services/CalendarService');
const BaseController = require('../utils/BaseController');

class CalendarController extends BaseController {
    getEvents = this.asyncWrapper(async (req, res) => {
        const { start, end } = req.query;
        const { userId, userRole, officeId } = req.session;

        if (!start || !end) {
            return this.sendError(res, 'تاريخ البدء والنهاية مطلوبان', 400);
        }

        const events = await CalendarService.getEvents(userId, userRole, officeId, start, end);
        this.sendSuccess(res, events);
    });
}

module.exports = new CalendarController();
