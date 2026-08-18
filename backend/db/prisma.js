const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const tenantStorage = require('../utils/tenantStorage');

let basePrisma;

if (process.env.NODE_ENV === 'production') {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  basePrisma = new PrismaClient({ adapter });
} else {
  // Prevent multiple instances of Prisma Client in development
  if (!global.basePrisma) {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaPg(pool);
    global.basePrisma = new PrismaClient({ adapter });
  }
  basePrisma = global.basePrisma;
}

// Extend Prisma Client to automatically filter and inject tenantId
const prisma = basePrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const context = tenantStorage.getStore();
        const tenantId = context ? context.tenantId : null;

        if (tenantId) {
          // List of models that have a tenantId field (multi-tenant tables)
          const multiTenantModels = [
            'User', 'Client', 'Case', 'Session', 'Task', 
            'ConflictCheckParty', 'TimeEntry', 'Invoice', 
            'Payment', 'SentNotification', 'Document', 'AuditLog'
          ];

          if (multiTenantModels.includes(model)) {
            // 1. Inject tenantId filter for all read/update/delete operations
            args.where = args.where || {};
            args.where.tenantId = tenantId;

            // 2. Inject tenantId values for write operations
            if (operation === 'create') {
              args.data = args.data || {};
              args.data.tenantId = tenantId;
            } else if (operation === 'createMany') {
              if (Array.isArray(args.data)) {
                args.data.forEach(item => {
                  item.tenantId = tenantId;
                });
              } else if (args.data) {
                args.data.tenantId = tenantId;
              }
            }
          }
        }

        return query(args);
      }
    }
  }
});

module.exports = prisma;
