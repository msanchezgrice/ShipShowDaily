import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { sql } from 'drizzle-orm';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function addTestUser() {
  console.log('🔄 Adding a test Clerk user to database...\n');
  
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not found in .env.local');
    return;
  }

  try {
    // Create connection
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const db = drizzle(pool);
    
    // You'll need to replace this with your actual Clerk user ID
    // You can find it in the Clerk dashboard or from the browser console
    const CLERK_USER_ID = 'user_2q7example'; // REPLACE THIS WITH YOUR ACTUAL CLERK USER ID
    
    console.log('Creating/updating user with Clerk ID:', CLERK_USER_ID);
    
    // Upsert the user (insert or update if exists)
    const result = await db.execute(sql`
      INSERT INTO users (
        id, 
        email, 
        first_name, 
        last_name, 
        profile_image_url,
        credits,
        total_credits_earned
      ) VALUES (
        ${CLERK_USER_ID},
        'your-email@example.com',  -- Replace with your actual email
        'Your',  -- Replace with your first name
        'Name',  -- Replace with your last name
        '',
        10,
        0
      )
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `);
    
    console.log('✅ User created/updated:', result.rows[0]);
    
    // Check the user was created
    const checkResult = await db.execute(sql`
      SELECT * FROM users WHERE id = ${CLERK_USER_ID}
    `);
    
    if (checkResult.rows.length > 0) {
      console.log('\n✅ User exists in database:');
      console.log(checkResult.rows[0]);
    }
    
    await pool.end();
    
    console.log('\n📝 To find your actual Clerk user ID:');
    console.log('1. Go to https://www.shipshow.io');
    console.log('2. Sign in with Clerk');
    console.log('3. Open browser DevTools (F12)');
    console.log('4. Go to the Console tab');
    console.log('5. Type: localStorage.getItem("clerk-db-jwt-__clerk_db_jwt")');
    console.log('6. The user ID will be in the "sub" field of the decoded token');
    console.log('\nOR check the Network tab for /api/auth/user-simple requests');
    
  } catch (error: any) {
    console.error('\n❌ Failed to add user:', error.message);
    console.error('Error details:', error);
  }
}

// Run the script
addTestUser();
