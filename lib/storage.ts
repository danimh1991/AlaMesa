import {env} from 'cloudflare:workers';
import {initialState,type State} from './menu';
export function database(){if(!env.DB)throw new Error('Database unavailable');return env.DB}
export async function readState(){const row=await database().prepare('SELECT data, revision FROM household WHERE id = 1').first<{data:string;revision:number}>();return row?{state:JSON.parse(row.data) as State,revision:row.revision}:{state:initialState(),revision:0}}
export async function saveState(state:State,revision:number){const result=await database().prepare('INSERT INTO household (id,data,revision) VALUES (1,?,1) ON CONFLICT(id) DO UPDATE SET data=excluded.data,revision=household.revision+1 WHERE household.revision=?').bind(JSON.stringify(state),revision).run();if(result.meta.changes!==1)throw new Error('CONFLICT');return revision+1}
