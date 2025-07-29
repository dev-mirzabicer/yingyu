# 🎓 YingYu - Professional English Teaching Platform

A sophisticated, production-grade English teaching application built with Next.js 15, featuring advanced spaced repetition learning (FSRS), real-time session management, and comprehensive teacher tools.

## ✨ Features

- **🧠 FSRS-Powered Learning**: Advanced spaced repetition algorithm for optimal retention
- **👨‍🏫 Teacher-Centric Design**: Comprehensive tools for managing students and content  
- **📚 Modular Content System**: Units, exercises, and vocabulary decks
- **🎮 Live Learning Sessions**: Real-time interactive learning experiences
- **📊 Advanced Analytics**: Student progress tracking and performance insights
- **🏗️ Extensible Architecture**: Easy to add new exercise types and features

## 🚀 Quick Start (Recommended)

The fastest way to get started is using our automated Docker setup:

```bash
# Clone the repository
git clone <repository-url>
cd yingyu

# Run the setup script (handles everything automatically)
./scripts/setup.sh
```

That's it! The script will:
- ✅ Set up PostgreSQL database with Docker
- ✅ Install all dependencies  
- ✅ Run database migrations
- ✅ Seed initial data
- ✅ Start the development server

**Access the application at: http://localhost:3000**

## 🐋 Docker Setup (Manual)

If you prefer manual control:

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services  
docker-compose down
```

## 💻 Local Development Setup

For development without Docker:

### Prerequisites
- Node.js 20+
- PostgreSQL 15+
- npm or yarn

### Setup Steps

```bash
# 1. Install dependencies
npm install

# 2. Set up your database
# Create a PostgreSQL database and update DATABASE_URL in .env

# 3. Run database setup
npx prisma migrate deploy
npx prisma db seed
npx prisma generate

# 4. Start development server
npm run dev
```

## 🏗️ Architecture

### Tech Stack
- **Frontend**: Next.js 15, React 19, TypeScript
- **UI Components**: shadcn/ui, Tailwind CSS, Radix UI
- **Backend**: Next.js API Routes, Prisma ORM
- **Database**: PostgreSQL 15
- **Learning Engine**: FSRS (Free Spaced Repetition Scheduler)
- **State Management**: SWR, Zustand
- **Deployment**: Docker, Docker Compose

### Project Structure
```
yingyu/
├── app/                    # Next.js 15 App Router
│   ├── api/               # API endpoints
│   └── (pages)/           # Application pages
├── components/            # React components
│   ├── ui/               # shadcn/ui components  
│   └── *.tsx             # Feature components
├── lib/                   # Core business logic
│   ├── actions/          # Server actions & services
│   ├── exercises/        # Exercise handlers & operators
│   └── workflows/        # Multi-step business processes
├── hooks/                # Custom React hooks
├── prisma/               # Database schema & migrations
└── scripts/              # Setup & utility scripts
```

## 🎯 Key Features

### For Teachers
- **Student Management**: Create, manage, and track student progress
- **Content Creation**: Build units with vocabulary, grammar, and exercises
- **Live Sessions**: Conduct real-time learning sessions
- **Progress Analytics**: Detailed insights into student performance

### For Learning
- **FSRS Algorithm**: Scientifically-backed spaced repetition
- **Multiple Exercise Types**: Vocabulary, grammar, listening, fill-in-blank
- **Adaptive Learning**: Personalized difficulty and timing
- **Session Management**: Structured learning workflows

## 📊 Available Endpoints

### Core API Routes
- `GET /api/health` - Application health check
- `GET /api/students` - List all students
- `POST /api/sessions/start` - Start a learning session
- `GET /api/units` - List available units
- `POST /api/workflows/onboard-student` - Create new student

### Management Interfaces
- **Application**: http://localhost:3000
- **Database Admin**: http://localhost:8080 (Adminer)
- **Health Check**: http://localhost:3000/api/health

## 🛠️ Development Commands

```bash
# Development
npm run dev              # Start development server
npm run build           # Build for production  
npm run start           # Start production server
npm run lint            # Run ESLint

# Database
npx prisma studio       # Open Prisma Studio
npx prisma migrate dev  # Create new migration
npx prisma db seed      # Seed database

# Docker
docker-compose up       # Start all services
docker-compose down     # Stop all services
docker-compose logs -f  # View logs
```

## 🔧 Configuration

### Environment Variables
Create a `.env` file with:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5433/english_app"

# Security
CRON_SECRET="your-secret-key"

# Optional
NEXT_TELEMETRY_DISABLED=1
NODE_ENV=development
```

### Docker Services
- **app**: Main Next.js application (port 3000)
- **database**: PostgreSQL 15 (port 5433)
- **redis**: Redis cache (port 6379)  
- **adminer**: Database admin UI (port 8080)

## 📖 Usage Guide

### Creating Your First Student
1. Navigate to http://localhost:3000
2. Click "Add Student" on the dashboard
3. Fill in student details
4. Assign vocabulary decks

### Starting a Learning Session
1. Go to a student's profile
2. Click "Start Session"
3. Select a unit with exercises
4. Guide the student through the interactive session

### Managing Content
1. Visit the Content Library
2. Create units with multiple exercise types
3. Add vocabulary decks and grammar exercises
4. Organize content for different proficiency levels

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes following the existing patterns
4. Test thoroughly with `./scripts/setup.sh`
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Troubleshooting

### Common Issues

**Database Connection Failed**
```bash
docker-compose down --volumes
./scripts/setup.sh
```

**Port Already in Use**
```bash
# Change ports in docker-compose.yml or stop conflicting services
sudo lsof -i :3000
```

**Permission Denied**
```bash
chmod +x scripts/setup.sh
```

### Getting Help
- Check application logs: `docker-compose logs -f app`
- Check database logs: `docker-compose logs -f database`
- Visit health check: http://localhost:3000/api/health

## 🎯 Roadmap

- [ ] Multi-language support
- [ ] Mobile app companion
- [ ] Advanced analytics dashboard
- [ ] Classroom management tools
- [ ] Student self-service portal

---

Built with ❤️ for educators worldwide. Happy teaching! 🚀
