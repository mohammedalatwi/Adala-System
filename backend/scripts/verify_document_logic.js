const db = require('../db/database');

async function testDocumentSoftDelete() {
    try {
        console.log('Initializing DB...');
        await db.init();

        // 1. Create a test document
        console.log('Creating test document...');
        const runResult = await db.run(`
            INSERT INTO documents (title, description, document_type, file_name, file_path, is_active, uploaded_by)
            VALUES ('Soft Delete Test Doc', 'Testing soft delete', 'contract', 'test.pdf', '/tmp/test.pdf', 1, 1)
        `);
        const docId = runResult.id;
        console.log('Created document with ID:', docId);

        // 2. Verify visibility in "getAll" query
        const docsVisible = await db.all(`SELECT * FROM documents WHERE id = ? AND is_active = 1`, [docId]);
        if (docsVisible.length === 1) {
            console.log('✅ Document visible before delete');
        } else {
            console.error('❌ Document NOT visible before delete');
        }

        // 3. Soft Delete (emulating controller update)
        console.log('Soft deleting document...');
        await db.run('UPDATE documents SET is_active = 0 WHERE id = ?', [docId]);

        // 4. Verify NOT visible in "getAll" query
        const docsAfter = await db.all(`SELECT * FROM documents WHERE id = ? AND is_active = 1`, [docId]);
        if (docsAfter.length === 0) {
            console.log('✅ Document hidden after delete (Soft Delete working)');
        } else {
            console.error('❌ Document STILL visible after delete!');
        }

        // 5. Verify physical record still exists
        const docRecord = await db.get(`SELECT * FROM documents WHERE id = ?`, [docId]);
        if (docRecord && docRecord.is_active === 0) {
            console.log('✅ Physical record exists with is_active = 0');
        } else {
            console.error('❌ Physical record missing or wrong status');
        }

        // Cleanup
        await db.run('DELETE FROM documents WHERE id = ?', [docId]);

    } catch (error) {
        console.error('❌ Test Failed:', error);
    } finally {
        await db.close();
    }
}

testDocumentSoftDelete();
