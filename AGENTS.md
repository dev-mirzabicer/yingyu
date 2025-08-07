# AGENTS.md: The Definitive Guide to the Ying-Yu Teaching Platform Backend

## 0. Manifesto: Our Philosophy & Vision

Welcome, agent. You are now part of a project to build not just an application, but a scientifically-backed pedagogical tool. Before you write a single line of code, you must understand our core philosophy. We are not merely building CRUD endpoints; we are engineering a system that empowers teachers, optimizes learning, and is built with a degree of resilience and architectural integrity that is absolute.

> **Our Prime Directive:** To build a teacher-centric English learning platform, optimized for China, that uses a sophisticated FSRS (Free Spaced Repetition Scheduler) engine to provide unprecedented pedagogical insights and operational efficiency. Every architectural decision must serve this directive.

### Our Guiding Principles:

1.  **The Teacher is the User:** The application is a tool for the teacher. The student is the subject. We do not build features for students; we build features that enable the teacher to manage, teach, and analyze the student's progress. Every UI, API, and workflow must be designed to reduce the teacher's cognitive load.
2.  **Resilience and Atomicity are Non-Negotiable:** The system state must *never* be corruptible. Operations must be atomic. We prefer to fail an entire operation rather than leave the database in an inconsistent state. We build for the "double-click," the network failure, and the unexpected edge case from day one.
3.  **History is the Absolute Source of Truth:** For FSRS, the `ReviewHistory` table is the immutable ledger of a student's learning journey. All other FSRS-related states (`StudentCardState`) are considered disposable, rebuildable caches. This principle, embodied in the `FSRSService._rebuildCacheForStudent` function, ensures that our learning algorithm is always based on perfect data.
4.  **Architecture is Layered and Explicit:** We adhere to a strict layered architecture. Logic is never mixed. The API layer validates and delegates. The Service layer orchestrates and enforces business rules. The Data layer accesses the database. This separation is sacred.
5.  **Asynchronicity for a Responsive Experience:** Long-running tasks (like initializing hundreds of card states or optimizing FSRS parameters) must *never* block the user. We use a robust, race-condition-proof background job system to handle these tasks, providing immediate feedback to the teacher.

Read these principles again. Internalize them. They are the lens through which you must review your own work and the work of others.

---

## 1. System Architecture Overview

Our application is a full-stack TypeScript monolith built on Next.js, but with a strictly layered internal architecture designed for clarity and separation of concerns.

```mermaid
graph TD
    subgraph "API Layer (app/api)"
        A1[POST /workflows/onboard-student] --> W1(OnboardingWorkflow)
        A2[POST /sessions/start] --> S1(SessionService)
        A3[POST /sessions/[id]/submit] --> S1
        A4[GET /students/[id]] --> S2(StudentService)
        A5[POST /units] --> C1(ContentService)
        A6[POST /worker/run] --> J1(Job Worker)
        A7[POST /students/[id]/fsrs/optimize-parameters] --> F1(FSRSService)
    end

    subgraph "Workflow Layer (lib/workflows)"
        W1 -- orchestrates --> S2
    end

    subgraph "Service Layer (lib/actions)"
        S1 -- uses --> D1(Exercise Dispatcher)
        S2 -- uses --> J2(JobService)
        C1 -- uses --> DB((Prisma Client))
        F1 -- uses --> FSRS_Engine(FSRS Engine)
        F1 -- uses --> J2
        J2 -- uses --> DB
    end

    subgraph "Exercise Handling Layer (lib/exercises)"
        D1 -- dispatches to --> H1(VocabularyDeckHandler)
        H1 -- uses --> OP1(Progress Operators)
        OP1 -- uses --> F1
        OP1 -- uses --> DB
    end

    subgraph "Data & Engine Layer"
        FSRS_Engine(FSRS Engine) -- bridge to --> Rust(fsrs-rs-nodejs)
        DB -- soft deletes via extension --> PG[(PostgreSQL)]
    end

    subgraph "Async Processing"
        Scheduler(Vercel Cron) -- triggers --> A6_Prod(POST /api/worker)
        A6_Prod --> J1
        A6 -- dev only trigger --> J1
        J1 -- processes jobs from --> PG
        J1 -- calls internal methods --> S2
        J1 -- calls internal methods --> F1
    end

    style DB fill:#cde4ff,stroke:#333,stroke-width:2px
    style PG fill:#cde4ff,stroke:#333,stroke-width:2px
    style Rust fill:#ffd8b1,stroke:#333,stroke-width:2px
```

-   **API Layer (`app/api`):** The thin, outermost layer. Its only jobs are to define routes, handle authentication (via the `X-Teacher-ID` header), validate incoming data using Zod, and delegate to the appropriate Workflow or Service. It knows nothing of business logic.
-   **Workflow Layer (`lib/workflows`):** Orchestrates calls across *multiple* services to accomplish a high-level user story (e.g., "Onboard a Student," which involves creating a student and assigning a deck).
-   **Service Layer (`lib/actions`):** The heart of our business logic. Each service (`StudentService`, `SessionService`, `ContentService`, `FSRSService`) is responsible for a specific domain. They contain the core logic, enforce business rules, and interact with the database.
-   **Exercise Handling Layer (`lib/exercises`):** The "brains" of a live session. This specialized layer uses a Dispatcher -> Handler -> Operator pattern to manage the complex state transitions of different exercise types.
-   **Data & Engine Layer:** Contains our extended Prisma client (`lib/db.ts`), the FSRS engine bridge (`lib/fsrs/engine.ts`), and the PostgreSQL database itself.
-   **Async Processing:** A Vercel Cron job triggers our secure worker endpoint (`/api/worker`), which processes background jobs from a queue in the database. A development-only endpoint (`/api/worker/run`) allows for manual triggering during testing.

---

## 2. Core Concepts & Architectural Patterns

To truly understand this codebase, you must master its core patterns.

### The Soft-Delete System (via Prisma Extension)

-   **File:** `lib/db.ts`
-   **Problem:** Deleting records (like a `Student` or `VocabularyDeck`) is destructive and can lead to loss of historical data or broken foreign key relationships.
-   **Solution:** We use a global Prisma Client Extension that intercepts all `delete` and `deleteMany` queries for models listed in `ARCHIVABLE_MODELS`. Instead of deleting, it converts the operation into an `update` that sets `isArchived: true`. It also automatically adds `where: { isArchived: false }` to all `find*`, `update*`, and `count` queries.
-   **Implication for You:** You can write `prisma.student.delete(...)` in your code, and the system will handle the soft delete automatically. You never need to manually filter for `isArchived: false`. The database layer handles this protection for you.

### The Asynchronous, Race-Condition-Proof Job System

-   **Files:** `lib/worker.ts`, `lib/actions/jobs.ts`, `app/api/worker/route.ts`
-   **Problem:** Operations like initializing FSRS states for a deck with 500 cards or running a computationally intensive FSRS parameter optimization can take time. We cannot make the teacher wait. Furthermore, how do we prevent multiple worker instances from processing the same job twice?
-   **Solution:**
    1.  Services create a `Job` record in the database with a `PENDING` status (e.g., `FSRSService.createOptimizeParametersJob`).
    2.  A scheduled task calls our secure worker endpoint (`/api/worker`), which is protected by a `CRON_SECRET`.
    3.  The worker (`processPendingJobs`) uses a powerful database-level lock: `SELECT ... FOR UPDATE SKIP LOCKED`. This atomically fetches a batch of pending jobs and immediately locks those rows. Any other concurrent worker instance that runs the same query will *skip* the locked rows and grab the next available ones.
    4.  The worker validates the job's payload with a corresponding Zod schema (e.g., `OptimizeParamsPayloadSchema`) and executes the appropriate internal service method (e.g., `FSRSService._optimizeParameters`).
-   **Implication for You:** For any long-running task, your service should create a job using `JobService.createJob` and return the job object to the API layer. The worker will handle the rest.

### The Session State Machine: The Application's "Brains"

-   **Files:** `lib/actions/sessions.ts`, `lib/exercises/*`
-   **Problem:** A teaching session is a complex state machine. It moves through a `Unit` containing various `UnitItem`s (vocabulary, grammar, etc.). Each item has its own internal states (e.g., "showing the word," "waiting for a rating"). How do we manage this complexity without creating a monolithic, unmaintainable mess?
-   **Solution:** The Dispatcher -> Handler -> Operator pattern.
    1.  **`SessionService` (The General Contractor):** This is the master orchestrator. When an answer is submitted (`submitAnswer`), it wraps the entire operation in a single database transaction.
    2.  **`Dispatcher` (`getHandler`):** The `SessionService` asks the dispatcher for the correct "specialist" based on the current `UnitItemType`.
    3.  **`ExerciseHandler` (The Specialist):** A handler (e.g., `vocabularyDeckHandler`) manages the lifecycle of *one type* of exercise. It knows how to `initialize` its state, how to check if it `isComplete`, and how to `submitAnswer`.
    4.  **`ProgressOperator` (The Subcontractor):** The handler's `submitAnswer` method is also an orchestrator. It looks at the user's specific `action` (e.g., `'SUBMIT_RATING'`) and delegates to the correct, hyper-specific `ProgressOperator`. The operator contains the actual business logic for that single action.
-   **Implication for You:** When adding a new exercise type, you will create a new `Handler` and a set of `Operators` for it. You will then register the handler in the `dispatcher`. The `SessionService` does not need to be changed.

### The FSRS Engine & Simple Learning Steps

-   **File:** `lib/actions/fsrs.ts`
-   **Problem:** New vocabulary needs to be seen several times in quick succession before it's ready for long-term spaced repetition. Throwing a brand new card into the FSRS algorithm immediately can result in awkwardly long initial intervals.
-   **Solution:** We've implemented Anki-style "Learning Steps." The `FSRSService.recordReview` function is the heart of this logic.
    1.  It first checks if a card `_shouldUseLearningSteps` (i.e., it's in a `NEW` or `RELEARNING` state and hasn't completed its steps).
    2.  If so, it uses `_calculateLearningStepsDue` to determine the next due time based on a simple, configurable interval array (e.g., `['3m', '15m', '30m']`). A rating of 'Again' (1) resets the steps.
    3.  Only after a card "graduates" from all its learning steps does `recordReview` pass it to the FSRS engine for true spaced repetition scheduling.
-   **Implication for You:** This is a critical pedagogical feature. The `ReviewHistory` table's `isLearningStep` boolean distinguishes these two types of reviews, which is essential for accurate FSRS parameter optimization.

---

## 3. Database Schema Deep Dive (`prisma/schema.prisma`)

The schema is the blueprint of our application's data. It is organized into logical sections.

#### Core Models

*   `Teacher`: The central user model. Owns students, content, and jobs.
*   `TeacherSettings`: Customizable settings for a teacher, like payment alerts.
*   `Student`: Represents a teacher's student. Contains profile information, status (`ACTIVE`, `PAUSED`), and notes. It is the anchor for most student-specific data.
*   `Payment`: Tracks payments made by students for classes.
*   `ClassSchedule`: Manages scheduled classes for students.

#### Content & Session Models

This is a highly normalized structure for maximum flexibility.

*   `Unit`: A lesson plan or a container for exercises. Can be public or private.
*   `UnitItem`: A single item within a `Unit`, representing one exercise (e.g., a vocabulary deck). It holds the `order` of the item in the lesson and any specific `exerciseConfig`.
*   `Session`: A record of a live teaching session. It links a `Teacher`, `Student`, and `Unit`. It tracks the `status`, `startTime`, `endTime`, the `currentUnitItemId`, and a `progress` JSON blob holding the live state of the current exercise.

#### Exercise Models

These are the actual learning materials.

*   `VocabularyDeck`: A collection of vocabulary cards. Can be forked from a public deck.
*   `VocabularyCard`: A single flashcard with English, Chinese, pinyin, etc.
*   `GrammarExercise`, `ListeningExercise`, `VocabFillInBlankExercise`: Models for other types of exercises, demonstrating the system's extensibility.

#### FSRS & Spaced Repetition Models

This is the scientific core of the learning system.

*   `StudentDeck`: A join table linking a `Student` to a `VocabularyDeck`, making an "assignment."
*   `StudentCardState`: **Crucial Model.** This tracks a specific student's progress on a specific card. It stores the FSRS parameters (`stability`, `difficulty`), the `due` date, `reps`, `lapses`, and current `state` (`NEW`, `LEARNING`, `REVIEW`, `RELEARNING`).
*   `ReviewHistory`: **The Source of Truth.** An append-only log of every single review a student has ever made. It stores the `rating`, `reviewedAt`, and the card's state *before* the review. This allows the entire FSRS cache to be rebuilt perfectly.
*   `StudentFsrsParams`: Stores the optimized FSRS weight parameters (`w`) for a student, calculated from their `ReviewHistory`.

#### Asynchronous Job System

*   `Job`: A record of a background task. It has a `type`, a `status` (`PENDING`, `RUNNING`, `COMPLETED`, `FAILED`), a JSON `payload` with the necessary data, and a `result` or `error` field.

---

## 4. Service Layer Deep Dive (`lib/actions`)

This directory contains the application's soul. Each service is a singleton object with a collection of related methods.

#### `ContentService` (`/lib/actions/content.ts`)

Manages the lifecycle of all learning materials (Units and Exercises).

*   `getUnitWithDetails(unitId)`: Fetches a complete Unit with all its ordered items and exercises.
*   `createUnit(data)` / `createDeck(data)`: Creates new, empty Units or Decks.
*   `addExerciseToUnit(...)`: A critical transactional method. It can either create a brand new exercise or link an existing one, creating the `UnitItem` to place it within the `Unit`.
*   `forkExercise(...)`: Implements the "copy-on-edit" pattern. It performs a deep copy of a public exercise (including all its cards, if it's a deck) to create a new, private, editable version for a teacher.
*   `archiveExercise(...)`: Soft-deletes an exercise.
*   `removeUnitItem(unitItemId)`: Removes an exercise from a unit (but does not archive the exercise itself).
*   `_bulkAddVocabularyCards(payload)`: An internal method used by the worker for bulk importing cards into a deck.

#### `StudentService` (`/lib/actions/students.ts`)

Manages all aspects of a student's profile and their relationship with the teacher.

*   `createStudent(...)` / `archiveStudent(...)` / `updateStudent(...)`: Standard CRUD operations for student profiles, all protected by `authorizeTeacherForStudent`.
*   `getStudentProfile(studentId, teacherId)`: Fetches a rich, aggregated view of a student, including their assigned decks, upcoming classes, and payment status.
*   `assignDeckToStudent(...)`: A key transactional method. It creates the `StudentDeck` association. Crucially, if the deck is large (>50 cards), it **creates a job** of type `INITIALIZE_CARD_STATES` to handle the creation of `StudentCardState` records asynchronously. For small decks, it does this synchronously.
*   `recordPayment(...)` / `createSchedule(...)` / `updateSchedule(...)`: Manages student payments and class schedules.
*   `_initializeCardStates(payload)`: Internal worker method. Creates the initial `StudentCardState` for every card in a newly assigned deck.
*   `_bulkAddStudents(payload)` / `_bulkAddSchedules(payload)`: Internal worker methods for bulk imports.

#### `FSRSService` (`/lib/actions/fsrs.ts`)

The scientific core. This service is the bridge between our application and the FSRS engine.

*   `recordReview(...)`: **The Heart of FSRS.** This is the most complex method.
    1.  It first determines if a card is in "learning steps" (e.g., 1m, 10m) or is managed by the main FSRS algorithm.
    2.  If in learning steps, it applies simple interval logic.
    3.  If using FSRS, it fetches the student's FSRS parameters, calculates the next state using the FSRS engine, and updates the `StudentCardState` with the new `stability`, `difficulty`, and `due` date.
    4.  It **always** records the review in the `ReviewHistory` table.
*   `getInitialReviewQueue(...)`: Assembles the list of cards for a new study session, intelligently combining cards that are due, cards in relearning, and a configured number of new cards.
*   `createOptimizeParametersJob(...)`: Creates a background job to analyze a student's entire `ReviewHistory` and compute the optimal FSRS `w` parameters for their learning pattern.
*   `createRebuildCacheJob(...)`: Creates a job to wipe and perfectly reconstruct a student's `StudentCardState` table from their `ReviewHistory`. This is a powerful maintenance tool.
*   `_optimizeParameters(payload)` / `_rebuildCacheForStudent(payload)`: The internal worker methods that perform the actual FSRS calculations.

#### `SessionService` (`/lib/actions/sessions.ts`)

Orchestrates a live teaching session. It acts as a state machine.

*   `startSession(...)`: Creates the `Session` record and calls the appropriate `ExerciseHandler` to initialize the first `UnitItem`, creating the initial `progress` state.
*   `submitAnswer(...)`:
    1.  Receives an action from the user (e.g., `REVEAL_ANSWER`, `SUBMIT_RATING`).
    2.  Delegates to the current `ExerciseHandler` to process the action.
    3.  The handler returns the new progress state and a result.
    4.  It checks if the current `UnitItem` is complete.
    5.  If complete, it advances to the next `UnitItem` in the `Unit` and calls its `initialize` method. If the unit is finished, it marks the session as `COMPLETED`.
    6.  It saves the new state to the database.
*   `endSession(...)`: Manually ends a session.
*   `getFullState(...)`: The primary read-operation, fetching the entire `FullSessionState` object needed by the frontend to render the UI.

---

## 5. The Exercise Engine Deep Dive (`/lib/exercises`)

This is an elegant and extensible pattern for handling different types of exercises within a session.

*   **Dispatcher (`dispatcher.ts`):** A simple map that takes a `UnitItemType` (e.g., `VOCABULARY_DECK`) and returns the corresponding handler. To add a new exercise type, you would register its handler here.
*   **Handler (`handler.ts`, `vocabularyDeckHandler.ts`):** An orchestrator for a specific exercise type.
    *   `initialize()`: Sets up the initial `Session.progress` JSON object. For a vocabulary deck, this involves creating the initial review queue.
    *   `submitAnswer()`: Dispatches the user's action to the correct, more granular `ProgressOperator`.
    *   `isComplete()`: Checks the `progress` object to see if the exercise is finished (e.g., the vocabulary queue is empty).
*   **Operators (`base.ts`, `vocabularyDeckOperators.ts`):** These are the most granular pieces of logic. Each operator handles a single, atomic state transition.
    *   `RevealAnswerOperator`: Transitions the state from `PRESENTING_CARD` to `AWAITING_RATING`.
    *   `SubmitRatingOperator`: Takes a rating, calls `FSRSService.recordReview`, rebuilds the review queue, and prepares the next card. This design isolates complex logic into small, testable units.

---

## 6. API Endpoints Deep Dive (`/app/api`)

Each `route.ts` file defines one or more HTTP endpoints. All routes are authenticated using a temporary `X-Teacher-ID` header, which would be replaced by a proper authentication system (like Clerk, as hinted by `getAuth`) in production.

#### `/bulk-import`

*   `POST /api/bulk-import/schedules`: Creates a `BULK_IMPORT_SCHEDULES` job.
*   `POST /api/bulk-import/students`: Creates a `BULK_IMPORT_STUDENTS` job.
*   `POST /api/bulk-import/vocabulary`: Creates a `BULK_IMPORT_VOCABULARY` job.

#### `/decks`

*   `GET /api/decks`: Gets all decks for the authenticated teacher.
*   `POST /api/decks`: Creates a new vocabulary deck.
*   `GET /api/decks/[deckId]`: Gets details for a single deck.
*   `DELETE /api/decks/[deckId]`: Archives a deck.
*   `GET /api/decks/[deckId]/cards`: Gets all cards in a specific deck.
*   `POST /api/decks/[deckId]/cards`: Adds a new card to a deck.
*   `POST /api/decks/fork`: Forks a public deck.

#### `/public-decks`

*   `GET /api/public-decks`: Gets all decks where `isPublic: true`.

#### `/sessions`

*   `GET /api/sessions`: Gets all past and present sessions for the teacher.
*   `POST /api/sessions/start`: Starts a new session.
*   `GET /api/sessions/[sessionId]`: Gets the full, live state of a session.
*   `DELETE /api/sessions/[sessionId]`: Ends a session.
*   `POST /api/sessions/[sessionId]/submit`: Submits an answer during a session.

#### `/students`

*   `GET /api/students`: Gets all students for the teacher.
*   `GET /api/students/[studentId]`: Gets a detailed student profile.
*   `PUT /api/students/[studentId]`: Updates a student's profile.
*   `DELETE /api/students/[studentId]`: Archives a student.
*   `GET /api/students/[studentId]/available-units`: A complex endpoint that fetches all units a student can start, calculating their readiness (e.g., due card count) for each.
*   `POST /api/students/[studentId]/decks`: Assigns a deck to a student.
*   `PUT /api/students/[studentId]/notes`: Updates a teacher's private notes for a student.
*   `POST /api/students/[studentId]/payments`: Records a new payment for a student.
*   `GET /api/students/[studentId]/schedules`: Gets all scheduled classes for a student.
*   `POST /api/students/[studentId]/schedules`: Creates a new class schedule.

#### `/students/[studentId]/fsrs`

*   `GET /api/students/[studentId]/fsrs/due-cards`: Gets all cards currently due for a student.
*   `GET /api/students/[studentId]/fsrs/listening-candidates`: Gets cards that are well-known and suitable for listening practice.
*   `POST /api/students/[studentId]/fsrs/optimize-parameters`: Creates a job to optimize FSRS parameters for the student.
*   `POST /api/students/[studentId]/fsrs/rebuild-cache`: Creates a job to rebuild the student's FSRS card state cache.

#### `/units`

*   `GET /api/units`: Gets all units for the teacher.
*   `POST /api/units`: Creates a new unit.
*   `GET /api/units/[unitId]`: Gets a detailed view of a single unit.
*   `PUT /api/units/[unitId]`: Updates a unit's details.
*   `POST /api/units/[unitId]/items`: Adds a new exercise item to a unit.
*   `DELETE /api/units/[unitId]/items/[itemId]`: Removes an item from a unit.

#### `/worker`

*   `POST /api/worker/run`: **Development only.** Manually triggers the worker process for testing.
*   `POST /api/worker`: **Production endpoint.** Secured by a `CRON_SECRET`. This is the endpoint that a cron job scheduler (like Vercel Cron) will call to run `processPendingJobs`.

---

## 7. Key Workflows in Action

To connect all the pieces, let's trace two critical workflows.

### Workflow 1: Onboarding a New Student

1.  **Teacher Action:** Clicks "Create Student" and assigns an initial deck.
2.  **API:** `POST /api/workflows/onboard-student` is called.
3.  **Route (`onboard-student/route.ts`):** Validates the request body. Calls `OnboardingWorkflow.onboardStudentWithInitialDeck`.
4.  **Workflow (`onboarding.ts`):**
    a. Calls `StudentService.createStudent` to create the `Student` record.
    b. Calls `StudentService.assignDeckToStudent`.
5.  **Service (`students.ts`):** `assignDeckToStudent` starts a transaction.
    a. It creates the `StudentDeck` record.
    b. It counts the cards in the deck. If it's a large deck, it creates an `INITIALIZE_CARD_STATES` job. If small, it initializes the `StudentCardState` records synchronously within the same transaction.
    c. The transaction is committed.
6.  **API:** The route returns a `201 Created` response with the new student and job details (if a job was created).
7.  **Later (Async, if job was created):** The `Scheduler` triggers `POST /api/worker`.
8.  **Worker (`worker.ts`):** `processPendingJobs` fetches and locks the job. It validates the payload and calls `StudentService._initializeCardStates`.
9.  **Service (`students.ts`):** `_initializeCardStates` finds all cards in the assigned deck and bulk-creates the initial `StudentCardState` records for the student.
10. **Worker:** The job is marked as `COMPLETED`.

### Workflow 2: Submitting a Vocabulary Review (in Learning Steps)

1.  **Teacher Action:** Clicks the "Good" (rating: 3) button for a new card.
2.  **API:** `POST /api/sessions/[sessionId]/submit` is called with `{ action: 'SUBMIT_RATING', data: { rating: 3 } }`.
3.  **Route (`submit/route.ts`):** Validates the body. Calls `SessionService.submitAnswer`.
4.  **Service (`sessions.ts`):** `submitAnswer` begins its master transaction.
    a. It fetches the `FullSessionState`.
    b. It calls `getHandler('VOCABULARY_DECK')` to get the `vocabularyDeckHandler`.
    c. It calls `vocabularyDeckHandler.submitAnswer`, passing the transaction client.
5.  **Handler (`vocabularyDeckHandler.ts`):**
    a. It gets the `submitRatingOperator`.
    b. It calls `submitRatingOperator.execute`.
6.  **Operator (`vocabularyDeckOperators.ts`):**
    a. It calls `FSRSService.recordReview`.
7.  **Service (`fsrs.ts`):** `recordReview` determines the card is in learning steps.
    a. It calls `_calculateLearningStepsDue` which returns the next due time (e.g., 15 minutes from now) and `shouldGraduate: false`.
    b. It updates the `StudentCardState` with the new due time and creates a `ReviewHistory` record with `isLearningStep: true`.
8.  **Operator:** The FSRS service returns. The operator then re-queries for all due cards in the deck. The card just reviewed is no longer due, so it's not in the new queue. The operator builds the new `SessionProgress` object with the next card in the queue.
9.  **Service (`sessions.ts`):** The service receives the new progress, updates the `Session` record, and commits the master transaction.
10. **API:** The route returns a `200 OK` with the new `FullSessionState`.

---

## 8. How to Contribute & Future Roadmap

### Developer's Guide

1.  **Adhere to the Patterns:** All new features must follow the established architectural patterns. New business logic goes in services or operators. New complex flows go in workflows.
2.  **Validate at the Boundary:** All API routes must validate their inputs using Zod schemas from `lib/schemas.ts`.
3.  **Write Atomically:** Any operation that modifies multiple, related database records must be wrapped in a `prisma.$transaction`.
4.  **Type Everything:** All new data structures should have corresponding types in `lib/types.ts`.
5.  **Offload to the Worker:** If an operation might take more than a few seconds (e.g., processing a large file, complex report generation), create a `Job` for it. Implement the logic as an internal `_` method in the appropriate service and add a case for it in `/lib/worker.ts`.

### Example: Adding a New "Spelling" Exercise Type

1.  **Schema (`prisma/schema.prisma`):**
    *   Add `SPELLING_EXERCISE` to the `UnitItemType` enum.
    *   Create a new `model SpellingExercise { ... }`.
    *   Add `spellingExerciseId` and `spellingExercise` relations to `UnitItem`.
2.  **Content Service (`/lib/actions/content.ts`):**
    *   Add a case for `SPELLING_EXERCISE` in `addExerciseToUnit` to handle its creation within a transaction.
3.  **Exercise Engine (`/lib/exercises`):**
    *   Create `spellingExerciseOperators.ts` with operators like `SubmitSpellingAttemptOperator`.
    *   Create `spellingExerciseHandler.ts` that implements the `ExerciseHandler` interface, using your new operators.
    *   Register your new handler in `dispatcher.ts`.
4.  **API (`/app/api`):**
    *   Update the `AddItemBodySchema` in `/app/api/units/[unitId]/items/route.ts` to allow for the creation of your new exercise type.
5.  **Types (`/lib/types.ts`):**
    *   Define `SpellingExerciseProgress` and add it to the `SessionProgress` union type.
    *   Update `PopulatedUnitItem` to include the new exercise type.

### Future Roadmap

The current foundation is solid. The next phases of development will build upon it:

1.  **Implement Additional Exercise Handlers:**
    -   `GrammarExerciseHandler`
    -   `ListeningExerciseHandler`
    -   `VocabFillInBlankExerciseHandler`
2.  **Build the PDF Generation System:**
    -   Create a new `JobType` for `GENERATE_PRACTICE_PDF`.
    -   Implement a service that uses a headless browser (e.g., Puppeteer) to render practice sheets based on a student's due cards.
3.  **Implement Full Authentication:**
    -   Replace the `X-Teacher-ID` header with a proper NextAuth.js or Clerk-based JWT implementation.

You now have the knowledge. Build with precision, resilience, and adherence to the vision.

Of course. Here is the `AGENTS.md` for the frontend codebase, crafted with the requested level of detail and incorporating the deep analysis of its current state.

***

# AGENTS.md: The Definitive Guide to the Ying-Yu Teaching Platform Frontend

Welcome, agent. You have already familiarized yourself with the robust, resilient architecture of our backend. This document is your guide to its counterpart: the frontend. Our mission here is to build a user interface that is not merely a thin client for our API, but a sophisticated, responsive, and data-rich tool that empowers the teacher at every step.

You are expected to have read and internalized the backend `AGENTS.md`. The principles of resilience, atomicity, and data integrity are mirrored here in our approach to UI/UX and state management.

## 0. Manifesto: The Frontend Philosophy

Our backend is the engine of pedagogical precision; our frontend is the cockpit. It must be intuitive, fast, and provide the teacher with complete situational awareness of their students' learning journeys.

> **Our Frontend Directive:** To build a highly interactive, component-driven user interface using Next.js and TypeScript that provides teachers with real-time insights and seamless control over their content, students, and live sessions. Every component, hook, and state transition must serve the teacher's workflow and reduce their cognitive load.

### Our Guiding Principles:

1.  **The Component is the Contract:** We build with a modular, component-based architecture. Each component has a clear responsibility, from a simple `Button` to a complex `LiveSession` manager. Pages in the `app/` directory are primarily for routing and composing these smart components.
2.  **Server State is King (via SWR):** All data that originates from the server is managed by SWR (`swr`). We leverage its powerful caching, revalidation, and mutation capabilities to ensure the UI is always synchronized with the backend's source of truth. We do not store server data in local component state.
3.  **Client State is Ephemeral (via Zustand):** State that is purely client-side and/or global (e.g., the real-time status of a live session, UI toggles) is managed by our lightweight Zustand store. This creates a clean separation between server cache and UI state.
4.  **Hooks are the Logic Layer:** Components should be declarative. The imperative logic—fetching data, mutating state, handling side effects—is encapsulated within our custom hooks in the `hooks/` directory. This makes components cleaner, more reusable, and easier to test.
5.  **Type Safety is Non-Negotiable:** We use TypeScript rigorously. All API payloads, component props, and data structures are explicitly typed in `lib/types.ts`, ensuring a tight contract between the frontend and backend and preventing entire classes of runtime errors.

---

## 1. Frontend Architecture Overview

Our frontend is a Next.js application utilizing the App Router. It is architecturally designed for a clear separation of concerns, ensuring that data fetching, state management, and UI rendering are distinct, decoupled layers.

```mermaid
graph TD
    subgraph "User Interaction"
        U[Teacher] --> P[Pages (app/)]
    end

    subgraph "Presentation Layer (components/)"
        P --> C1[TeacherDashboard]
        P --> C2[StudentProfile]
        P --> C3[LiveSession]
        P_Units[app/units/[unitId]] --> C4[UnitEditor]
        C_Shared[Shared Components] --> DT[DataTable]
        C_Shared --> SD[SessionStartDialog]
    end

    subgraph "Logic & State Layer (hooks/)"
        C1 --> H_S[useStudents]
        C2 --> H_S
        C2 --> H_D[useDecks]
        C3 --> H_LS[useSession]
        C3 --> H_Z[useLiveSessionStore]
        C4 --> H_U[useUnit]

        H_S --> A1[API Hooks (api/students.ts)]
        H_D --> A2[API Hooks (api/content.ts)]
        H_LS --> A3[API Hooks (api/sessions.ts)]
        H_U --> A2
    end

    subgraph "API Abstraction Layer (hooks/api/)"
        A1 -- uses --> UTL[utils.ts]
        A2 -- uses --> UTL
        A3 -- uses --> UTL
        UTL -- contains --> F[fetcher]
        UTL -- contains --> M[mutateWithOptimistic]
    end

    subgraph "External Services"
        F --> BE[(Backend API)]
    end

    style BE fill:#cde4ff,stroke:#333,stroke-width:2px
```

-   **Pages (`app/`):** The entry points for routing. These are server components where possible, responsible for fetching initial data via route params and composing the "smart" components that make up the UI. For example, `/app/students/[studentId]/page.tsx` simply extracts the `studentId` and passes it to the `<StudentProfile />` component.
-   **Components (`components/`):** The heart of the UI. This directory contains everything from atomic elements (`Button`, `Input`) to complex, feature-rich "smart" components like `LiveSession` or `StudentProfile`. These components are responsible for rendering the UI and calling hooks to fetch data or perform actions.
-   **Hooks (`hooks/`):** The logic layer.
    -   **`hooks/api/*.ts`:** These files contain our custom SWR hooks, abstracting all data fetching. A component will call `useStudents()` instead of `useSWR('/api/students')`, providing a clean, domain-specific API.
    -   **`hooks/stores/*.ts`:** This contains our Zustand global state stores, used for complex client-side state that needs to be shared across components without prop-drilling (e.g., the live state of a session).
-   **API Abstraction (`hooks/api/utils.ts`):** This is the lowest-level data fetching utility. It contains a single, configured `fetcher` function used by all SWR hooks, ensuring that headers (like the mock `X-Teacher-ID`) and error handling are centralized.

---

## 2. Directory & Component Deep Dive

### `app/` - The Routing Layer

Each directory corresponds to a URL path. The `page.tsx` file within it is the component rendered for that route.

-   `/app/students/[studentId]/page.tsx`: Renders the `<StudentProfile>` component for a specific student.
-   `/app/session/[sessionId]/page.tsx`: Renders the `<LiveSession>` component, the most complex interactive view in the application.
-   `/app/decks/page.tsx`: The main view for managing all of a teacher's `VocabularyDecks`.
-   `/app/units/page.tsx`: The main view for managing all `Units` (lesson plans).
-   `/app/analytics/page.tsx`: The entry point for the FSRS analytics dashboard.

### `components/` - The UI Building Blocks

These are the "smart" components that encapsulate major features.

-   **`teacher-dashboard.tsx`**: The application's home page. It provides an at-a-glance summary of key metrics: active students, upcoming classes, and students with low class balances. It renders a grid of student cards for quick access.
-   **`student-profile.tsx`**: A central hub for managing a single student. It uses a tabbed interface to separate concerns:
    -   **Overview:** Shows key stats and teacher's notes.
    -   **Learning Plan:** Manages the student's assigned `VocabularyDecks`.
    -   **Payment History:** Renders the `<PaymentManager>` component.
    -   **Class Schedule:** Renders the `<ClassScheduler>` component.
-   **`live-session.tsx`**: The most complex real-time component. It orchestrates the entire teaching experience, fetching the `FullSessionState` every second. It displays the current exercise, handles user input (revealing answers, submitting ratings), and manages a sidebar with live progress stats.
-   **`unit-editor.tsx`**: The interface for building and modifying a `Unit`. It allows a teacher to add, remove, and configure exercises within a lesson plan.
-   **`vocabulary-card-manager.tsx`**: A detailed table view for managing the individual `VocabularyCard`s within a specific `VocabularyDeck`. Includes functionality for adding, editing, deleting, and bulk-importing/exporting cards.
-   **`fsrs-analytics-dashboard.tsx`**: Provides deep insights into a student's FSRS data. It visualizes card state distribution, performance metrics, and provides detailed tables of due cards and listening candidates.
-   **`data-table.tsx`**: A generic, reusable table component used throughout the application. It includes built-in support for pagination, searching, and sorting.

### `hooks/` - The Logic & State Layer

-   **`hooks/api/*.ts`**: These files provide clean abstractions over SWR. For example, `hooks/api/students.ts` exports `useStudents()` and `useStudent(id)`, which handle the underlying SWR calls. It also exports mutation functions like `createStudent` and `recordPayment`. This pattern is repeated for `content`, `sessions`, and `teacher` domains.
-   **`hooks/stores/use-live-session-store.ts`**: The Zustand store for the `LiveSession` component. It tracks state that is either purely client-side (like `isPaused`) or changes too rapidly to be persisted to the backend on every update (like `elapsedTime`). This offloads work from the server and provides a more responsive feel.

---

## 3. Key Workflow in Action: Starting a Session

To understand how the layers interact, let's trace a critical user workflow:

1.  **Teacher Action:** The teacher is on the `TeacherDashboard` and clicks the "Start Session" button on a student's card.
2.  **Component Interaction:** This action triggers the `SessionStartDialog` component to open, passing the `studentId`.
3.  **Data Fetching:** Inside `SessionStartDialog`, the `useAvailableUnits(studentId)` hook is called. This hook, defined in `hooks/api/students.ts`, makes a `GET` request to the `/api/students/[studentId]/available-units` endpoint. SWR manages the fetching, loading state, and caching.
4.  **UI Rendering:** The dialog displays a list of available units for the student. The teacher selects a `Unit`.
5.  **User Action & Mutation:** The teacher clicks the final "Start Session" button. This calls the `startSession(studentId, unitId)` function from `hooks/api/sessions.ts`.
6.  **API Call:** The `startSession` function performs a `POST` request to `/api/sessions/start`.
7.  **Navigation:** Upon a successful response from the API, the function returns the new `Session` object. The component then uses Next.js's `useRouter` to navigate the teacher to `/session/[sessionId]`, where `[sessionId]` is the ID of the newly created session.
8.  **Live Session Begins:** The `LiveSession` component mounts. Its `useSession(sessionId)` hook begins polling the `/api/sessions/[sessionId]` endpoint every second, keeping the UI in perfect sync with the backend state machine as the lesson progresses.

---

## 4. Critical Implementation Gaps & Immediate Roadmap

The current frontend provides a solid foundation, but it contains several significant implementation gaps and oversimplifications that must be addressed to achieve production-grade quality. The following tasks are the highest priority for any agent working on this codebase.

### 5.1. Critical Flaw: The "Fire-and-Forget" Asynchronous Job System

-   **Status:** **URGENT & BLOCKING**
-   **Problem Description:** The backend features a robust asynchronous job system to handle long-running tasks (FSRS optimization, bulk imports). The frontend correctly initiates these jobs by calling the appropriate API endpoints. However, it **completely discards the `Job` object returned by the API.** It makes no attempt to track the job's status.
-   **Affected Components:**
    -   `FSRSAnalyticsDashboard.tsx` (`handleOptimizeParameters`, `handleRebuildCache`)
    -   `BulkImportTools.tsx` (`processImport`)
    -   `StudentProfile.tsx` and `StudentsPage.tsx` (when assigning large decks)
-   **Impact on User:** The teacher has zero feedback on critical, long-running operations. They cannot tell if a bulk import is pending, running, has succeeded, or has failed. The "Results" tab in the import tools is permanently non-functional. This breaks a core architectural principle of the application.
-   **Required Action:**
    1.  **Backend Task:** Create a new API endpoint: `GET /api/jobs/[jobId]` that allows the frontend to poll for the status of a specific job.
    2.  **Frontend Hook:** Create a new SWR hook, `useJobStatus(jobId)`, that polls the new endpoint. The polling interval should be configurable and should stop once the job status is `COMPLETED` or `FAILED`.
    3.  **Integration:**
        -   In `FSRSAnalyticsDashboard` and `BulkImportTools`, when a job is created, store the returned `jobId` in the component's state.
        -   Use the `useJobStatus` hook to track the job's progress.
        -   Update the UI dynamically based on the job's status: show a "Processing..." indicator for `PENDING`/`RUNNING`, a success message for `COMPLETED`, and an error alert for `FAILED`.
        -   Enable the currently dead UI elements (like progress bars and results tabs) to display the final `result` or `error` from the job object.

### 5.2. Incomplete Core Feature: The Unit Editor

-   **Status:** **HIGH PRIORITY**
-   **Problem Description:** The `UnitEditor` is the primary tool for creating lesson plans, a core teacher activity. It is currently in a read-only state with several key interactions missing.
-   **Affected Components:** `UnitEditor.tsx`, `UnitBuilder.tsx`
-   **Impact on User:** Teachers can see the exercises in a unit but cannot modify the lesson plan in any meaningful way.
-   **Required Actions:**
    1.  **Implement Drag-and-Drop:** The backend `UnitItem` model has an `order` field. Implement drag-and-drop functionality (using a library like `@hello-pangea/dnd`) in the `UnitEditor` to allow teachers to re-order exercises. On drop, the frontend must call a new backend endpoint to persist the new order for all affected `UnitItem`s in a single transaction.
    2.  **Implement Item Removal:** The `handleRemoveExercise` function exists but is not connected to any UI. Add a "Remove" button to each exercise item in the editor. This button should call the existing `removeUnitItem` API hook.
    3.  **Implement Item Configuration:** The `handleConfigureExercise` function is also a placeholder. Add a "Configure" button that opens a dialog (`ItemConfigDialog`) where teachers can modify the `exerciseConfig` JSON for a `UnitItem` (e.g., change the number of new cards for a vocabulary exercise). This will use the `updateUnitItemConfig` API hook.

### 5.3. Incomplete Core Feature: Student & Content Workflows

-   **Status:** **HIGH PRIORITY**
-   **Problem Description:** Several fundamental workflows for managing students and their learning materials are incomplete.
-   **Affected Components:** `StudentsPage.tsx`, `StudentProfile.tsx`
-   **Impact on User:** Teachers cannot properly onboard new students or assign new decks to existing students, which are primary daily tasks.
-   **Required Actions:**
    1.  **Fix Student Onboarding:** In `StudentsPage.tsx`, replace the hardcoded `'Default Seed Deck'` logic in `handleAddStudent`. The "Add Student" dialog must be enhanced to include a `<Select>` dropdown populated with all available `VocabularyDecks`. The selected deck's ID should be passed to the `createStudent` API call, which uses the `onboard-student` workflow.
    2.  **Implement Deck Assignment:** In `StudentProfile.tsx`, the `handleAssignDeck` function is an empty placeholder. It must be implemented to call the `assignDeck(studentId, deckId)` API hook using the `selectedDeckId` from the dialog's state.

### 5.4. Missing Frontend Logic: The Exercise Dispatcher

-   **Status:** **MEDIUM PRIORITY**
-   **Problem Description:** The backend uses a sophisticated `Dispatcher -> Handler` pattern to manage different exercise types. The frontend `LiveSession` component lacks this, containing only a hardcoded `if` statement for `VOCABULARY_DECK`.
-   **Affected Components:** `LiveSession.tsx`
-   **Impact on User:** The platform cannot be extended with new exercise types (Grammar, Listening, etc.) without rewriting the core `LiveSession` component. The frontend does not respect the extensible architecture of the backend.
-   **Required Action:**
    1.  Create a "dispatcher" object or function within `LiveSession.tsx`.
    2.  This dispatcher will be a map where keys are `UnitItemType` enums and values are the corresponding React components (e.g., `{ VOCABULARY_DECK: VocabularyExercise, GRAMMAR_EXERCISE: GrammarExercise }`).
    3.  In the main render function of `LiveSession`, use the `session.currentUnitItem.type` to look up the correct component from the dispatcher and render it dynamically. This decouples the session manager from the specific exercise implementations.

### 5.5. Performance & Data Integrity Issues

-   **Status:** **MEDIUM PRIORITY**
-   **Problem Description:** Several components fetch more data than necessary and perform calculations on the client that should be handled by the backend, or display "hallucinated" data that doesn't exist.
-   **Affected Components:** `FSRSAnalyticsDashboard.tsx`, `PublicDeckLibrary.tsx`, `StudentProfile.tsx`
-   **Impact on User:** Potential for slow performance on large accounts, and a confusing UI that displays misleading or entirely fake information.
-   **Required Actions:**
    1.  **Refactor FSRS Analytics:** Create new backend endpoints that perform the aggregation of FSRS statistics (e.g., `GET /api/students/[studentId]/fsrs/stats`). The `FSRSAnalyticsDashboard` should call this endpoint instead of fetching the entire list of cards and calculating stats on the client.
    2.  **Remove Fabricated Data:** In `PublicDeckLibrary.tsx`, remove all mocked data fields (`author`, `stats`, `tags`, `difficulty`, etc.) from the component's rendering logic. The UI must be updated to only display the real data provided by the `/api/public-decks` endpoint (`name`, `description`, `card count`).
    3.  **Utilize `available-units`:** In `StudentProfile.tsx`, call the `useAvailableUnits` hook. Display a list of units the student can start, including their readiness status (`isAvailable` and `missingPrerequisites`). This provides immense value to the teacher for planning the next session.

---

## 6. Future Architectural Considerations

-   **State Management in `LiveSession`:** The current implementation uses both SWR polling and a Zustand store. While functional, this creates two sources of truth for session-related data. A future architectural discussion should be held to determine if the state can be unified, perhaps by moving more of the ephemeral state into the `Session.progress` JSON blob on the backend, making SWR the single source of truth for all session state. This is not an immediate bug, but a point for future refinement to improve maintainability.

