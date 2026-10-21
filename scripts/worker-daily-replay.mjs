// Restored-production replay ONLY. No provider networking and no synthetic prices.
import pg from 'pg';
import {runWorker} from '../dist/worker.js';
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
try {
 const db=(await pool.query('SELECT current_database() name,current_user role')).rows[0];
 if(!db.name.startsWith('radar_test_daily_preview_') || db.role!=='radar_app') throw Error('Replay requires isolated restored DB and runtime non-owner');
 const at=Date.parse(process.env.REPLAY_AT??''); if(!Number.isFinite(at)) throw Error('REPLAY_AT required');
 const result=await runWorker(pool,{
  now:()=>at,
  fetchChart:async symbol=>{
    const row=(await pool.query("SELECT id,payload FROM market_fetches WHERE symbol=$1 AND interval='1d' AND source LIKE '%range=6mo%' AND fetched_at<=$2 ORDER BY fetched_at DESC LIMIT 1",[symbol,new Date(at).toISOString()])).rows[0];
    if(!row) throw Error('Replay has no authentic archived provider evidence: '+symbol);
    return {id:row.id,chart:row.payload,cache:true};
  },
 });
 console.log(JSON.stringify({...result,replay_at:new Date(at).toISOString(),source_mode:'authentic snapshot archives only; supplemental endpoint disabled; no network'}));
 process.exitCode=result.exitCode;
} finally {await pool.end()}
