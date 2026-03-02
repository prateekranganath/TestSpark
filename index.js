import express from 'express';
import dotenv from 'dotenv';
import connectDB from './db/connectdb.js';

// Import routes
import evalRoutes from './routes/eval.routes.js';
import generatorRoutes from './routes/generator.routes.js';
import judgeRoutes from './routes/judge.routes.js';
import modelRoutes from './routes/model.routes.js';

// Import controllers for direct aliasing
import { 
  getDashboardStats, 
  compareModels, 
  getAllEvalRuns 
} from './controllers/eval.controller.js';
import { generateTestCases } from './services/generatorservice.js';
import { judgeModelResponse } from './controllers/judge.controller.js';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3000;
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS middleware (simple setup for frontend integration)
// Frontend stores sessionId and sends it as query param or header
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Session-Id');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Routes
app.get('/', (req, res) => {
  res.json({ 
    message: 'LLM Evaluation API',
    version: '1.0.0',
    endpoints: {
      evaluation: '/api/eval',
      generator: '/api/generator',
      judge: '/api/judge',
      model: '/api/model',
      // Frontend-compatible aliases
      runs: '/api/runs',
      dashboard: '/api/dashboard',
      compare: '/api/compare',
      generate: '/api/generate (POST)',
      judgeEvaluate: '/api/judge (POST)'
    }
  });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date(),
    database: 'connected'
  });
});

// API Routes
app.use('/api/eval', evalRoutes);
app.use('/api/generator', generatorRoutes);
app.use('/api/judge', judgeRoutes);
app.use('/api/model', modelRoutes);

// Frontend compatibility aliases - direct controller calls
// These allow the frontend to use shorter endpoint paths
app.get('/api/runs', getAllEvalRuns);
app.get('/api/dashboard', getDashboardStats);
app.get('/api/compare', compareModels);

app.post('/api/generate', async (req, res) => {
  try {
    const generatedCases = await generateTestCases(req.body);
    res.json({
      success: true,
      parentPromptId: req.body.parentPromptId,
      generatedCases
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/judge', judgeModelResponse);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
app.listen(PORT, async () => {
  try {
    await connectDB();
    console.log(`✅ Database connected`);
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
    console.log(`📊 Evaluation API: http://localhost:${PORT}/api/eval`);
    console.log(`🔨 Generator API: http://localhost:${PORT}/api/generator`);
    console.log(`⚖️  Judge API: http://localhost:${PORT}/api/judge`);
    console.log(`🤖 Model API: http://localhost:${PORT}/api/model`);
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
});
