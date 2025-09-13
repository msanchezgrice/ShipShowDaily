import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";
import { videos, tags, videoTags, dailyStats } from "../shared/schema";
import { sql } from "drizzle-orm";

// Sample video data
const sampleDemos = [
  {
    title: "TaskFlow - AI-Powered Project Management",
    description: "Revolutionary project management tool that uses AI to automatically organize tasks, predict bottlenecks, and suggest optimal team workflows. Features smart automation and real-time collaboration.",
    productUrl: "https://example.com/taskflow",
    videoPath: "https://storage.googleapis.com/sample-bucket/demo1.mp4",
    thumbnailPath: "https://storage.googleapis.com/sample-bucket/thumb1.jpg",
    tags: ["AI", "Productivity", "SaaS", "Project Management"]
  },
  {
    title: "CodeSnap - Instant Code Reviews with AI",
    description: "Get instant, intelligent code reviews powered by GPT-4. CodeSnap analyzes your pull requests, suggests improvements, and catches bugs before they reach production.",
    productUrl: "https://example.com/codesnap",
    videoPath: "https://storage.googleapis.com/sample-bucket/demo2.mp4",
    thumbnailPath: "https://storage.googleapis.com/sample-bucket/thumb2.jpg",
    tags: ["Developer Tools", "AI", "Code Review", "DevOps"]
  },
  {
    title: "DataViz Pro - Beautiful Analytics Dashboards",
    description: "Create stunning, interactive data visualizations in seconds. Connect any data source and build custom dashboards with our drag-and-drop interface. No coding required.",
    productUrl: "https://example.com/dataviz",
    videoPath: "https://storage.googleapis.com/sample-bucket/demo3.mp4",
    thumbnailPath: "https://storage.googleapis.com/sample-bucket/thumb3.jpg",
    tags: ["Analytics", "Data Visualization", "Business Intelligence", "No-Code"]
  },
  {
    title: "ChatBot Builder - Custom AI Assistants",
    description: "Build and deploy custom AI chatbots for your website in minutes. Train on your data, customize personality, and integrate with popular platforms seamlessly.",
    productUrl: "https://example.com/chatbot",
    videoPath: "https://storage.googleapis.com/sample-bucket/demo4.mp4",
    thumbnailPath: "https://storage.googleapis.com/sample-bucket/thumb4.jpg",
    tags: ["AI", "Chatbots", "Customer Support", "Automation"]
  },
  {
    title: "DesignAI - Automated Graphic Design",
    description: "Generate professional designs instantly with AI. From logos to social media posts, DesignAI creates beautiful graphics tailored to your brand in seconds.",
    productUrl: "https://example.com/designai",
    videoPath: "https://storage.googleapis.com/sample-bucket/demo5.mp4",
    thumbnailPath: "https://storage.googleapis.com/sample-bucket/thumb5.jpg",
    tags: ["Design", "AI", "Graphics", "Marketing"]
  },
  {
    title: "SecureVault - Zero-Knowledge Password Manager",
    description: "Military-grade encryption meets beautiful UX. SecureVault keeps your passwords safe with zero-knowledge architecture and seamless cross-platform sync.",
    productUrl: "https://example.com/securevault",
    videoPath: "https://storage.googleapis.com/sample-bucket/demo6.mp4",
    thumbnailPath: "https://storage.googleapis.com/sample-bucket/thumb6.jpg",
    tags: ["Security", "Password Manager", "Encryption", "Privacy"]
  },
  {
    title: "MeetSync - AI Meeting Assistant",
    description: "Never miss important meeting details again. MeetSync records, transcribes, and summarizes your meetings with action items and key insights automatically extracted.",
    productUrl: "https://example.com/meetsync",
    videoPath: "https://storage.googleapis.com/sample-bucket/demo7.mp4",
    thumbnailPath: "https://storage.googleapis.com/sample-bucket/thumb7.jpg",
    tags: ["Productivity", "AI", "Meetings", "Collaboration"]
  },
  {
    title: "FormBuilder Pro - Smart Form Creation",
    description: "Create intelligent forms that adapt to user responses. Features conditional logic, payment processing, and advanced analytics. No coding required.",
    productUrl: "https://example.com/formbuilder",
    videoPath: "https://storage.googleapis.com/sample-bucket/demo8.mp4",
    thumbnailPath: "https://storage.googleapis.com/sample-bucket/thumb8.jpg",
    tags: ["Forms", "No-Code", "Automation", "Data Collection"]
  },
  {
    title: "APIHub - Universal API Gateway",
    description: "Connect to any API without writing code. APIHub provides a unified interface for thousands of APIs with built-in authentication, rate limiting, and monitoring.",
    productUrl: "https://example.com/apihub",
    videoPath: "https://storage.googleapis.com/sample-bucket/demo9.mp4",
    thumbnailPath: "https://storage.googleapis.com/sample-bucket/thumb9.jpg",
    tags: ["API", "Integration", "Developer Tools", "Automation"]
  },
  {
    title: "VideoEdit AI - Automated Video Editing",
    description: "Transform raw footage into professional videos automatically. AI-powered editing, transitions, music selection, and color grading in one click.",
    productUrl: "https://example.com/videoedit",
    videoPath: "https://storage.googleapis.com/sample-bucket/demo10.mp4",
    thumbnailPath: "https://storage.googleapis.com/sample-bucket/thumb10.jpg",
    tags: ["Video", "AI", "Content Creation", "Editing"]
  }
];

async function seedDatabase() {
  // Get database URL from environment
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("❌ DATABASE_URL environment variable is not set");
    console.log("Please set it in your .env file or run:");
    console.log("export DATABASE_URL='your-database-url'");
    process.exit(1);
  }

  console.log("🚀 Starting database seeding...");

  // Initialize database connection
  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool);

  try {
    // First, check if we have a demo user (you'll need to replace with your actual user ID)
    const demoUserId = process.env.DEMO_USER_ID || "demo-user-id";
    console.log(`Using creator ID: ${demoUserId}`);
    console.log("⚠️  Make sure this user exists in your database!");

    // Insert all unique tags first
    const allTags = new Set<string>();
    sampleDemos.forEach(demo => demo.tags.forEach(tag => allTags.add(tag)));
    
    console.log(`📏 Creating ${allTags.size} unique tags...`);
    const tagMap = new Map<string, string>();
    
    for (const tagName of allTags) {
      try {
        const [insertedTag] = await db.insert(tags)
          .values({ name: tagName })
          .onConflictDoNothing()
          .returning();
        
        if (insertedTag) {
          tagMap.set(tagName, insertedTag.id);
          console.log(`  ✅ Created tag: ${tagName}`);
        } else {
          // Tag already exists, fetch it
          const [existingTag] = await db.select().from(tags).where(sql`name = ${tagName}`);
          if (existingTag) {
            tagMap.set(tagName, existingTag.id);
            console.log(`  ⏭️  Tag already exists: ${tagName}`);
          }
        }
      } catch (error) {
        console.error(`  ❌ Error with tag ${tagName}:`, error);
      }
    }

    // Insert demo videos
    console.log(`\n📹 Creating ${sampleDemos.length} demo videos...`);
    
    for (let i = 0; i < sampleDemos.length; i++) {
      const demo = sampleDemos[i];
      
      try {
        // Insert video
        const [insertedVideo] = await db.insert(videos)
          .values({
            title: demo.title,
            description: demo.description,
            productUrl: demo.productUrl,
            videoPath: demo.videoPath,
            thumbnailPath: demo.thumbnailPath,
            creatorId: demoUserId,
            totalViews: Math.floor(Math.random() * 1000), // Random initial views
            isActive: true
          })
          .returning();

        console.log(`  ✅ Created video: ${demo.title}`);

        // Link video to tags
        for (const tagName of demo.tags) {
          const tagId = tagMap.get(tagName);
          if (tagId && insertedVideo) {
            await db.insert(videoTags)
              .values({
                videoId: insertedVideo.id,
                tagId: tagId
              })
              .onConflictDoNothing();
          }
        }

        // Add some initial daily stats for today
        if (insertedVideo) {
          const today = new Date().toISOString().split('T')[0];
          await db.insert(dailyStats)
            .values({
              date: today,
              videoId: insertedVideo.id,
              views: Math.floor(Math.random() * 100),
              creditsSpent: Math.floor(Math.random() * 50)
            })
            .onConflictDoNothing();
        }

      } catch (error) {
        console.error(`  ❌ Error creating video "${demo.title}":`, error);
      }
    }

    console.log("\n✨ Database seeding completed successfully!");
    console.log("\n📌 Note: Videos are using placeholder URLs. You'll need to:");
    console.log("  1. Set up Google Cloud Storage");
    console.log("  2. Upload actual video files");
    console.log("  3. Update the video paths in the database");

  } catch (error) {
    console.error("❌ Error seeding database:", error);
  } finally {
    await pool.end();
  }
}

// Run the seeding
seedDatabase().catch(console.error);
