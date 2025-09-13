import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import { users, videos, tags, dailyStats } from "../shared/schema";

async function checkDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error("❌ DATABASE_URL environment variable is not set");
    process.exit(1);
  }

  console.log("🔍 Checking database connection...");
  console.log(`📍 Database: ${databaseUrl.split('@')[1]?.split('/')[0] || 'unknown'}`);

  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool);

  try {
    // Test connection
    console.log("\n1️⃣ Testing connection...");
    const result = await db.execute(sql`SELECT NOW()`);
    console.log("✅ Connection successful!");

    // Check if tables exist
    console.log("\n2️⃣ Checking tables...");
    const tables = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    if (tables.rows.length === 0) {
      console.log("⚠️  No tables found! You need to run migrations.");
      console.log("   Run: npm run db:push");
    } else {
      console.log(`✅ Found ${tables.rows.length} tables:`);
      tables.rows.forEach((row: any) => {
        console.log(`   - ${row.table_name}`);
      });
    }

    // Check users
    console.log("\n3️⃣ Checking users...");
    const userCount = await db.select({ count: sql<number>`count(*)` }).from(users);
    console.log(`   Found ${userCount[0].count} users`);
    
    // Get first few users
    const sampleUsers = await db.select({ 
      id: users.id, 
      email: users.email,
      firstName: users.firstName,
      credits: users.credits
    }).from(users).limit(5);
    
    if (sampleUsers.length > 0) {
      console.log("   Sample users:");
      sampleUsers.forEach(user => {
        console.log(`   - ${user.id}: ${user.email || 'no email'} (${user.credits} credits)`);
      });
    }

    // Check videos
    console.log("\n4️⃣ Checking videos...");
    const videoCount = await db.select({ count: sql<number>`count(*)` }).from(videos);
    console.log(`   Found ${videoCount[0].count} videos`);
    
    if (videoCount[0].count > 0) {
      const sampleVideos = await db.select({ 
        id: videos.id,
        title: videos.title,
        creatorId: videos.creatorId,
        isActive: videos.isActive
      }).from(videos).limit(5);
      
      console.log("   Sample videos:");
      sampleVideos.forEach(video => {
        console.log(`   - ${video.title} (by ${video.creatorId}, active: ${video.isActive})`);
      });
    }

    // Check tags
    console.log("\n5️⃣ Checking tags...");
    const tagCount = await db.select({ count: sql<number>`count(*)` }).from(tags);
    console.log(`   Found ${tagCount[0].count} tags`);

    // Check today's stats
    console.log("\n6️⃣ Checking today's stats...");
    const today = new Date().toISOString().split('T')[0];
    const todayStats = await db.select({ count: sql<number>`count(*)` })
      .from(dailyStats)
      .where(sql`date = ${today}`);
    console.log(`   Found ${todayStats[0].count} stats entries for today`);

    // Summary
    console.log("\n📊 Summary:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`✅ Database connected`);
    console.log(`📋 Tables: ${tables.rows.length}`);
    console.log(`👤 Users: ${userCount[0].count}`);
    console.log(`🎥 Videos: ${videoCount[0].count}`);
    console.log(`🏷️  Tags: ${tagCount[0].count}`);
    
    if (userCount[0].count === 0) {
      console.log("\n⚠️  No users found! You need to:");
      console.log("   1. Sign up on your app to create a user");
      console.log("   2. Then run the seed script with that user's ID");
    }
    
    if (videoCount[0].count === 0 && userCount[0].count > 0) {
      console.log("\n⚠️  No videos found but users exist!");
      console.log("   You can run the seed script now:");
      console.log(`   DEMO_USER_ID=${sampleUsers[0]?.id} npm run seed:demos`);
    }

  } catch (error) {
    console.error("❌ Database error:", error);
    console.log("\n🔧 Troubleshooting:");
    console.log("   1. Check DATABASE_URL is correct");
    console.log("   2. Check database is not paused (Neon pauses after inactivity)");
    console.log("   3. Try running: npm run db:push");
  } finally {
    await pool.end();
  }
}

// Run the check
checkDatabase().catch(console.error);
