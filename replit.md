# ShipShow.io - Daily Demo Leaderboard

## Overview

ShipShow.io is a daily demo leaderboard platform where users can watch short product demos, earn credits, and boost their own submissions to reach the top. The application combines video streaming with a gamified credit system to create an engaging community around product discovery. Users watch 30-second product demos to earn credits, which they can then use to boost their own videos' visibility on the daily leaderboard.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The frontend is built as a React Single Page Application (SPA) using:
- **React with TypeScript** for type safety and component development
- **Vite** as the build tool and development server
- **Tailwind CSS** with **shadcn/ui** components for styling and UI consistency
- **Wouter** for client-side routing (lightweight alternative to React Router)
- **TanStack Query** for server state management and API caching
- **React Hook Form with Zod** for form handling and validation

The UI follows a modern dark theme design with a comprehensive component library including cards, dialogs, navigation menus, and form controls.

#### TikTok-Style Feed View
- **Vertical scroll-snap layout** with full-screen video display
- **IntersectionObserver** for automatic play/pause based on visibility (75% threshold)
- **Smart video preloading** for smooth transitions between videos
- **Auto-advance** to next video when current video ends
- **Keyboard navigation** with arrow keys and mute toggle
- **Credit earning system** integrated with 30-second viewing sessions

### Backend Architecture
The backend uses a Node.js/Express server with:
- **Express.js** as the web framework
- **TypeScript** throughout the entire stack for consistency
- **Session-based authentication** using express-session with PostgreSQL storage
- **RESTful API design** for client-server communication
- **Middleware-based request logging** for API monitoring

### Database Layer
- **PostgreSQL** as the primary database
- **Drizzle ORM** for type-safe database operations and schema management
- **Neon Database** as the PostgreSQL provider (serverless)
- **Database schema** includes users, videos, video views, daily stats, and credit transactions
- **Shared schema definition** between client and server for type consistency

### File Storage
- **Google Cloud Storage** for video and thumbnail storage
- **Custom ACL (Access Control List) system** for fine-grained object permissions
- **Uppy** file uploader on the frontend with direct-to-cloud upload capability
- **Object storage service** with support for public and private file access

### Authentication System
- **Replit Auth integration** using OpenID Connect (OIDC)
- **Passport.js** strategy for authentication flow
- **Session management** with PostgreSQL-backed session storage
- **User profile management** with credits and earnings tracking

### Credit and Gamification System
- **Watch-to-earn mechanism**: Users earn credits by watching videos for 30+ seconds
- **Boost system**: Users spend credits to increase their videos' visibility
- **Daily leaderboard**: Rankings reset every 24 hours to maintain engagement
- **View tracking**: Comprehensive analytics for video performance and user engagement

### API Structure
The API is organized around core entities:
- `/api/auth/*` - Authentication and user management
- `/api/videos/*` - Video CRUD operations and viewing
- `/api/user/*` - User-specific data (videos, stats)
- `/api/stats/*` - Platform-wide statistics and leaderboards

## External Dependencies

### Cloud Services
- **Neon Database** - Serverless PostgreSQL hosting
- **Google Cloud Storage** - Video and file storage with CDN capabilities
- **Replit Infrastructure** - Hosting platform with integrated authentication

### Authentication
- **Replit Auth** - OIDC-based authentication service
- **OpenID Connect** - Authentication protocol implementation

### Frontend Libraries
- **Radix UI** - Headless component primitives for accessibility
- **Uppy** - File upload handling with cloud storage integration
- **Lucide React** - Icon library for consistent iconography

### Development Tools
- **Vite** - Fast development server and build tool
- **ESBuild** - Fast JavaScript bundler for production builds
- **Drizzle Kit** - Database migration and schema management tools