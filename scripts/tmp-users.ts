import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { closePool, getDb } from '../server/db/client.js';

const db = getDb();
const deleted = await db.execute(sql`
  delete from users
  where email like 'desactivado-%@zorzallirio.local'
     or email like 'intruso-%@zorzallirio.local'
  returning email
`);
console.log('borrados:', (deleted.rows ?? deleted).length);
const left = await db.execute(sql`select name, email, is_active from users order by name`);
console.table(left.rows ?? left);
await closePool();
