import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * Health check endpoint for Docker and load balancers
 * Tests database connectivity and basic application health
 */
export async function GET(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Test database connectivity
    await prisma.$queryRaw`SELECT 1 as health_check`;
    
    const responseTime = Date.now() - startTime;
    
    return Response.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'yingyu-english-app',
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      database: 'connected',
      responseTime: `${responseTime}ms`,
      environment: process.env.NODE_ENV || 'development'
    }, { 
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Content-Type': 'application/json',
      }
    });
    
  } catch (error) {
    console.error('Health check failed:', error);
    
    return Response.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'yingyu-english-app',
      error: 'Database connection failed',
      database: 'disconnected',
      environment: process.env.NODE_ENV || 'development'
    }, { 
      status: 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Content-Type': 'application/json',
      }
    });
  }
}