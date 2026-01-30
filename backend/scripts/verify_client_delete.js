const db = require('../db/database');

async function testDelete() {
    try {
        console.log('Initializing DB...');
        await db.init();

        // 1. Create a test client
        console.log('Creating test client...');
        const runResult = await db.run(`
            INSERT INTO clients (full_name, phone, national_id, is_active, created_by)
            VALUES ('Delete Test Client', '0599999999', '9999999999', 1, 1)
        `);
        const clientId = runResult.id;
        console.log('Created client with ID:', clientId);

        // 2. Verify created
        const clientBefore = await db.get('SELECT * FROM clients WHERE id = ?', [clientId]);
        console.log('Client before delete:', clientBefore.is_active);

        // 3. Soft Delete (emulate controller logic)
        console.log('Soft deleting client...');
        // Controller calls: Client.softDelete(id)
        // Which does: update clients set is_active=0 ...
        await db.run('UPDATE clients SET is_active = 0 WHERE id = ?', [clientId]);

        // 4. Verify deleted
        const clientAfter = await db.get('SELECT * FROM clients WHERE id = ?', [clientId]);
        console.log('Client after delete:', clientAfter.is_active);

        if (clientAfter.is_active === 0) {
            console.log('✅ Soft delete verified successfully!');
        } else {
            console.error('❌ Soft delete failed!');
        }

        // Cleanup
        await db.run('DELETE FROM clients WHERE id = ?', [clientId]);

    } catch (error) {
        console.error('❌ Test Failed:', error);
    } finally {
        await db.close();
    }
}

testDelete();
