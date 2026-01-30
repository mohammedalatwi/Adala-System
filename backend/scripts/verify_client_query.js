const db = require('../db/database');
const config = require('../config/config');

async function testQuery() {
    try {
        console.log('Initializing DB...');
        await db.init();
        console.log('DB Initialized.');

        console.log('Testing getAllClients Query with STRING limit...');
        const limit = "10";
        const offset = 0;
        const params = [];

        // Emulating the controller query
        const clients = await db.all(`
            SELECT 
                c.*,
                u.full_name as created_by_name,
                (SELECT COUNT(*) FROM cases WHERE client_id = c.id) as cases_count
            FROM clients c
            LEFT JOIN users u ON c.created_by = u.id
            WHERE c.is_active = 1
            ORDER BY c.created_at DESC
            LIMIT ? OFFSET ?
        `, [...params, limit, offset]);

        console.log('Query Successful!');
        console.log('Result Count:', clients.length);
        if (clients.length > 0) {
            console.log('First Client:', clients[0]);
        }

        console.log('Testing Count Query...');
        const totalResult = await db.get(`
            SELECT COUNT(*) as total 
            FROM clients c
            WHERE c.is_active = 1
        `, params);
        console.log('Count Result:', totalResult);

    } catch (error) {
        console.error('❌ Query Failed:', error);
    } finally {
        await db.close();
    }
}

testQuery();
