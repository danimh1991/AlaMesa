import {sqliteTable,integer,text} from 'drizzle-orm/sqlite-core';
export const household=sqliteTable('household',{id:integer('id').primaryKey(),data:text('data').notNull(),revision:integer('revision').notNull().default(0)});
export const appState=sqliteTable('app_state',{id:integer('id').primaryKey(),revision:integer('revision').notNull().default(0),settings:text('settings').notNull(),writeToken:text('write_token')});
export const dishChanges=sqliteTable('dish_changes',{dishId:integer('dish_id').primaryKey(),kind:text('kind',{enum:['override','added','deleted']}).notNull(),data:text('data')});
export const menus=sqliteTable('menus',{month:text('month').primaryKey(),data:text('data').notNull()});
export const availableFood=sqliteTable('available_food',{id:text('id').primaryKey(),data:text('data').notNull()});
export const shoppingState=sqliteTable('shopping_state',{id:integer('id').primaryKey(),data:text('data').notNull()});
export const discoveryState=sqliteTable('discovery_state',{id:integer('id').primaryKey(),data:text('data').notNull()});
