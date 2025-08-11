# AGENTS.MD: The Definitive Guide to the Yingyu Backend Architecture

## 0. Manifesto: Our Philosophy & Vision

Welcome, agent. You are now part of a project to build not just an application, but a scientifically-backed pedagogical tool. Before you write a single line of code, you must understand our core philosophy. We are not merely building CRUD endpoints; we are engineering a system that empowers teachers, optimizes learning, and is built with a degree of resilience and architectural integrity that is absolute.

> **Our Prime Directive:** To build a teacher-centric English learning platform that uses a sophisticated FSRS (Free Spaced Repetition Scheduler) engine to provide unprecedented pedagogical insights and operational efficiency. Every architectural decision must serve this directive.

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
-   **Async Processing:** A scheduler (e.g., Vercel Cron) triggers our secure worker endpoint (`/api/worker`), which processes background jobs from a queue in the database. A development-only endpoint (`/api/worker/run`) allows for manual triggering during testing.

---

## 2. Core Architectural Patterns

To truly understand this codebase, you must master its core patterns.

### The Soft-Delete System (via Prisma Extension)

*   **File:** `lib/db.ts`
*   **Problem:** Deleting records (like a `Student` or `VocabularyDeck`) is destructive and can lead to loss of historical data or broken foreign key relationships.
*   **Solution:** We use a global Prisma Client Extension that intercepts all `delete` and `deleteMany` queries for models listed in `ARCHIVABLE_MODELS`. Instead of deleting, it converts the operation into an `update` that sets `isArchived: true`. It also automatically adds `where: { isArchived: false }` to all `find*`, `update*`, and `count` queries.
*   **Implication for You:** You can write `prisma.student.delete(...)` in your code, and the system will handle the soft delete automatically. You never need to manually filter for `isArchived: false`. The database layer handles this protection for you.

### The Asynchronous, Race-Condition-Proof Job System

*   **Files:** `lib/worker.ts`, `lib/actions/jobs.ts`, `app/api/worker/route.ts`
*   **Problem:** Operations like initializing FSRS states for a deck with 500 cards or running a computationally intensive FSRS parameter optimization can take time. We cannot make the teacher wait. Furthermore, how do we prevent multiple worker instances from processing the same job twice?
*   **Solution:**
    1.  Services create a `Job` record in the database with a `PENDING` status (e.g., `FSRSService.createOptimizeParametersJob`).
    2.  A scheduled task calls our secure worker endpoint (`/api/worker`), which is protected by a `CRON_SECRET`.
    3.  The worker (`processPendingJobs`) uses a powerful database-level lock: `SELECT ... FOR UPDATE SKIP LOCKED`. This atomically fetches a batch of pending jobs and immediately locks those rows. Any other concurrent worker instance that runs the same query will *skip* the locked rows and grab the next available ones.
    4.  The worker validates the job's payload with a corresponding Zod schema (e.g., `OptimizeParamsPayloadSchema`) and executes the appropriate internal service method (e.g., `FSRSService._optimizeParameters`).
*   **Implication for You:** For any long-running task, your service should create a job using `JobService.createJob` and return the job object to the API layer. The worker will handle the rest.

### The Session State Machine: The Application's "Brains"

*   **Files:** `lib/actions/sessions.ts`, `lib/exercises/*`
*   **Problem:** A teaching session is a complex state machine. It moves through a `Unit` containing various `UnitItem`s (vocabulary, grammar, etc.). Each item has its own internal states (e.g., "showing the word," "waiting for a rating"). How do we manage this complexity without creating a monolithic, unmaintainable mess?
*   **Solution:** The Dispatcher -> Handler -> Operator pattern.
    1.  **`SessionService` (The General Contractor):** This is the master orchestrator. When an answer is submitted (`submitAnswer`), it wraps the entire operation in a single database transaction.
    2.  **`Dispatcher` (`getHandler`):** The `SessionService` asks the dispatcher for the correct "specialist" based on the current `UnitItemType`.
    3.  **`ExerciseHandler` (The Specialist):** A handler (e.g., `vocabularyDeckHandler`) manages the lifecycle of *one type* of exercise. It knows how to `initialize` its state, how to check if it `isComplete`, and how to `submitAnswer`.
    4.  **`ProgressOperator` (The Subcontractor):** The handler's `submitAnswer` method is also an orchestrator. It looks at the user's specific `action` (e.g., `'SUBMIT_RATING'`) and delegates to the correct, hyper-specific `ProgressOperator`. The operator contains the actual business logic for that single action.
*   **Implication for You:** When adding a new exercise type, you will create a new `Handler` and a set of `Operators` for it. You will then register the handler in the `dispatcher`. The `SessionService` does not need to be changed.

### The FSRS Engine & Simple Learning Steps

*   **File:** `lib/actions/fsrs.ts`
*   **Problem:** New vocabulary needs to be seen several times in quick succession before it's ready for long-term spaced repetition. Throwing a brand new card into the FSRS algorithm immediately can result in awkwardly long initial intervals.
*   **Solution:** We've implemented Anki-style "Learning Steps." The `FSRSService.recordReview` function is the heart of this logic.
    1.  It first checks if a card `_shouldUseLearningSteps` (i.e., it's in a `NEW` or `RELEARNING` state and hasn't completed its steps).
    2.  If so, it uses `_calculateLearningStepsDue` to determine the next due time based on a simple, configurable interval array (e.g., `['3m', '15m', '30m']`). A rating of 'Again' (1) resets the steps.
    3.  Only after a card "graduates" from all its learning steps does `recordReview` pass it to the FSRS engine for true spaced repetition scheduling.
*   **Implication for You:** This is a critical pedagogical feature. The `ReviewHistory` table's `isLearningStep` boolean distinguishes these two types of reviews, which is essential for accurate FSRS parameter optimization.

---

## 3. Core Workflows: Tracing the Logic

Understanding these key workflows will illuminate how the different parts of the system collaborate.

### Workflow: Onboarding a New Student with a Deck

1.  **Entry Point:** A `POST` request hits `/api/workflows/onboard-student`.
2.  **API Route (`/app/api/workflows/onboard-student/route.ts`):** Authenticates the teacher, parses the request body (`studentData`, `initialDeckId`), and delegates the entire operation to the `OnboardingWorkflow`.
3.  **Workflow Layer (`/lib/workflows/onboarding.ts`):** The `onboardStudentWithInitialDeck` function orchestrates the process by first calling `StudentService.createStudent` and then `StudentService.assignDeckToStudent`.
4.  **Service Layer (`/lib/actions/students.ts`):** `assignDeckToStudent` performs its logic within a `prisma.$transaction`. It creates the `StudentDeck` link and, based on deck size, either initializes card states synchronously or creates an `INITIALIZE_CARD_STATES` job for the worker.
5.  **Conclusion:** The workflow returns the new `student` and the `initializationJob` object to the API route. The frontend can now monitor the job's status.

### Workflow: Submitting a Vocabulary Review

1.  **Entry Point:** A `POST` request to `/api/sessions/[sessionId]/submit` with an `action` (e.g., `SUBMIT_RATING`) and `data` (e.g., `{ rating: 3 }`).
2.  **API Route & Service (`/app/api/sessions/[sessionId]/submit/route.ts` -> `SessionService.submitAnswer`):** The `submitAnswer` function wraps the entire logic in a `prisma.$transaction`. It retrieves the current session state and dispatches to the current `UnitItem`'s handler.
3.  **Handler & Operator (`/lib/exercises/vocabularyDeckHandler.ts` -> `/lib/exercises/operators/vocabularyDeckOperators.ts`):** The handler routes the `SUBMIT_RATING` action to the `submitRatingOperator`.
4.  **Operator Logic (`submitRatingOperator.execute`):** This is where the core logic resides. It calls `FSRSService.recordReview` to update the card's FSRS state and log the history. It then re-evaluates the session's card queue and constructs a **new** `SessionProgress` object.
5.  **State Update & Transition:** The operator returns the new progress to the `SessionService`. The service updates the `Session` record, checks if the item is complete, and either transitions to the next item or finishes the transaction.
6.  **Conclusion:** The final, updated `FullSessionState` is returned to the client, which renders the next card or the completion screen.

---

## 4. Directory & File Structure Breakdown

This is your map to the codebase.

```
└── ./
    ├── app/api/         # (API Layer) All Next.js API route handlers. Folder structure maps directly to URL paths.
    ├── lib/             # (Business Logic Layer) The heart of the application.
    │   ├── actions/     # Core service modules (StudentService, ContentService, etc.).
    │   ├── exercises/   # The extensible engine for running live session exercises.
    │   ├── fsrs/        # The FSRS algorithm bridge and engine.
    │   ├── schemas/     # Zod validation schemas for all data structures.
    │   ├── workflows/   # High-level business processes that orchestrate multiple services.
    │   ├── api-utils.ts # Standardized API response and error handling.
    │   ├── auth.ts      # Authorization logic (e.g., ensuring a teacher owns a student record).
    │   ├── db.ts        # Prisma client setup, including the global soft-delete extension.
    │   └── worker.ts    # The core logic for the asynchronous background job processor.
    └── prisma/          # (Data Layer)
        └── schema.prisma# The single source of truth for the database schema.
```

---

## 5. Database Schema Deep Dive (`prisma/schema.prisma`)

The schema is the blueprint of our application's data, organized into logical sections.

#### Core Models
*   `Teacher`: The central user model. Owns students, content, and jobs.
*   `Student`: Represents a teacher's student. Contains profile information, status (`ACTIVE`, `PAUSED`), and is the anchor for most student-specific data.

#### Content & Session Models
*   `Unit`: A lesson plan or a container for exercises.
*   `UnitItem`: A single item within a `Unit`, representing one exercise. It holds the `order` and any specific `exerciseConfig`.
*   `Session`: A record of a live teaching session, linking a `Teacher`, `Student`, and `Unit`. It tracks the `status`, `currentUnitItemId`, and a `progress` JSON blob holding the live state of the current exercise.

#### Exercise Models
*   `VocabularyDeck`: A collection of `VocabularyCard`s.
*   `GrammarExercise`, `ListeningExercise`, etc.: Models demonstrating the system's extensibility.

#### FSRS & Spaced Repetition Models
*   `StudentDeck`: A join table linking a `Student` to a `VocabularyDeck`, representing an "assignment."
*   `StudentCardState`: **Crucial Model.** Tracks a specific student's progress on a specific card. Stores FSRS parameters (`stability`, `difficulty`), the `due` date, and current `state` (`NEW`, `LEARNING`, `REVIEW`, `RELEARNING`).
*   `ReviewHistory`: **The Source of Truth.** An append-only log of every single review. This allows the entire FSRS cache to be rebuilt perfectly.
*   `StudentFsrsParams`: Stores the optimized FSRS weight parameters (`w`) for a student.

#### Asynchronous Job System
*   `Job`: A record of a background task with a `type`, `status`, `payload`, and `result`.

---

## 6. Service Layer Deep Dive (`lib/actions`)

This directory contains the application's soul. Each service is a singleton object with a collection of related methods.

#### `ContentService` (`/lib/actions/content.ts`)
Manages the lifecycle of all learning materials. Key methods include `getUnitWithDetails`, `createUnit`, `addExerciseToUnit` (transactional), `forkExercise` (deep copy), and `_bulkAddVocabularyCards` (internal worker method).

#### `StudentService` (`/lib/actions/students.ts`)
Manages all aspects of a student's profile. Key methods include `getStudentProfile`, `assignDeckToStudent` (transactional, creates jobs), `recordPayment`, and internal worker methods like `_initializeCardStates` and `_bulkAddStudents`.

#### `FSRSService` (`/lib/actions/fsrs.ts`)
The scientific core. This service is the bridge to the FSRS engine.
*   **`recordReview`**: The heart of FSRS. It correctly handles both initial learning steps and main FSRS scheduling.
*   **`getInitialReviewQueue`**: Assembles the card queue for a new session.
*   **`createOptimizeParametersJob` / `createRebuildCacheJob`**: Creates background jobs for heavy FSRS computations.
*   **`_optimizeParameters` / `_rebuildCacheForStudent`**: The internal worker methods that perform the actual FSRS calculations, embodying the "History as Source of Truth" principle.

#### `SessionService` (`/lib/actions/sessions.ts`)
Orchestrates a live teaching session as a state machine. Key methods are `startSession`, `submitAnswer`, `endSession`, and `getFullState`. It delegates all exercise-specific logic to handlers.

---

## 7. API Endpoints Deep Dive (`/app/api`)

All routes are authenticated using a `X-Teacher-ID` header. The structure is RESTful and maps directly to the services.

#### `/bulk-import`
*   `POST /schedules`, `/students`, `/vocabulary`: Endpoints to create bulk import jobs.

#### `/decks`
*   `GET`, `POST`, `DELETE /:deckId`, `GET /:deckId/cards`, `POST /:deckId/cards`, `POST /fork`: Full CRUD and forking for vocabulary decks.

#### `/sessions`
*   `GET`, `POST /start`, `GET /:sessionId`, `DELETE /:sessionId`, `POST /:sessionId/submit`: Full lifecycle management for learning sessions.

#### `/students`
*   `GET`, `GET /:studentId`, `PUT /:studentId`, `DELETE /:studentId`: Full CRUD for student profiles.
*   `GET /:studentId/available-units`: Calculates which lessons a student is ready to start.
*   `POST /:studentId/decks`: Assigns a deck to a student.
*   `PUT /:studentId/notes`, `POST /:studentId/payments`, `GET /:studentId/schedules`, `POST /:studentId/schedules`: Manages student-specific sub-resources.

#### `/students/:studentId/fsrs`
*   `GET /due-cards`, `GET /listening-candidates`: Fetches specific card lists based on FSRS state.
*   `POST /optimize-parameters`, `POST /rebuild-cache`: Creates jobs for FSRS maintenance tasks.

#### `/units`
*   `GET`, `POST`, `GET /:unitId`, `PUT /:unitId`: Full CRUD for lesson plans (Units).
*   `POST /:unitId/items`, `DELETE /:unitId/items/:itemId`: Manages the exercises within a unit.

#### `/worker`
*   `POST /run`: **Development only.** Manually triggers the worker.
*   `POST /`: **Production endpoint.** Secured by a `CRON_SECRET`, this is called by a scheduler to process pending jobs.

---

## 8. How to Contribute & Future Roadmap

### Developer's Guide

1.  **Adhere to the Patterns:** All new features must follow the established architectural patterns. New business logic goes in services or operators. New complex flows go in workflows.
2.  **Validate at the Boundary:** All API routes must validate their inputs using Zod schemas from `lib/schemas.ts`.
3.  **Write Atomically:** Any operation that modifies multiple, related database records must be wrapped in a `prisma.$transaction`.
4.  **Type Everything:** All new data structures should have corresponding types in `lib/types.ts`.
5.  **Offload to the Worker:** If an operation might take more than a few seconds (e.g., processing a large file, complex report generation), create a `Job` for it. Implement the logic as an internal `_` method in the appropriate service and add a case for it in `/lib/worker.ts`.

### Example: Adding a New "Spelling" Exercise Type

1.  **Schema (`prisma/schema.prisma`):** Add `SPELLING_EXERCISE` to the `UnitItemType` enum, create a `SpellingExercise` model, and add the relation to `UnitItem`.
2.  **Content Service (`/lib/actions/content.ts`):** Add a case for `SPELLING_EXERCISE` in `addExerciseToUnit`.
3.  **Exercise Engine (`/lib/exercises`):** Create `spellingExerciseOperators.ts`, `spellingExerciseHandler.ts`, and register the new handler in `dispatcher.ts`.
4.  **API (`/app/api`):** Update the `AddItemBodySchema` in `/app/api/units/[unitId]/items/route.ts` to allow creating the new exercise type.
5.  **Types (`/lib/types.ts`):** Define `SpellingExerciseProgress` and add it to the `SessionProgress` union type.

### Future Roadmap

The current foundation is solid. The next phases of development will build upon it:

1.  **Implement Additional Exercise Handlers:** `GrammarExerciseHandler`, `ListeningExerciseHandler`, etc.
2.  **Build the PDF Generation System:** Create a `GENERATE_PRACTICE_PDF` job type and a service to render practice sheets.
3.  **Implement Full Authentication:** Replace the `X-Teacher-ID` header with a proper JWT implementation (e.g., Clerk, NextAuth.js).

You now have the knowledge. Build with precision, resilience, and adherence to the vision.

# AGENTS.MD: The Definitive Guide to the Yingyu Frontend Architecture

## 0. Manifesto: Our Philosophy & Vision (Frontend Edition)

Welcome, agent. You have familiarized yourself with our backend's core principles. The frontend is the tangible manifestation of that philosophy—it is the cockpit through which the teacher commands the entire pedagogical engine. Our mission is to translate the backend's resilience and power into an experience that is intuitive, responsive, and empowering.

> **Our Frontend Prime Directive:** To provide the teacher with a seamless, responsive, and data-rich interface that makes managing the complexities of personalized education feel effortless. The UI must be a tool of clarity, not a source of cognitive load.

### Our Guiding Principles:

1.  **The UI is the Teacher's Cockpit:** Every component, from a simple button to a complex dashboard, must serve the teacher. We prioritize information clarity, intuitive controls, and workflows that anticipate the teacher's needs. The interface must feel like an extension of their teaching methodology.
2.  **Optimistic UI is Our Standard:** The teacher's actions should feel instantaneous. We employ optimistic updates for all data mutations. When a teacher creates, updates, or deletes something, the UI reflects the change immediately, assuming success. The system only reverts and notifies the user if the backend reports an error. This is the core of a responsive experience.
3.  **State is Explicit and Scoped:** We avoid state management chaos by adhering to a strict hierarchy:
    *   **Server Cache (`SWR`):** The single source of truth for all data fetched from the backend. It handles caching, revalidation, and request deduplication automatically.
    *   **Global Client State (`Zustand`):** Reserved *only* for complex, cross-component state that doesn't belong on the server, such as the real-time state of a live teaching session.
    *   **Local Component State (`useState`):** Used for ephemeral UI state, such as dialog visibility, form inputs, or component-specific toggles.
4.  **Components are Composable and Specialized:** We build small, focused components and compose them into complex pages. A component that fetches data (a "container") is distinct from a component that renders a piece of UI (a "presentational" component). This separation makes our codebase easier to test, maintain, and reason about.
5.  **Never Block the Teacher:** Asynchronous operations are the norm. The UI must *always* provide immediate feedback. We use loading skeletons, disabled buttons, and clear status indicators for long-running backend jobs to ensure the teacher is always informed and the application always feels alive.

Internalize these principles. They are the foundation of every pull request and the standard for every code review.

---

## 1. System Architecture Overview (Frontend)

Our frontend is a modern React application built with Next.js (App Router), TypeScript, and `shadcn/ui`. It is designed as a highly interactive and stateful client that communicates with the Yingyu backend.

```mermaid
graph TD
    subgraph "User Interface (React Components)"
        UI_Pages[Pages in `app/`] --> UI_Containers
        UI_Containers[Container Components in `components/`] --> UI_Primitives[UI Primitives `components/ui`]
    end

    subgraph "State & Data Flow"
        UI_Containers -- triggers action --> Hooks_API[API Hooks `hooks/api/*`]
        UI_Containers -- reads/writes state --> Hooks_Stores[Global State `hooks/stores/*`]
        Hooks_API -- uses --> SWR(SWR Cache)
        Hooks_Stores -- uses --> Zustand(Zustand Store)
    end

    subgraph "Data Access Layer"
        Hooks_API -- calls --> Fetcher[`fetcher()` utility]
        Fetcher -- adds auth header --> Backend_API(Yingyu Backend API)
    end

    subgraph "Live Session Special Case"
        LiveSessionComp[LiveSession Component] <--> LiveSessionStore(useLiveSessionStore)
        LiveSessionStore -- syncs with --> SessionAPIHook[useSession Hook]
        SessionAPIHook -- polls --> Backend_API
    end

    style SWR fill:#cde4ff,stroke:#333,stroke-width:2px
    style Zustand fill:#ffd8b1,stroke:#333,stroke-width:2px
    style Backend_API fill:#d4edda,stroke:#333,stroke-width:2px
```

-   **View Layer (`app/`, `components/`):** Built with React and `shadcn/ui`. The `app` directory uses the Next.js App Router, where folder structure dictates the URL routes. These pages are composed of specialized, reusable "container" components from the `components` directory, which in turn are built from the primitive UI elements in `components/ui`.
-   **State & Caching Layer (`hooks/`):** This is the application's brain.
    -   **SWR:** Manages all server state. Every request to the backend is routed through a `useSWR` hook, which provides robust caching, revalidation, and a single source of truth for backend data.
    -   **Zustand:** Used for complex global client state that is not tied to the server. Its primary use is the `use-live-session-store`, which manages the intricate, real-time state of a teaching session.
-   **Data Access Layer (`hooks/api/`):** A set of custom hooks that abstract all API communication. Each file (e.g., `students.ts`, `content.ts`) corresponds to a backend service. This layer is the only part of the app that knows how to talk to the backend.
-   **Authentication (Placeholder):** Currently, all API requests are authenticated by a mock `X-Teacher-ID` header injected by the `fetcher` utility in `hooks/api/utils.ts`. This is a placeholder for a future JWT-based authentication system.

---

## 2. Core Architectural Patterns

Mastering these patterns is key to contributing effectively to the frontend codebase.

### The SWR Data-Fetching & Caching Strategy

*   **Files:** `hooks/api/*.ts`, `hooks/api/utils.ts`
*   **Problem:** How do we efficiently fetch, cache, and synchronize data from the backend across multiple components without redundant requests or manual state management?
*   **Solution:** We use `SWR` (stale-while-revalidate).
    1.  **Custom Hooks:** For every data entity, we create a custom hook (e.g., `useStudents()`, `useDeck(deckId)`). These hooks encapsulate the `useSWR` logic for a specific API endpoint.
    2.  **Shared Fetcher:** All `SWR` hooks use a single `fetcher` function from `hooks/api/utils.ts`. This function handles the actual `fetch` call, adds the necessary authentication header (`X-Teacher-ID`), and standardizes error handling.
    3.  **Automatic Caching:** `SWR` automatically caches the response. If another component requests the same data (e.g., calls `useStudents()` again), `SWR` serves the cached data instantly, then re-fetches in the background to ensure it's fresh.
*   **Implication for You:** To get data from the backend, you simply call the relevant hook: `const { students, isLoading, isError } = useStudents()`. You never need to write a `fetch` call or manage loading/error state with `useState` for server data. The hook provides everything.

### The Optimistic Mutation Pattern

*   **File:** `hooks/api/utils.ts` (the `mutateWithOptimistic` helper)
*   **Problem:** When a user performs an action (e.g., adds a card), waiting for the server response makes the UI feel sluggish.
*   **Solution:** We update the UI *before* the API call completes.
    1.  All mutation functions (e.g., `createStudent`, `deleteCard`) use our `mutateWithOptimistic` helper.
    2.  This helper takes the API endpoint, method, body, and an optional `optimisticData` object.
    3.  It immediately tells `SWR` to update its local cache with the new data. For example, when deleting a card, we tell `SWR` to update the card list by removing that card.
    4.  The UI re-renders instantly with the updated data.
    5.  The helper then makes the actual API call. If it fails, it automatically reverts the `SWR` cache to its previous state and throws an error, which is caught and displayed as a toast notification.
*   **Implication for You:** Your components will feel incredibly fast. You can write mutation logic that feels synchronous, and the helper handles the complexity of the optimistic update and potential rollback.

### The Live Session State Machine (`useLiveSessionStore`)

*   **File:** `hooks/stores/use-live-session-store.ts`
*   **Problem:** A live teaching session is a highly dynamic and complex state machine. Its state (elapsed time, current card, user's answer, etc.) needs to be accessible and mutable by various child components within the `LiveSession` page, and it must persist across re-renders without relying on constant API polling for every small change.
*   **Solution:** We use a dedicated `Zustand` store.
    1.  **Centralized State:** The store holds all live session state: `sessionId`, `isPaused`, `elapsedTime`, `reviewCount`, `encounteredCards`, and the current exercise `progress` object.
    2.  **Atomic Actions:** It exposes actions to modify this state, such as `initializeSession`, `pauseSession`, `incrementReviewCount`, and `setProgress`.
    3.  **Decoupling:** The `LiveSession` component and its children (like `VocabularyExercise`) read from and call actions on this store. This decouples the components from each other; they only need to know about the store.
    4.  **Synchronization:** The `LiveSession` component is responsible for initializing the store when it first loads the session data from the backend via `useSession`. After that, the store manages the live state, and API calls (`submitAnswer`) are used to update the backend and fetch the *next* state, which is then pushed back into the store.
*   **Implication for You:** When working on the live session UI, you will interact with the `useLiveSessionStore` hook to get the current state and perform actions. This provides a single, predictable source of truth for the entire session.

### The Exercise UI Dispatcher

*   **File:** `components/exercises/dispatcher.tsx`
*   **Problem:** During a session, the UI needs to render different components for different exercise types (Vocabulary, Grammar, etc.). How do we do this dynamically without a giant `if/else` block?
*   **Solution:** A dispatcher pattern, mirroring the backend.
    1.  **Component Map:** The `exerciseDispatcher` is an object that maps a `UnitItemType` enum (from the database) to a specific React component (e.g., `VOCABULARY_DECK: VocabularyExercise`).
    2.  **Dynamic Rendering:** The `LiveSession` component gets the `currentUnitItem.type` from its state. It passes this type to the `getExerciseComponent` function.
    3.  **Lookup:** `getExerciseComponent` looks up the type in the `exerciseDispatcher` map and returns the corresponding component. If a type is not found, it gracefully returns the `UnsupportedExercise` component.
*   **Implication for You:** To add a new exercise UI, you simply create your component (e.g., `SpellingExercise.tsx`), and add a single entry to the `exerciseDispatcher` map. The rest of the session logic remains unchanged.

---

## 3. Core Workflows: Tracing the User Interaction

### Workflow: Adding a New Student with a Deck

1.  **Entry Point (`/app/students/page.tsx`):** The teacher clicks the "Add Student" button. This sets a `useState` variable (`isAddStudentOpen`) to `true`, opening the "Add New Student" `Dialog`.
2.  **Dialog Interaction:** The teacher fills out the form fields, which are bound to another `useState` object (`newStudent`). They select an initial deck from a dropdown populated by the `useDecks` hook.
3.  **API Call (`handleAddStudent`):** On submit, the `handleAddStudent` function is called. It performs basic validation and then calls `createStudent(newStudent, selectedDeckId)` from `hooks/api/students.ts`.
4.  **Optimistic Update & Backend Job:** The `createStudent` function calls our backend's `/api/workflows/onboard-student` endpoint. The backend creates the student and, if the deck is large, returns a `Job` object.
5.  **UI Feedback (`JobStatusIndicator`):** The `StudentsPage` receives the `jobId` from the API response and stores it in state (`addStudentJobId`). This triggers the rendering of the `JobStatusIndicator` component.
6.  **Polling (`useJobStatus`):** The `JobStatusIndicator` component uses the `useJobStatus(addStudentJobId)` hook, which polls the backend's `/api/jobs/:id` endpoint every few seconds. It displays the job's progress to the teacher.
7.  **Completion & Data Revalidation:** When the hook reports the job is `COMPLETED`, its `onComplete` callback is fired. This callback calls `mutate()` from the `useStudents` hook, which tells `SWR` to re-fetch the student list, and the new student now appears in the table.

### Workflow: Submitting a Vocabulary Review in a Live Session

1.  **Entry Point (`/app/session/[sessionId]/page.tsx`):** The `LiveSession` component loads. It uses the `useSession(sessionId)` hook to fetch the initial session state and initializes the `useLiveSessionStore` with this data.
2.  **Component Dispatching:** The `LiveSession` component reads the `currentUnitItem.type` from the store and uses the `ExerciseDispatcher` to render the `VocabularyExercise` component, passing it the necessary actions (`handleRevealAnswer`, `handleRating`).
3.  **State: Presenting Card:** The `VocabularyExercise` component reads the `progress` object from the `useLiveSessionStore`. The `progress.stage` is `PRESENTING_CARD`. It displays the English word and the "Reveal Answer" button.
4.  **Action: Reveal Answer:** The teacher clicks "Reveal Answer".
    *   The `handleRevealAnswer` function in `LiveSession` is called.
    *   It sets `isActionLoading` to `true` in the store to disable buttons.
    *   It calls `submitAnswer(sessionId, { action: 'REVEAL_ANSWER' })`.
    *   The backend processes this, updates the session's `progress` JSON to set the stage to `AWAITING_RATING`, and returns the new `FullSessionState`.
    *   The `submitAnswer` promise resolves, and the new state's `progress` object is pushed into the `useLiveSessionStore` via `setProgress`.
5.  **State: Awaiting Rating:** The `VocabularyExercise` component re-renders. It now sees the `progress.stage` is `AWAITING_RATING` and displays the Chinese translation and the four rating buttons (Again, Hard, Good, Easy).
6.  **Action: Submit Rating:** The teacher clicks "Good" (rating: 3).
    *   The `handleRating(3)` function is called.
    *   It optimistically calls `incrementReviewCount()` on the store.
    *   It calls `submitAnswer(sessionId, { action: 'SUBMIT_RATING', data: { rating: 3 } })`.
    *   The backend's `FSRSService` calculates the next review, updates the `StudentCardState`, logs the `ReviewHistory`, and prepares the next card in the session queue. It returns the final, new `FullSessionState`.
    *   The new `progress` object, now containing the *next* card, is pushed to the store.
7.  **Conclusion:** The `LiveSession` component re-renders, displaying the next card. The cycle repeats.

---

## 4. Directory & File Structure Breakdown

This is your map to the frontend codebase.

```
└── ./
    ├── app/                  # (View Layer) Next.js App Router. Folder structure maps to URL paths.
    │   ├── (page-group)/     # Each folder is a route segment.
    │   │   └── page.tsx      # The React component that renders the UI for that route.
    │   └── layout.tsx        # The root layout, includes Sidebar, ThemeProvider, etc.
    ├── components/           # (View Layer) Reusable React components.
    │   ├── exercises/        # Specialized components for each exercise type.
    │   │   ├── dispatcher.tsx# Maps exercise types to components.
    │   │   └── *.tsx         # e.g., VocabularyExercise.tsx, GrammarExercise.tsx
    │   ├── ui/               # UI primitives from shadcn/ui (Button, Card, etc.).
    │   └── *.tsx             # High-level "container" components (StudentProfile, UnitBuilder, etc.).
    ├── hooks/                # (State & Data Layer) All React hooks. The application's "brains".
    │   ├── api/              # Data fetching hooks that communicate with the backend.
    │   │   ├── content.ts    # Hooks and mutations for Units, Decks, Cards.
    │   │   ├── students.ts   # Hooks and mutations for Students, Payments, Schedules.
    │   │   ├── sessions.ts   # Hooks and mutations for Live Sessions.
    │   │   └── utils.ts      # The shared `fetcher` and `mutateWithOptimistic` helpers.
    │   ├── stores/           # Global client-side state management.
    │   │   └── use-live-session-store.ts # Zustand store for live session state.
    │   └── use-*.ts          # Utility hooks (useToast, useMobile, etc.).
    ├── lib/                  # Shared utilities, types, and constants.
    │   ├── types.ts          # Core TypeScript type definitions shared across the app.
    │   └── utils.ts          # General utility functions (e.g., cn for classnames).
    └── prisma/               # (Data Layer Schema)
        └── schema.prisma     # Shared with backend, defines the database structure.
```

---

## 5. The Data Layer: `hooks/api` Deep Dive

This directory is the sole intermediary between the frontend and the backend API. It ensures all data access is consistent, cached, and resilient.

#### `students.ts`
-   **`useStudents()`:** Fetches all students for the teacher. Used in the main student list (`/students`).
-   **`useStudent(studentId)`:** Fetches a single, detailed student profile. Used in `/students/[studentId]`.
-   **`useAvailableUnits(studentId)`:** Fetches the units a student is ready to start. Crucial for the `SessionStartDialog`.
-   **`createStudent(...)`:** Calls the `onboard-student` workflow. Returns a `Job` if card initialization is needed.
-   **`recordPayment(...)`, `createSchedule(...)`:** Functions for creating student sub-resources.

#### `content.ts`
-   **`useDecks()`, `useUnits()`:** Fetches all decks or units for the teacher.
-   **`useDeck(deckId)`, `useUnit(unitId)`:** Fetches a single deck or unit with its details.
-   **`useDeckCards(deckId)`:** Fetches all `VocabularyCard`s for a specific deck. Powers the `VocabularyCardManager`.
-   **`addCardToDeck(...)`, `updateCard(...)`, `deleteCard(...)`:** Full CRUD operations for vocabulary cards.
-   **`forkDeck(...)`:** Imports a public deck into the teacher's private collection.

#### `sessions.ts`
-   **`useSessions()`:** Fetches a history of all past and in-progress sessions.
-   **`useSession(sessionId)`:** Fetches the real-time state of a single live session. Configured to poll for updates.
-   **`startSession(...)`:** Creates a new session record and returns its initial state.
-   **`submitAnswer(...)`:** The workhorse of a live session. Sends the user's action (`REVEAL_ANSWER`, `SUBMIT_RATING`) and payload to the backend.
-   **`endSession(...)`:** Marks a session as complete.

#### `jobs.ts`
-   **`useJobStatus(jobId)`:** A polling hook that repeatedly fetches a job's status until it is `COMPLETED` or `FAILED`. Essential for providing feedback on asynchronous operations.

---

## 6. The Component Library: `components` Deep Dive

This is a tour of the most important, high-level components that define the application's features.

-   **`TeacherDashboard.tsx`:** The application's home page. Displays high-level statistics (active students, upcoming classes) and a grid of student cards for quick access.
-   **`StudentProfile.tsx`:** The main view for a single student (`/students/[studentId]`). It acts as a container, managing a tabbed interface that displays other specialized components like `PaymentManager`, `ClassScheduler`, and `AvailableUnitsList`.
-   **`VocabularyCardManager.tsx`:** A comprehensive interface for managing the cards within a deck. It includes a searchable and filterable `DataTable`, along with dialogs for adding and editing cards with numerous fields. It also integrates the `BulkImportTools` component.
-   **`UnitBuilder.tsx`:** A highly interactive, drag-and-drop interface for creating lesson plans (`Units`). It uses `hello-pangea/dnd` to allow teachers to reorder exercises and includes complex dialogs for configuring each `UnitItem`.
-   **`LiveSession.tsx`:** The heart of the teaching experience. This component orchestrates the entire live session view. It manages the timer, the pause/resume state, and uses the `ExerciseDispatcher` to render the correct exercise UI based on the state from `useLiveSessionStore`.
-   **`FSRSAnalyticsDashboard.tsx`:** A data-rich component that visualizes a student's FSRS statistics. It uses multiple data hooks (`useDueCards`, `useFsrsStats`) and presents the information in charts, tables, and stat cards.
-   **`DataTable.tsx`:** Our generic, reusable table component. It is used throughout the application and provides out-of-the-box sorting, searching, and pagination, significantly reducing boilerplate for displaying tabular data.
-   **`SessionStartDialog.tsx`:** A sophisticated dialog that allows the teacher to select an available unit and override default exercise configurations (e.g., number of new cards) before starting a session.
-   **`JobStatusIndicator.tsx`:** A small but critical component that provides a standardized, real-time UI for tracking the progress of a backend background job.

---

## 7. How to Contribute & Future Roadmap

### Developer's Guide

1.  **Follow the Hook Pattern:** All new data fetching logic must be encapsulated in a `useSWR` hook within the `hooks/api/` directory. Do not use `fetch` directly in your components.
2.  **Mutate Optimistically:** All API calls that change data (POST, PUT, DELETE) must use the `mutateWithOptimistic` helper from `hooks/api/utils.ts` to ensure a responsive UI.
3.  **Handle All States:** Every component that relies on a data hook *must* handle the `isLoading` and `isError` states. Use `Skeleton` components for loading and `Alert` components for errors.
4.  **Build with the Kit:** Construct all new UIs by composing primitive components from `components/ui/` (`Card`, `Button`, `Dialog`, etc.). Maintain a consistent look and feel.
5.  **Type Strictly:** All new data structures, API payloads, and component props must be strictly typed in `lib/types.ts` or locally.

### Example: Adding a New "Spelling" Exercise UI

1.  **API Hooks (`/hooks/api/sessions.ts`):** Ensure the `AnswerPayload` type in `lib/types.ts` can accommodate the action for your new exercise (e.g., `action: 'SUBMIT_SPELLING'`, `data: { answer: string }`). The generic `submitAnswer` function will already handle sending it.
2.  **Exercise Component (`/components/exercises/`):** Create a new file `SpellingExercise.tsx`. This component will receive `sessionState`, `onSubmitRating` (or a new `onSubmitSpelling` function), and `isLoading` as props. It will read the current spelling question from `sessionState.progress.payload` and render an input field and submit button.
3.  **Dispatcher (`/components/exercises/dispatcher.tsx`):** Import your new `SpellingExercise` component. Add an entry to the `exerciseDispatcher` map: `[UnitItemType.SPELLING_EXERCISE]: SpellingExercise`.
4.  **Types (`/lib/types.ts`):** Define the `SpellingExerciseProgress` interface, detailing its `payload` and `stage`, and add it to the `SessionProgress` union type. This ensures type safety throughout the session flow.

### Future Roadmap

1.  **Implement Missing Exercise UIs:** Build out the React components for `GrammarExercise` and `ListeningExercise` to bring them to life in the `LiveSession` view.
2.  **Build the PDF Generation UI:** Create a `ReportService` on the frontend with a button that triggers the `GENERATE_PRACTICE_PDF` job. Use the `JobStatusIndicator` to track progress and provide a download link when the job's `result` contains the PDF URL.
3.  **Implement Full Authentication:** Replace the mock `X-Teacher-ID` header in `hooks/api/utils.ts` with a proper authentication solution like Clerk or NextAuth.js. This will involve creating a login page (`/app/login`), managing JWTs, and wrapping the application in an auth provider context.
4.  **Enhance Mobile Responsiveness:** Systematically review and improve components for smaller screens, using the `useIsMobile` hook where necessary to render mobile-specific layouts.

You are now equipped with the knowledge to navigate and contribute to the Yingyu frontend. Build with the teacher in mind, prioritize a responsive experience, and adhere to the established patterns.
