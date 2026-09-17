// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
import {sqliteTable,integer,text} from 'drizzle-orm/sqlite-core';
export const household=sqliteTable('household',{id:integer('id').primaryKey(),data:text('data').notNull(),revision:integer('revision').notNull().default(0)});
