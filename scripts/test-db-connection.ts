import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { sql } from 'drizzle-orm';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function testConnection() {
  console.log('🔄 Testing database connection...\n');
  
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not found in .env.local');
    return;
  }

  try {
    // Create connection
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const db = drizzle(pool);
    
    // Test 1: Check connection
    console.log('1️⃣ Testing basic connection...');
    const timeResult = await db.execute(sql`SELECT NOW() as current_time`);
    console.log('✅ Connected! Server time:', timeResult.rows[0].current_time);
    
    // Test 2: Check users table
    console.log('\n2️⃣ Checking users table...');
    const usersResult = await db.execute(sql`
      SELECT id, email, first_name, last_name, credits 
      FROM users 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    console.log(`✅ Found ${usersResult.rows.length} users:`);
    usersResult.rows.forEach((user: any) => {
      console.log(`   - ${user.email} (${user.first_name} ${user.last_name}) - Credits: ${user.credits}`);
    });
    
    // Test 3: Check videos table
    console.log('\n3️⃣ Checking videos table...');
    const videosResult = await db.execute(sql`
      SELECT COUNT(*) as count FROM videos WHERE is_active = true
    `);
    console.log(`✅ Found ${videosResult.rows[0].count} active videos`);
    
    // Test 4: Check daily stats
    console.log('\n4️⃣ Checking daily stats...');
    const statsResult = await db.execute(sql`
      SELECT COUNT(*) as count FROM "dailyStats"
    `);
    console.log(`✅ Found ${statsResult.rows[0].count} daily stat entries`);
    
    console.log('\n🎉 All tests passed! Database is working correctly.');
    
    await pool.end();
  } catch (error: any) {
    console.error('\n❌ Database test failed:', error.message);
    console.error('Error details:', error);
  }
}

// Run the test
testConnection();
