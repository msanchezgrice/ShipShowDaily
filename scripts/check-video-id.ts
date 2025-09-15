import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";
import { sql, eq } from "drizzle-orm";
import { videos, videoViews, creditTransactions, videoViewingSessions, videoTags, tags, users } from "../shared/schema";

async function checkVideoId() {
  const databaseUrl = process.env.DATABASE_URL;
  const videoId = "f1d111cb-a6ac-4abd-9be2-43b6cc119412";
  
  if (!databaseUrl) {
    console.error("❌ DATABASE_URL environment variable is not set");
    console.log("\n📝 To run this script, you need to:");
    console.log("   1. Create a .env file in the project root");
    console.log("   2. Add your DATABASE_URL from your PostgreSQL provider (Neon, Supabase, etc.)");
    console.log("   3. Run the script again");
    console.log("\nExample .env file:");
    console.log("DATABASE_URL=postgresql://username:password@host:port/database?sslmode=require");
    process.exit(1);
  }

  console.log("🔍 Checking for video ID:", videoId);

  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool);

  try {
    // Test connection
    const result = await db.execute(sql`SELECT NOW()`);
    console.log("✅ Database connection successful!");

    // Check if video exists
    console.log("\n1️⃣ Checking if video exists...");
    const video = await db.select().from(videos).where(eq(videos.id, videoId));
    
    if (video.length === 0) {
      console.log("❌ Video NOT FOUND in database");
      
      // Show some existing videos for context
      console.log("\n📊 Sample of existing videos:");
      const sampleVideos = await db.select({ 
        id: videos.id,
        title: videos.title,
        createdAt: videos.createdAt
      }).from(videos).limit(10);
      
      sampleVideos.forEach(v => {
        console.log(`   - ${v.id}: ${v.title} (created: ${v.createdAt})`);
      });
      
      return;
    }
    
    // Video found - show details
    console.log("✅ Video FOUND!");
    const v = video[0];
    console.log("\n📹 Video Details:");
    console.log(`   ID: ${v.id}`);
    console.log(`   Title: ${v.title}`);
    console.log(`   Description: ${v.description}`);
    console.log(`   Creator ID: ${v.creatorId}`);
    console.log(`   Product URL: ${v.productUrl}`);
    console.log(`   Video Path: ${v.videoPath}`);
    console.log(`   Thumbnail Path: ${v.thumbnailPath}`);
    console.log(`   Total Views: ${v.totalViews}`);
    console.log(`   Is Active: ${v.isActive}`);
    console.log(`   Provider: ${v.provider}`);
    console.log(`   Status: ${v.status}`);
    console.log(`   Created At: ${v.createdAt}`);
    console.log(`   Updated At: ${v.updatedAt}`);
    
    // Get creator info
    console.log("\n2️⃣ Creator Information:");
    const creator = await db.select().from(users).where(eq(users.id, v.creatorId));
    if (creator.length > 0) {
      const c = creator[0];
      console.log(`   Name: ${c.firstName} ${c.lastName}`);
      console.log(`   Email: ${c.email}`);
      console.log(`   Credits: ${c.credits}`);
    }
    
    // Check video views
    console.log("\n3️⃣ Video Views:");
    const viewCount = await db.select({ count: sql<number>`count(*)` })
      .from(videoViews)
      .where(eq(videoViews.videoId, videoId));
    console.log(`   Total view records: ${viewCount[0].count}`);
    
    // Check viewing sessions
    console.log("\n4️⃣ Viewing Sessions:");
    const sessionCount = await db.select({ count: sql<number>`count(*)` })
      .from(videoViewingSessions)
      .where(eq(videoViewingSessions.videoId, videoId));
    console.log(`   Total viewing sessions: ${sessionCount[0].count}`);
    
    // Check tags
    console.log("\n5️⃣ Video Tags:");
    const videoTagsData = await db.select({
      tagName: tags.name
    })
    .from(videoTags)
    .innerJoin(tags, eq(videoTags.tagId, tags.id))
    .where(eq(videoTags.videoId, videoId));
    
    if (videoTagsData.length > 0) {
      console.log(`   Tags: ${videoTagsData.map(t => t.tagName).join(', ')}`);
    } else {
      console.log(`   No tags assigned`);
    }
    
    // Check credit transactions
    console.log("\n6️⃣ Credit Transactions:");
    const creditTxCount = await db.select({ count: sql<number>`count(*)` })
      .from(creditTransactions)
      .where(eq(creditTransactions.videoId, videoId));
    console.log(`   Related credit transactions: ${creditTxCount[0].count}`);

  } catch (error) {
    console.error("❌ Database error:", error);
  } finally {
    await pool.end();
  }
}

// Run the check
checkVideoId().catch(console.error);