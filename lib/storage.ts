import {env} from 'cloudflare:workers';
import {initialState,normalizeSettings,type State} from './menu';
export function database(){if(!env.DB)throw new Error('Database unavailable');return env.DB}
export async function readState(){const row=await database().prepare('SELECT data, revision FROM household WHERE id = 1').first<{data:string;revision:number}>();return row?{state:normalizeState(JSON.parse(row.data) as State),revision:row.revision}:{state:initialState(),revision:0}}
export async function saveState(state:State,revision:number){const serialized=JSON.stringify(state);if(new TextEncoder().encode(serialized).length>1800000)throw new Error('El catálogo y el histórico superan el espacio disponible para este formato. Exporta una copia y reduce el tamaño antes de guardar.');const result=await database().prepare('INSERT INTO household (id,data,revision) VALUES (1,?,1) ON CONFLICT(id) DO UPDATE SET data=excluded.data,revision=household.revision+1 WHERE household.revision=?').bind(serialized,revision).run();if(result.meta.changes!==1)throw new Error('CONFLICT');return revision+1}

function normalizeState(state:State){state.settings=normalizeSettings(state.settings);for(const menu of Object.values(state.menus))menu.settings=normalizeSettings(menu.settings);return state}
