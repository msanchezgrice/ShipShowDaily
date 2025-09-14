import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { sql } from 'drizzle-orm';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not found in environment');
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle({ client: pool });

async function checkData() {
  console.log('Checking placeholder data...');

  // Check users
  const users = await db.execute(sql`SELECT id, email FROM users ORDER BY created_at DESC LIMIT 10`);
  console.log('\nUsers in database:');
  users.rows.forEach((u: any) => console.log(`  - ID: ${u.id}, Email: ${u.email}`));

  // Check videos
  const videos = await db.execute(sql`SELECT id, title, creator_id FROM videos LIMIT 5`);
  console.log('\nVideos in database:');
  videos.rows.forEach((v: any) => console.log(`  - ${v.title} (creator: ${v.creator_id})`));

  // Check for orphaned videos
  const orphaned = await db.execute(sql`
    SELECT v.id, v.title, v.creator_id 
    FROM videos v 
    LEFT JOIN users u ON v.creator_id = u.id 
    WHERE u.id IS NULL
  `);
  console.log(`\nOrphaned videos (no matching user): ${orphaned.rows.length}`);
  if (orphaned.rows.length > 0) {
    orphaned.rows.forEach((v: any) => console.log(`  - ${v.title} (creator: ${v.creator_id})`));
  }

  // Fix orphaned videos by creating placeholder users or updating to a real user
  if (orphaned.rows.length > 0) {
    console.log('\nFixing orphaned videos...');
    
    // Get the first real user or create one
    const realUser = users.rows[0];
    if (realUser) {
      console.log(`Updating orphaned videos to use user: ${realUser.email}`);
      await db.execute(sql`
        UPDATE videos 
        SET creator_id = ${realUser.id}
        WHERE creator_id NOT IN (SELECT id FROM users)
      `);
      console.log('✅ Updated orphaned videos');
    } else {
      console.log('No real users found. Please sign up first.');
    }
  }

  pool.end();
}

checkData().catch(console.error);
