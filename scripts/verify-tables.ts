import { db } from "../server/db";
import {
  users,
  videos,
  videoViews,
  videoViewingSessions,
  videoFavorites,
  demoLinkClicks,
  tags,
  videoTags,
  dailyStats,
  creditTransactions
} from "@shared/schema";
import { sql } from "drizzle-orm";

async function verifyTables() {
  console.log("🔍 Verifying database tables...\n");

  try {
    // Test each table
    console.log("📊 Checking tables:");

    // Users
    const userCount = await db.select({ count: sql<number>`count(*)` }).from(users);
    console.log(`✅ users table: ${userCount[0].count} records`);

    // Videos
    const videoCount = await db.select({ count: sql<number>`count(*)` }).from(videos);
    console.log(`✅ videos table: ${videoCount[0].count} records`);

    // Video Views
    const viewCount = await db.select({ count: sql<number>`count(*)` }).from(videoViews);
    console.log(`✅ video_views table: ${viewCount[0].count} records`);

    // Video Viewing Sessions
    const sessionCount = await db.select({ count: sql<number>`count(*)` }).from(videoViewingSessions);
    console.log(`✅ video_viewing_sessions table: ${sessionCount[0].count} records`);

    // Video Favorites
    const favoriteCount = await db.select({ count: sql<number>`count(*)` }).from(videoFavorites);
    console.log(`✅ video_favorites table: ${favoriteCount[0].count} records`);

    // Demo Link Clicks
    const clickCount = await db.select({ count: sql<number>`count(*)` }).from(demoLinkClicks);
    console.log(`✅ demo_link_clicks table: ${clickCount[0].count} records`);

    // Tags
    const tagCount = await db.select({ count: sql<number>`count(*)` }).from(tags);
    console.log(`✅ tags table: ${tagCount[0].count} records`);

    // Video Tags
    const videoTagCount = await db.select({ count: sql<number>`count(*)` }).from(videoTags);
    console.log(`✅ video_tags table: ${videoTagCount[0].count} records`);

    // Daily Stats
    const statsCount = await db.select({ count: sql<number>`count(*)` }).from(dailyStats);
    console.log(`✅ daily_stats table: ${statsCount[0].count} records`);

    // Credit Transactions
    const transactionCount = await db.select({ count: sql<number>`count(*)` }).from(creditTransactions);
    console.log(`✅ credit_transactions table: ${transactionCount[0].count} records`);

    console.log("\n✨ All tables verified successfully!");

  } catch (error) {
    console.error("\n❌ Error verifying tables:", error);
    process.exit(1);
  }
}

verifyTables()
  .then(() => {
    console.log("\n✅ Database verification complete");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  });