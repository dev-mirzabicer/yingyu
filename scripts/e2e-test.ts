import axios, { AxiosInstance } from 'axios';
import { PrismaClient } from '@prisma/client';

// --- CONFIGURATION ---
const BASE_URL = 'http://localhost:3000/api';

// --- UTILITIES AND HELPERS ---

const prisma = new PrismaClient();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

class TestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TestError';
  }
}

const state: {
  teacherId?: string;
  api?: AxiosInstance;
  studentId?: string;
  deckId?: string;
  unitId?: string;
  sessionId?: string;
} = {};

// --- TEST RUNNER ---

const tests: { name: string; fn: () => Promise<void> }[] = [];

function it(name: string, fn: () => Promise<void>) {
  tests.push({ name, fn });
}

async function runTests() {
  console.log('🚀 Starting End-to-End API Test Suite 🚀');
  console.log('============================================\n');

  for (const test of tests) {
    try {
      await test.fn();
      console.log(`✅ PASSED: ${test.name}`);
    } catch (error) {
      console.error(`❌ FAILED: ${test.name}`);
      if (error instanceof TestError) {
        console.error(`   Reason: ${error.message}`);
      } else if (axios.isAxiosError(error)) {
        console.error(`   API Error: ${error.response?.status} - ${JSON.stringify(error.response?.data)}`);
      } else {
        console.error(`   Unexpected Error: ${error}`);
      }
      process.exit(1);
    }
  }

  console.log('\n============================================');
  console.log('🎉 All tests passed successfully! 🎉');
}

// --- TEST DEFINITIONS ---

it('Setup: should fetch the seeded teacher and configure the API client', async () => {
  const teacher = await prisma.teacher.findUnique({
    where: { email: 'teacher@example.com' },
  });
  if (!teacher) {
    throw new TestError('Seed data not found. Please run `npx prisma db seed` first.');
  }
  state.teacherId = teacher.id;
  state.api = axios.create({
    baseURL: BASE_URL,
    headers: { 'X-Teacher-ID': state.teacherId },
    validateStatus: (status) => status >= 200 && status < 300,
  });
  console.log(`   - Found teacher: ${teacher.name} (${teacher.id})`);
});

it('Scenario 1: should onboard a new student and initialize their FSRS states', async () => {
  const seededDeck = await prisma.vocabularyDeck.findFirst({
    where: { name: 'Default Seed Deck', creatorId: state.teacherId },
  });
  if (!seededDeck) throw new TestError('Seeded deck not found.');
  state.deckId = seededDeck.id;
  console.log(`   - Using seeded deck: ${seededDeck.name}`);

  const studentData = {
    name: `Test Student ${Date.now()}`,
    email: `test.student.${Date.now()}@example.com`,
  };
  const onboardResponse = await state.api!.post('/workflows/onboard-student', {
    studentData,
    initialDeckId: state.deckId,
  });

  const { student, initializationJob } = onboardResponse.data.data;
  state.studentId = student.id;
  if (!initializationJob || initializationJob.type !== 'INITIALIZE_CARD_STATES') {
    throw new TestError('Onboarding did not return a valid initialization job.');
  }
  console.log(`   - Student created: ${student.name} (${student.id})`);
  console.log(`   - Job created: ${initializationJob.id} (${initializationJob.type})`);

  console.log('   - Triggering background worker...');
  await state.api!.post('/worker/run');
  await sleep(500);

  const jobStatusResponse = await prisma.job.findUnique({ where: { id: initializationJob.id } });
  if (jobStatusResponse?.status !== 'COMPLETED') {
    throw new TestError(`Job did not complete. Status: ${jobStatusResponse?.status}, Error: ${jobStatusResponse?.error}`);
  }
  console.log('   - Job status confirmed: COMPLETED');

  const cardCount = await prisma.vocabularyCard.count({ where: { deckId: state.deckId } });
  const cardStateCount = await prisma.studentCardState.count({ where: { studentId: state.studentId } });
  if (cardCount !== cardStateCount) {
    throw new TestError(`Card state count mismatch. Expected ${cardCount}, got ${cardStateCount}.`);
  }
  console.log(`   - Verified ${cardStateCount} FSRS card states were created.`);
});

it('Scenario 2: should run a full vocabulary session to completion', async () => {
  const unitResponse = await state.api!.post('/units', { name: `Test Unit ${Date.now()}` });
  state.unitId = unitResponse.data.data.id;
  console.log(`   - Created unit: ${unitResponse.data.data.name}`);

  const addItemResponse = await state.api!.post(`/units/${state.unitId}/items`, {
    type: 'VOCABULARY_DECK',
    data: { name: 'Session Deck', isPublic: false },
  });
  const unitItemId = addItemResponse.data.data.id;
  const sessionDeckId = addItemResponse.data.data.vocabularyDeckId;

  await state.api!.post(`/decks/${sessionDeckId}/cards`, { englishWord: 'Test 1', chineseTranslation: '测试1' });
  await state.api!.post(`/decks/${sessionDeckId}/cards`, { englishWord: 'Test 2', chineseTranslation: '测试2' });
  await state.api!.post(`/decks/${sessionDeckId}/cards`, { englishWord: 'Test 3', chineseTranslation: '测试3' });
  console.log('   - Added 3 cards to the new session deck.');

  const assignResponse = await state.api!.post(`/students/${state.studentId}/decks`, { deckId: sessionDeckId });
  const assignJob = assignResponse.data.data.job;
  if (!assignJob) throw new TestError('Assigning deck did not create a job.');

  await state.api!.post('/worker/run');
  await sleep(500);
  const jobStatus = await prisma.job.findUnique({ where: { id: assignJob!.id } });
  if (jobStatus?.status !== 'COMPLETED') throw new TestError('Assigning new deck job failed.');
  console.log('   - Assigned new deck to student and initialized states.');

  await state.api!.put(`/items/${unitItemId}/config`, { newCards: 3, maxDue: 0 });
  console.log('   - Configured session to review 3 new cards.');

  const startResponse = await state.api!.post('/sessions/start', {
    studentId: state.studentId,
    unitId: state.unitId,
  });
  state.sessionId = startResponse.data.data.id;
  let sessionState = startResponse.data.data;
  if (sessionState.progress.payload.queue.length !== 3) {
    throw new TestError(`Session started with incorrect queue size. Expected 3, got ${sessionState.progress.payload.queue.length}.`);
  }
  console.log(`   - Session started: ${state.sessionId} with 3 cards in queue.`);

  for (let i = 0; i < 3; i++) {
    const currentCard = sessionState.progress.payload.currentCardData;
    console.log(`     - Reviewing card ${i + 1}/3: "${currentCard.englishWord}"`);

    const revealRes = await state.api!.post(`/sessions/${state.sessionId}/submit`, { action: 'REVEAL_ANSWER' });
    if (revealRes.data.data.newState.progress.stage !== 'AWAITING_RATING') {
      throw new TestError('State did not transition to AWAITING_RATING.');
    }

    const submitRes = await state.api!.post(`/sessions/${state.sessionId}/submit`, {
      action: 'SUBMIT_RATING',
      data: { rating: 3 },
    });
    sessionState = submitRes.data.data.newState;
  }

  if (sessionState.status !== 'COMPLETED') {
    throw new TestError(`Session did not complete. Final status: ${sessionState.status}`);
  }
  if (sessionState.progress !== null) {
    throw new TestError('Session progress was not cleared on completion.');
  }
  console.log('   - Session completed successfully.');

  const reviewCount = await prisma.reviewHistory.count({ where: { sessionId: state.sessionId } });
  if (reviewCount !== 3) {
    throw new TestError(`Incorrect number of review history records. Expected 3, got ${reviewCount}.`);
  }
  console.log('   - Verified 3 review history records were created.');
});

it('Cleanup: should archive the test student via API', async () => {
  await state.api!.delete(`/students/${state.studentId}`);

  const student = await prisma.student.findFirst({ where: { id: state.studentId!, isArchived: true } });
  if (!student) {
    throw new TestError("Failed to find the archived student in the database.");
  }
  console.log(`   - Archived student ${state.studentId}`);
});

// --- SCRIPT EXECUTION ---
runTests().finally(async () => {
  await prisma.$disconnect();
});

