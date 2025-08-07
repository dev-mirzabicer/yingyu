# (BACKEND) The Definitive Guide to the Ultimate English Teaching App

---

## **0. Manifesto: Our Philosophy & Vision**

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

## **1. System Architecture Overview**

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

## **2. Core Concepts & Architectural Patterns**

To understand this codebase, you must understand its core patterns.

### **The Soft-Delete System (via Prisma Extension)**

-   **File:** `lib/db.ts`
-   **Problem:** Deleting records (like a `Student` or `VocabularyDeck`) is destructive and can lead to loss of historical data or broken foreign key relationships.
-   **Solution:** We use a global Prisma Client Extension that intercepts all `delete` and `deleteMany` queries for models listed in `ARCHIVABLE_MODELS`. Instead of deleting, it converts the operation into an `update` that sets `isArchived: true`. It also automatically adds `where: { isArchived: false }` to all `find*`, `update*`, and `count` queries.
-   **Implication for You:** You can write `prisma.student.delete(...)` in your code, and the system will handle the soft delete automatically. You never need to manually filter for `isArchived: false`. The database layer handles this protection for you.

### **The Asynchronous, Race-Condition-Proof Job System**

-   **Files:** `lib/worker.ts`, `lib/actions/jobs.ts`, `app/api/worker/route.ts`
-   **Problem:** Operations like initializing FSRS states for a deck with 500 cards or running a computationally intensive FSRS parameter optimization can take time. We cannot make the teacher wait. Furthermore, how do we prevent multiple worker instances from processing the same job twice?
-   **Solution:**
    1.  Services create a `Job` record in the database with a `PENDING` status (e.g., `FSRSService.createOptimizeParametersJob`).
    2.  A scheduled task calls our secure worker endpoint (`/api/worker`), which is protected by a `CRON_SECRET`.
    3.  The worker (`processPendingJobs`) uses a powerful database-level lock: `SELECT ... FOR UPDATE SKIP LOCKED`. This atomically fetches a batch of pending jobs and immediately locks those rows. Any other concurrent worker instance that runs the same query will *skip* the locked rows and grab the next available ones.
    4.  The worker validates the job's payload with a corresponding Zod schema (e.g., `OptimizeParamsPayloadSchema`) and executes the appropriate internal service method (e.g., `FSRSService._optimizeParameters`).
-   **Implication for You:** For any long-running task, your service should create a job using `JobService.createJob` and return the job object to the API layer. The worker will handle the rest.

### **The Session State Machine: The Application's "Brains"**

-   **Files:** `lib/actions/sessions.ts`, `lib/exercises/*`
-   **Problem:** A teaching session is a complex state machine. It moves through a `Unit` containing various `UnitItem`s (vocabulary, grammar, etc.). Each item has its own internal states (e.g., "showing the word," "waiting for a rating"). How do we manage this complexity without creating a monolithic, unmaintainable mess?
-   **Solution:** The Dispatcher -> Handler -> Operator pattern.
    1.  **`SessionService` (The General Contractor):** This is the master orchestrator. When an answer is submitted (`submitAnswer`), it wraps the entire operation in a single database transaction.
    2.  **`Dispatcher` (`getHandler`):** The `SessionService` asks the dispatcher for the correct "specialist" based on the current `UnitItemType`.
    3.  **`ExerciseHandler` (The Specialist):** A handler (e.g., `vocabularyDeckHandler`) manages the lifecycle of *one type* of exercise. It knows how to `initialize` its state, how to check if it `isComplete`, and how to `submitAnswer`.
    4.  **`ProgressOperator` (The Subcontractor):** The handler's `submitAnswer` method is also an orchestrator. It looks at the user's specific `action` (e.g., `'SUBMIT_RATING'`) and delegates to the correct, hyper-specific `ProgressOperator`. The operator contains the actual business logic for that single action.
-   **Implication for You:** When adding a new exercise type, you will create a new `Handler` and a set of `Operators` for it. You will then register the handler in the `dispatcher`. The `SessionService` does not need to be changed.

### **The FSRS Engine & Simple Learning Steps**

-   **File:** `lib/actions/fsrs.ts`
-   **Problem:** New vocabulary needs to be seen several times in quick succession before it's ready for long-term spaced repetition. Throwing a brand new card into the FSRS algorithm immediately can result in awkwardly long initial intervals.
-   **Solution:** We've implemented Anki-style "Learning Steps." The `FSRSService.recordReview` function is the heart of this logic.
    1.  It first checks if a card `_shouldUseLearningSteps` (i.e., it's in a `NEW` or `RELEARNING` state and hasn't completed its steps).
    2.  If so, it uses `_calculateLearningStepsDue` to determine the next due time based on a simple, hardcoded interval array (e.g., `['3m', '15m', '30m']`). A rating of 'Again' (1) resets the steps.
    3.  Only after a card "graduates" from all its learning steps does `recordReview` pass it to the FSRS engine for true spaced repetition scheduling.
-   **Implication for You:** This is a critical pedagogical feature. The `ReviewHistory` table's `isLearningStep` boolean distinguishes these two types of reviews, which is essential for accurate FSRS parameter optimization.

---

## **3. File-by-File Deep Dive**

This section details the responsibility of every key file in the `lib` and `app/api` directories.

### **`lib/` (Core Logic)**

#### **`lib/db.ts`**
-   **Responsibility:** Creates and exports the singleton, extended Prisma client.
-   **Key Logic:** Implements the global Prisma Client Extension for automatic soft deletes on `ARCHIVABLE_MODELS`. This is foundational to our data integrity strategy.

#### **`lib/auth.ts`**
-   **Responsibility:** Provides authorization utilities.
-   **`authorizeTeacherForStudent`:** The cornerstone of our security model. It verifies that a teacher owns a student resource before any action can be taken. It can also optionally check if the student is `ACTIVE`.
-   **`AuthorizationError`:** A custom error class that allows our API layer (`handleApiError`) to return a `403 Forbidden` status cleanly.

#### **`lib/schemas.ts`**
-   **Responsibility:** Defines all Zod schemas for input validation. This is our first line of defense against bad data.
-   **Key Schemas:**
    -   `CreateStudentSchema`, `RecordPaymentSchema`, `CreateUnitSchema`: Used by API routes to validate request bodies.
    -   `InitializeCardStatesPayloadSchema`, `RebuildCachePayloadSchema`, `OptimizeParamsPayloadSchema`: **Crucial** for the reliability of the background worker. Ensures job payloads are valid before processing.
    -   `VocabularyExerciseConfigSchema`: Validates the per-item configuration for vocabulary sessions, including `newCards`, `maxDue`, and custom `learningSteps`.

#### **`lib/types.ts`**
-   **Responsibility:** The application's data contract. Defines all custom TypeScript types.
-   **Key Types:**
    -   `FullSessionState`: The master type for a live session. It's what the frontend receives to render the entire session UI.
    -   `SessionProgress`: A discriminated union (`VocabularyDeckProgress | ...`) that strongly types the `progress` JSON field on the `Session` model.
    -   `AnswerPayload`: The strict contract for all submissions, forcing an `action` field (`REVEAL_ANSWER`, `SUBMIT_RATING`).
    -   `AvailableUnit`: An extended `Unit` type used by the `/api/students/[studentId]/available-units` endpoint to show teachers which lessons a student is ready for.

#### **`lib/prisma-includes.ts`**
-   **Responsibility:** Defines reusable Prisma `include` objects to prevent repetition and ensure type safety.
-   **`fullSessionStateInclude`:** A constant used by `SessionService` to ensure that every query for a session's state fetches the exact same, complete set of related data, matching the `FullSessionState` type perfectly.

### **`lib/actions/` (The Service Layer)**

#### **`students.ts` (StudentService)**
-   **Responsibility:** Manages all logic related to students, their profiles, payments, schedules, and deck assignments.
-   **Key Functions:**
    -   `createStudent`, `archiveStudent`, `updateStudent`, `getStudentProfile`: Core CRUD with authorization checks.
    -   `assignDeckToStudent`: An atomic operation that creates the `StudentDeck` link. It intelligently decides whether to initialize card states synchronously (for small decks <= 50 cards) or create an `INITIALIZE_CARD_STATES` job (for large decks).
    -   `createSchedule`, `updateSchedule`, `deleteSchedule`: Manages a student's class schedule.
    -   `_initializeCardStates`: The internal method called *by the worker* to perform the bulk creation of `StudentCardState` records.

#### **`content.ts` (ContentService)**
-   **Responsibility:** Manages the global content repository (Units, Decks, Exercises).
-   **Key Functions:**
    -   `createUnit`, `updateUnit`: Manages lesson plans. `updateUnit` contains critical logic preventing public units from containing private exercises.
    -   `addExerciseToUnit`: Atomically adds a new or existing exercise to a unit.
    -   `forkExercise`: Implements the "fork-on-edit" pattern. Performs a deep copy of a public deck and all its cards, creating a new private copy for a teacher.
    -   `addCardToDeck`: Adds a new `VocabularyCard` to a deck, ensuring the teacher owns the deck.
    -   `updateUnitItemConfig`: Allows a teacher to set per-session parameters (e.g., number of new cards) on a `UnitItem`.

#### **`fsrs.ts` (FSRSService)**
-   **Responsibility:** The scientific core. All interactions with the FSRS engine and scheduling logic are encapsulated here.
-   **Key Functions:**
    -   `recordReview`: **The most important function in this file.** It's a perfected, atomic implementation that decides whether to apply learning steps or FSRS scheduling, calculates the next state for a card, and updates the database (`StudentCardState` and `ReviewHistory`).
    -   `getInitialReviewQueue`: Assembles the mixed queue of new and due cards for a vocabulary session.
    -   `createOptimizeParametersJob`: Creates a background job to calculate optimal FSRS weights for a student based on their review history.
    -   `_optimizeParameters`: The internal worker method that performs the FSRS parameter calculation.
    -   `_rebuildCacheForStudent`: The internal worker method that rebuilds the `StudentCardState` cache from the `ReviewHistory` source of truth.

#### **`sessions.ts` (SessionService)**
-   **Responsibility:** The master orchestrator for live teaching sessions.
-   **Key Functions:**
    -   `startSession`: Creates the session and calls the appropriate handler to initialize the first item.
    -   `submitAnswer`: **The most important function in this file.** It manages the entire state transition for a user's answer within a single, all-encompassing database transaction, delegating the actual logic to the handler/operator pattern.
    -   `endSession`: Cleanly terminates a session.

#### **`jobs.ts` (JobService)** & **`teacher.ts` (TeacherService)**
-   **Responsibility:** Simple, focused services for creating/retrieving jobs and managing teacher settings, respectively.

### **`lib/workflows/` (The Workflow Layer)**

#### **`onboarding.ts` (OnboardingWorkflow)**
-   **Responsibility:** Encapsulates the multi-step process of creating a student and setting up their first deck.
-   **`onboardStudentWithInitialDeck`:** Provides a single, clean entry point for the API layer, hiding the complexity of coordinating `StudentService` and `JobService`.

### **`lib/exercises/` (The Exercise Handling Layer)**

-   **`dispatcher.ts`:** Contains the `getHandler` map that links a `UnitItemType` to its corresponding `ExerciseHandler`.
-   **`handler.ts`:** Defines the `ExerciseHandler` interface, the contract for all exercise-type-specific logic.
-   **`vocabularyDeckHandler.ts`:** The `ExerciseHandler` for vocabulary. Its `initialize` method builds the initial interleaved queue. Its `submitAnswer` method dispatches to the correct operator.
-   **`operators/base.ts`:** Defines the `ProgressOperator` interface, the contract for the most granular pieces of business logic.
-   **`operators/vocabularyDeckOperators.ts`:** Contains the actual state transition logic. `SubmitRatingOperator` is the home of the critical dynamic queue implementation. After recording a review, it re-queries the DB for all due cards in the current deck and rebuilds the queue on the fly.

### **`app/api/` (The API Layer)**

This layer is a direct mapping of our application's features to HTTP endpoints. Each `route.ts` file typically handles authentication, parameter/body validation, calls a single service method, and returns a standardized response using `apiResponse` and `handleApiError`.

-   **/decks/...**: CRUD for vocabulary decks and their cards. Includes `fork` for copying public decks.
-   **/health**: A simple health check endpoint for monitoring.
-   **/items/...**: For updating the `exerciseConfig` of a `UnitItem`.
-   **/schedules/...**: For managing student class schedules.
-   **/sessions/...**: For starting, ending, getting the state of, and submitting answers to a live session.
-   **/students/...**: The richest set of endpoints. Manages student CRUD, but also provides access to nested resources like `available-units`, `decks`, `notes`, `payments`, `schedules`, and FSRS-related data (`due-cards`, `listening-candidates`).
-   **/teacher/settings**: Manages teacher-specific preferences.
-   **/units/...**: CRUD for units (lesson plans) and their items.
-   **/worker/...**: Endpoints to trigger the background job processor.
-   **/workflows/onboard-student**: The endpoint for the high-level onboarding workflow.

---

## **4. Key Workflows in Action**

To connect all the pieces, let's trace two critical workflows.

### **Workflow 1: Onboarding a New Student**

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

### **Workflow 2: Submitting a Vocabulary Review (in Learning Steps)**

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

## **5. How to Contribute**

1.  **Adhere to the Patterns:** All new features must follow the established architectural patterns. New business logic goes in services or operators. New complex flows go in workflows.
2.  **Validate at the Boundary:** All API routes must validate their inputs using Zod schemas from `lib/schemas.ts`.
3.  **Write Atomically:** Any operation that modifies multiple, related database records must be wrapped in a `prisma.$transaction`.
4.  **Type Everything:** All new data structures should have corresponding types in `lib/types.ts`.

---

## **6. Future Roadmap**

The current foundation is solid. The next phases of development will build upon it:

1.  **Implement Additional Exercise Handlers:**
    -   `GrammarExerciseHandler`
    -   `ListeningExerciseHandler`
    -   `VocabFillInBlankExerciseHandler`
2.  **Build the PDF Generation System:**
    -   Create a new `JobType` for `GENERATE_PRACTICE_PDF`.
    -   Implement a service that uses a headless browser (e.g., Puppeteer) to render practice sheets based on a student's due cards.
3.  **Implement Full Authentication:**
    -   Replace the `X-Teacher-ID` header with a proper NextAuth.js or similar JWT-based implementation.

You now have the knowledge. Build with precision, resilience, and adherence to the vision.

# The Definitive Guide to the Ultimate English Teaching App (Frontend)

---

## **0. Manifesto: Our Philosophy & Vision (Frontend Edition)**

Welcome, agent. You have understood our backend's core principles of resilience and data integrity. Now, you must learn how we translate that philosophy into a fluid, intuitive, and powerful user interface for the teacher. The frontend is not a mere presentation layer; it is a meticulously crafted instrument designed to be an extension of the teacher's own mind.

> **Our Frontend Prime Directive:** To create a blazingly fast, responsive, and predictable user interface that empowers the teacher. The UI must minimize cognitive load, provide instantaneous feedback, and gracefully handle the complexities of a real-time teaching environment. Every component, hook, and state management decision must serve this directive.

### Our Guiding Principles (Frontend):

1.  **The Teacher's Cockpit:** The UI is a professional cockpit, not a consumer application. Information density is a feature. Workflows are optimized for efficiency, minimizing clicks and surfacing the right information at the right time. We prioritize clarity and control over simplistic aesthetics.
2.  **State is Explicit and Stratified:** We maintain a strict hierarchy of state.
    *   **Server Cache State (SWR):** Data that lives on the server is managed by SWR. It is our local, automatically-synced mirror of the database.
    *   **Global UI State (Zustand):** Transient, client-side state that affects multiple components (e.g., the live session timer, pause state) is managed by Zustand. It is lightweight and ephemeral.
    *   **Local Component State (`useState`):** State confined to a single component (e.g., a dialog's open/closed status) is managed with standard React hooks.
    This stratification prevents bugs and makes state management predictable.
3.  **Optimistic UI is the Standard:** The teacher must never feel like they are waiting for the application. All mutations (creating, updating, deleting) are reflected in the UI *instantly* using optimistic updates. The UI then reconciles with the server's response. This is the core of our responsive feel, handled by our `mutateWithOptimistic` utility.
4.  **Components are Specialized:** We follow a strict Page -> Feature -> UI component hierarchy.
    *   **Pages (`app/`):** Handle routing and compose Feature components.
    *   **Feature Components (`components/`):** Are "smart." They manage a whole feature (e.g., `StudentProfile`, `LiveSession`), fetch data via hooks, and orchestrate actions.
    *   **UI Components (`components/ui/`):** Are "dumb." They are presentation-only, receiving props and rendering HTML, ensuring maximum reusability and design consistency (powered by `shadcn/ui`).
5.  **The API is an Abstraction:** Components do not know about `fetch`, API endpoints, or HTTP methods. They interact with a clean, domain-specific API abstraction layer (`hooks/api/*.ts`). A component calls `createStudent(data)`, not `fetch('/api/students', ...)`. This makes components cleaner and decouples them from the network layer.

Internalize these principles. They are the foundation of a robust, maintainable, and delightful-to-use frontend.

---

## **1. System Architecture Overview (Frontend)**

Our frontend is a modern Next.js application built with the App Router, TypeScript, and Tailwind CSS. It employs a highly organized, hook-based architecture for logic and state management.

```mermaid
graph TD
    subgraph "User Interface (React Components)"
        Pages[Pages (`app/**/page.tsx`)] --> FeatureComponents[Feature Components (`components/*.tsx`)]
        FeatureComponents --> UIComponents[UI Primitives (`components/ui/*.tsx`)]
    end

    subgraph "Logic & State Layer (Hooks)"
        FeatureComponents -- uses --> APIHooks[API Hooks (`hooks/api/*.ts`)]
        FeatureComponents -- uses --> GlobalState[Global UI State (`hooks/stores/use-live-session-store.ts`)]
        FeatureComponents -- uses --> UtilityHooks[Utility Hooks (`hooks/use-ui-preferences.ts`)]
    end

    subgraph "Data Fetching & Caching"
        APIHooks -- built on --> SWR(SWR Core)
        SWR -- manages cache for --> APIEndpoints[Backend API Endpoints]
    end

    subgraph "Global State Management"
        GlobalState -- powered by --> Zustand(Zustand Core)
    end

    APIEndpoints -- HTTP Requests --> Backend[(Backend API Layer)]

    style SWR fill:#cde4ff,stroke:#333,stroke-width:2px
    style Zustand fill:#d8b1ff,stroke:#333,stroke-width:2px
    style Backend fill:#cde4ff,stroke:#333,stroke-width:2px
```

-   **Routing Layer (`app/`):** Uses the Next.js App Router. Each route is a directory containing a `page.tsx` file. These are server-rendered by default but designated as `"use client"` to leverage hooks for interactivity. Their primary role is to fetch initial data and render the main "Feature Component" for that page.
-   **Component Layer (`components/`):**
    -   **Feature Components** (e.g., `StudentProfile`, `LiveSession`, `ClassScheduler`): These are the workhorses of the application. They encapsulate entire features, use hooks to manage state and data, and compose smaller UI components.
    -   **UI Primitives** (`components/ui/`): These are the `shadcn/ui` components—our design system. They are presentation-only and know nothing about the `application's` logic.
-   **Hooks Layer (`hooks/`):** The "brains" of the frontend.
    -   **API Hooks (`hooks/api/`):** The single point of contact with the backend. It abstracts all data fetching and mutations into simple, reusable hooks (e.g., `useStudents()`, `createDeck()`).
    -   **State Stores (`hooks/stores/`):** Home to our Zustand stores, primarily `useLiveSessionStore`, for managing complex, transient UI state that is shared across components but doesn't belong on the server.
    -   **Utility Hooks (`use-ui-preferences.ts`, `use-mobile.ts`):** Provide cross-cutting functionality like managing user preferences from `localStorage` or detecting mobile viewports.

---

## **2. Core Concepts & Architectural Patterns**

Master these patterns to understand the application's flow.

### **The API Abstraction Layer & Optimistic Updates**

-   **Files:** `hooks/api/utils.ts`, `hooks/api/students.ts`, `hooks/api/content.ts`, etc.
-   **Problem:** Components shouldn't be cluttered with `fetch` logic, headers, and error handling. Furthermore, when a user performs an action, the UI should update instantly, without waiting for a server round-trip.
-   **Solution:**
    1.  **The Abstraction:** We create custom hooks and functions that mirror the backend API (e.g., `useStudents`, `createStudent`). Components use these simple functions instead of raw `fetch`.
    2.  **The Fetcher (`utils.ts`):** A global `fetcher` function is used by SWR to handle all `GET` requests. It automatically attaches the mock `X-Teacher-ID` header (a placeholder for future authentication) and standardizes error handling.
    3.  **The Mutator (`utils.ts`):** The `mutateWithOptimistic` function is our secret weapon for a fast UI. When a component calls an action like `createStudent(data)`, this utility:
        a. Immediately updates the local SWR cache with the *expected* new state.
        b. Sends the actual request to the backend.
        c. If the request succeeds, it re-fetches the data from the server to get the canonical state.
        d. If the request fails, it automatically rolls back the optimistic update and throws an error.
-   **Implication for You:** When you call `createStudent`, the new student appears in the UI *instantly*. You never have to manually manage loading states or update the local data array after a successful API call. The API hook layer handles it all.

### **Stratified State Management: SWR + Zustand**

-   **Files:** `hooks/api/*.ts` (SWR), `hooks/stores/use-live-session-store.ts` (Zustand)
-   **Problem:** How do we manage data from the server versus temporary UI state without creating a tangled mess?
-   **Solution:** A strict separation of concerns.
    -   **SWR for Server Cache:** All data that originates from the database (students, decks, units, sessions) is fetched and managed by SWR via our API hooks. SWR handles caching, revalidation on window focus, and keeping data fresh. Components simply call `const { students } = useStudents()` and the data is always available and up-to-date.
    -   **Zustand for Global UI State:** State that is temporary, client-side, and shared is put in a Zustand store. The prime example is `useLiveSessionStore`, which tracks the session timer, pause state, and loading state for actions *within* a live session. This state is irrelevant to the server and is discarded when the session ends.
-   **Implication for You:** When you need data from the backend, create or use a `use...` hook in `hooks/api`. When you need to share temporary UI state between components (e.g., a loading spinner and button disabled state), use a Zustand store. Never mix the two.

### **Component Hierarchy: Page -> Feature -> UI**

-   **Files:** `app/`, `components/`, `components/ui/`
-   **Problem:** A flat component structure becomes unmanageable. We need a clear system for organizing components based on their responsibilities.
-   **Solution:**
    1.  **Pages (`app/students/[studentId]/page.tsx`):** The highest level. A `page.tsx` file is the entry point for a URL. Its job is to use an API hook to fetch the primary data for the page (e.g., `useStudent(studentId)`) and pass it to the main Feature component.
    2.  **Feature Components (`components/student-profile.tsx`):** These are large, "smart" components that represent a whole section of the application. `StudentProfile` takes the `studentId` as a prop, uses the `useStudent` hook itself, and then renders various tabs and sub-components (`PaymentManager`, `ClassScheduler`) to display and manage all aspects of that student. It contains the business logic and event handlers for that feature.
    3.  **UI Components (`components/ui/button.tsx`):** These are the "dumb" building blocks from `shadcn/ui`. They are completely decoupled from our application. `Button` doesn't know what a "student" is; it just knows how to be a button.
-   **Implication for You:** When building a new screen, you will create a `page.tsx`, a primary Feature Component, and compose it from smaller UI components. This separation makes the code easy to reason about, test, and reuse.

---

## **3. File-by-File Deep Dive**

This section details the responsibility of every key file and directory in the frontend codebase.

### **3.1. `app/` (Next.js App Router Pages)**

This directory defines the routes and top-level UI for our application. Each subdirectory typically corresponds to a URL segment.

-   **`app/layout.tsx`**:
    -   **Responsibility:** The root layout for the entire application. It wraps all pages.
    -   **Key Logic:** Sets up the `<html>` and `<body>` tags, imports global CSS (`globals.css`), and provides essential context providers: `ThemeProvider` (manages light/dark mode), `SidebarProvider` (context for the collapsible sidebar), and `Toaster` (renders toast notifications).
    -   **Known Gap:** The `metadata.generator` field is currently `'v0.dev'`, an artifact from a code generation tool. This should be updated or removed.
-   **`app/page.tsx`**:
    -   **Responsibility:** The main dashboard page for teachers.
    -   **Key Component:** Renders `TeacherDashboard`.
-   **`app/analytics/page.tsx`**:
    -   **Responsibility:** Displays FSRS analytics for selected students.
    -   **Key Logic:** Uses `useState` for student selection, `useStudents` (SWR hook) to fetch student data, and renders `FSRSAnalyticsDashboard`.
    -   **Note:** Marked `"use client"` for interactivity.
-   **`app/content/page.tsx`**:
    -   **Responsibility:** Placeholder for a general content library page.
    -   **Key Component:** Renders `ContentLibrary`.
-   **`app/decks/page.tsx`**:
    -   **Responsibility:** Lists all vocabulary decks, allows creation and assignment.
    -   **Key Logic:** Manages dialog states, form data, and uses `useDecks`, `useStudents`, `createDeck`, `assignDeck` (SWR hooks/mutations). Renders `DataTable` for the list.
    -   **Note:** Marked `"use client"`.
-   **`app/decks/[deckId]/manage/page.tsx`**:
    -   **Responsibility:** Manages individual vocabulary cards within a specific deck.
    -   **Key Logic:** Extracts `deckId` from URL params, uses `useDeck` to fetch deck details, and renders `VocabularyCardManager`. Handles loading and error states.
    -   **Note:** Marked `"use client"`.
-   **`app/library/page.tsx`**:
    -   **Responsibility:** Displays a library of public vocabulary decks for import.
    -   **Key Component:** Renders `PublicDeckLibrary`.
-   **`app/login/page.tsx`**:
    -   **Responsibility:** The login interface.
    -   **Key Component:** Renders `LoginForm`.
    -   **Note:** Authentication is currently a placeholder, as per the project's intentional scope.
-   **`app/payments/page.tsx`**:
    -   **Responsibility:** Manages student payments and class credits.
    -   **Key Logic:** Allows selection of a student, displays payment stats, and renders `PaymentManager`. Uses `useStudents` and `safeNumberConversion` (from `lib/utils.ts`) for calculations.
    -   **Note:** Marked `"use client"`.
-   **`app/schedule/page.tsx`**:
    -   **Responsibility:** Manages student class schedules.
    -   **Key Logic:** Similar to payments, allows student selection and renders `ClassScheduler`. Uses `useStudents`.
    -   **Note:** Marked `"use client"`.
-   **`app/session/[sessionId]/page.tsx`**:
    -   **Responsibility:** The live teaching session interface.
    -   **Key Logic:** Extracts `sessionId` from URL params and renders `LiveSession`. This is a critical, highly interactive page.
    -   **Note:** Marked `"use client"`.
-   **`app/sessions/page.tsx`**:
    -   **Responsibility:** Lists all teaching sessions (past and in-progress).
    -   **Key Logic:** Filters sessions by search term, status, and student. Uses `useSessions` and `useStudents` (SWR hooks). Renders `DataTable` and `SessionStartDialog`.
    -   **Note:** Marked `"use client"`.
-   **`app/settings/page.tsx`**:
    -   **Responsibility:** Allows teachers to configure application settings.
    -   **Key Component:** Renders `TeacherSettingsPanel`.
-   **`app/students/page.tsx`**:
    -   **Responsibility:** Lists all students, allows adding new students.
    -   **Key Logic:** Filters students by status and search. Uses `useStudents` and `useDecks` (SWR hooks). Manages `Add Student Dialog` and `SessionStartDialog`.
    -   **Known Gap:** The `AvatarImage` for students uses a hardcoded `src="/placeholder.svg"`. This should ideally be dynamic, potentially using a service like DiceBear (as seen in `AnalyticsPage` and `PaymentsPage`) or a real avatar URL from the backend.
    -   **Known Gap:** The `defaultDeck` selection logic for new students (`decks.find(d => d.name === 'Default Seed Deck') || decks[0]`) is a hardcoded assumption. While functional, it's an oversimplification that might not scale or be flexible enough for all scenarios.
    -   **Note:** Marked `"use client"`.
-   **`app/students/[studentId]/page.tsx`**:
    -   **Responsibility:** Displays a detailed profile for a specific student.
    -   **Key Logic:** Extracts `studentId` from URL params and renders `StudentProfile`.
-   **`app/units/page.tsx`**:
    -   **Responsibility:** Lists all lesson units, allows creation.
    -   **Key Logic:** Filters units by visibility and search. Uses `useUnits` (SWR hook). Manages `Create Unit Dialog`. Renders `DataTable`.
    -   **Note:** Marked `"use client"`.
-   **`app/units/[unitId]/page.tsx`**:
    -   **Responsibility:** Edits an existing lesson unit.
    -   **Key Logic:** Extracts `unitId` from URL params and renders `UnitEditor`.

### **3.2. `components/` (Reusable UI Components)**

This directory contains the building blocks of our user interface.

-   **`components/app-sidebar.tsx`**:
    -   **Responsibility:** The main application sidebar for navigation.
    -   **Key Logic:** Uses `usePathname` from Next.js to highlight the active navigation item. Integrates Shadcn UI's `Sidebar` and `DropdownMenu` for user profile actions.
    -   **Known Gap:** The `mockUser` data and `notifications` count are currently hardcoded mocks. These should be replaced with real data from an authentication context and a backend notification system, respectively.
-   **`components/bulk-import-tools.tsx`**:
    -   **Responsibility:** Provides functionality for bulk importing data (vocabulary, students, schedules) via CSV files.
    -   **Key Logic:** Manages file upload, CSV parsing, data validation, and displays a preview and errors.
-   **`components/class-scheduler.tsx`**:
    -   **Responsibility:** Manages a student's class schedule, allowing scheduling, rescheduling, and status updates.
    -   **Key Logic:** Uses `useStudentSchedules` (SWR hook) to fetch schedules. Manages `Schedule Dialog` for creating/editing. Integrates Shadcn UI's `Calendar`, `Popover`, `Select`. Provides `DataTable` for list view and a custom calendar grid view. Handles `createSchedule`, `updateSchedule`, `deleteSchedule` mutations.
    -   **Known Gap:** The `ScheduleFormData` includes `duration` and `notes` fields, but the backend `ClassSchedule` model in `prisma/schema.prisma` does not currently support these fields. This represents frontend over-modeling and a backend feature gap for richer schedule details.
-   **`components/data-table.tsx`**:
    -   **Responsibility:** A generic, reusable table component with features like search, pagination, and sorting.
    -   **Key Logic:** Takes `data` and `columns` as props. Implements client-side filtering, sorting, and pagination logic. Designed to be highly configurable.
-   **`components/fsrs-analytics-dashboard.tsx`**:
    -   **Responsibility:** Displays detailed FSRS (Free Spaced Repetition Scheduler) analytics for a given student.
    -   **Key Logic:** Fetches `dueCards` and `listeningCandidates` using SWR hooks. Calculates and displays key metrics like total cards, due today, average retention, and card state distribution. Provides buttons to trigger backend FSRS optimization and cache rebuild jobs. Uses `DataTable` for detailed lists.
    -   **Known Gap:** The `totalCards` calculation (`student.studentDecks.reduce((sum, deck) => sum + (deck.deck._count?.cards || 0), 0)`) is incorrect because the `useStudents` SWR hook does not include `deck.cards` in its fetch. This is a data utilization gap.
    -   **Known Gap:** The `difficulty` display in `dueCardColumns` uses `(value * 100)%` for `StudentCardState.difficulty`. FSRS difficulty is typically a float between 0 and 1, making this a misrepresentation of the FSRS difficulty scale.
-   **`components/live-session.tsx`**:
    -   **Responsibility:** The interactive interface for a live teaching session. This is the "brain" of the frontend during a session.
    -   **Key Logic:** Fetches `session` data using `useSession` (SWR hook with `refreshInterval` for live updates). Integrates with `useLiveSessionStore` (Zustand) for client-side UI state like `isActionLoading`, `isPaused`, `elapsedTime`, `reviewCount`, and `encounteredCards`.
    -   **Modular Exercise Rendering:** Dynamically renders different exercise components (`VocabularyExercise`, `UnsupportedExercise`) based on `session.currentUnitItem.type`. `UnsupportedExercise` is an intentional placeholder for future exercise types.
    -   **Known Gap:** The `progress.payload.queue` in `useLiveSessionStore` provides a simplified representation of the FSRS queue (only `id`, `state`, `due`). It does not include full `StudentCardState` details (like `stability`, `difficulty`, `reps`, `lapses`, `retrievability`, `intervalDays`), which could offer richer insights into the live queue. This is an oversimplification of the FSRS queue data.
-   **`components/login-form.tsx`**:
    -   **Responsibility:** Handles user login.
    -   **Key Logic:** Simple form with email/password. Currently uses a mock authentication logic with a `setTimeout` and `useToast` for feedback. Redirects to dashboard on success. This is an intentional mock, as per the project's scope.
-   **`components/payment-manager.tsx`**:
    -   **Responsibility:** Manages student payments, allowing recording new payments and viewing history.
    -   **Key Logic:** Uses `useStudentPayments` (SWR hook) to fetch payment history. Calculates payment statistics. Manages `Record Payment Dialog`. Handles `recordPayment` mutation. Uses `useCurrencyFormatter` for display.
    -   **Known Gap:** The `PaymentFormData` includes `paymentMethod` and `notes` fields, but these are not currently persisted to the backend `Payment` model. This represents frontend over-modeling and a backend feature gap.
    -   **Known Gap:** The payment status display in `paymentColumns` is simplified (`remaining > 0` vs. "Fully used"). The backend `PaymentStatus` enum (`ACTIVE`, `EXPIRED`, `REFUNDED`) is not fully utilized for more granular status representation.
-   **`components/public-deck-library.tsx`**:
    -   **Responsibility:** Allows teachers to browse and import public vocabulary decks.
    -   **Key Logic:** Implements filtering by category, difficulty, and sorting. Manages `Deck Detail Dialog` for preview. Handles `forkDeck` mutation to import decks.
-   **`components/session-start-dialog.tsx`**:
    -   **Responsibility:** A dialog for teachers to select a unit and start a new learning session for a student.
    -   **Key Logic:** Uses `useAvailableUnits` (SWR hook) to fetch units that a student is ready for. Displays unit details and prerequisites. Handles `startSession` mutation and navigates to the live session page.
-   **`components/student-profile.tsx`**:
    -   **Responsibility:** Displays a comprehensive profile for a single student.
    -   **Key Logic:** Uses `useStudent` (SWR hook) to fetch all student-related data. Organizes information into tabs (`Overview`, `Learning Plan`, `Payment History`, `Class Schedule`). Integrates `PaymentManager` and `ClassScheduler` components. Allows editing student details and archiving. Handles `updateStudentNotes`, `assignDeck`, `updateStudent`, `archiveStudent` mutations.
    -   **Known Gap:** The `AvatarImage` for students uses a hardcoded `src="/placeholder.svg"`. This should ideally be dynamic, potentially using a service like DiceBear or a real avatar URL from the backend.
    -   **Known Gap:** The `student.upcomingClasses` property, used for display, is a frontend-side filtered list derived from `classSchedules`. The backend `useStudent` hook does not explicitly filter `classSchedules` by "upcoming" status, making this an implicit frontend calculation.
-   **`components/teacher-dashboard.tsx`**:
    -   **Responsibility:** The main dashboard for teachers, providing an overview of their students and quick actions.
    -   **Key Logic:** Displays quick stats (active students, upcoming classes, low balance). Lists recent students. Provides a quick "Add New Student" and "Start Session" flow. Uses `useStudents` and `useDecks` (SWR hooks).
    -   **Known Gap:** The `AvatarImage` for students uses a hardcoded `src="/placeholder.svg"`. This should ideally be dynamic.
    -   **Known Gap:** The `totalUpcomingClasses` and `formatNextClass` rely on `student.upcomingClasses`, which is a frontend-side filtered list, not explicitly provided by the backend query.
-   **`components/teacher-settings-panel.tsx`**:
    -   **Responsibility:** Allows teachers to configure application-wide settings and local UI preferences.
    -   **Key Logic:** Uses `useTeacherSettings` (SWR hook) for backend-synced settings. Integrates with `useUIPreferences` for local browser preferences (currency, date/time format, theme, language). Manages saving and resetting both types of settings.
    -   **Known Gap:** The "Interface Language" preference is present but marked as a "feature coming soon," indicating an incomplete implementation.
-   **`components/theme-provider.tsx`**:
    -   **Responsibility:** Provides context for managing the application's theme (light/dark mode).
    -   **Key Logic:** A wrapper around `next-themes` library.
-   **`components/unit-builder.tsx`**:
    -   **Responsibility:** A visual editor for creating and arranging exercises within a lesson unit using drag-and-drop.
    -   **Key Logic:** Manages unit metadata (`name`, `description`, `isPublic`). Uses `@hello-pangea/dnd` for drag-and-drop reordering of unit items. Manages `Configuration Dialog` for each exercise type. Handles `createUnit`, `updateUnit`, `addExerciseToUnit` mutations.
    -   **Known Gap:** The `estimatedDuration` for `DraggableUnitItem` is a hardcoded default (15 minutes) and is not dynamically calculated or persisted.
    -   **Known Gap:** The `unitItemTemplates` `defaultConfig` for various exercise types are hardcoded. Ideally, these default configurations could be fetched from a backend source of truth for exercise templates.
-   **`components/unit-editor.tsx`**:
    -   **Responsibility:** Similar to `UnitBuilder`, but specifically for editing an *existing* unit.
    -   **Key Logic:** Fetches `unit` data using `useUnit` (SWR hook). Allows updating unit metadata and adding/removing exercises. Provides links to manage cards for vocabulary decks. Handles `updateUnit`, `addExerciseToUnit` mutations.
    -   **Known Gap:** The `handleConfigureExercise` function is currently a `toast` placeholder, indicating an incomplete implementation for configuring individual exercises within a unit.
    -   **Known Gap:** The `handleRemoveExercise` function uses a direct `fetch` call with a hardcoded `X-Teacher-ID` header, violating the established API abstraction layer. It should instead use the `removeUnitItem` API hook from `hooks/api/content.ts`.
-   **`components/vocabulary-card-manager.tsx`**:
    -   **Responsibility:** Manages individual vocabulary cards within a specific deck, allowing CRUD operations.
    -   **Key Logic:** Uses `useDeckCards` (SWR hook) to fetch cards. Implements client-side filtering and search. Manages `Add Card Dialog` and `Edit Card Dialog`. Handles `addCardToDeck`, `updateCard`, `deleteCard` mutations. Uses `DataTable` for display.
    -   **Known Gap:** The "Import" and "Export" buttons are present but have no associated functionality, serving as placeholders.

### **3.3. `hooks/` (Custom React Hooks)**

The engine room of the application.

-   **`hooks/api/utils.ts`**:
    -   **Responsibility:** Provides the core utilities for our data fetching layer.
    -   **Key Logic:** Contains the `fetcher` for SWR `GET` requests and the crucial `mutateWithOptimistic` for `POST`, `PUT`, `DELETE` requests. It also defines the `MOCK_TEACHER_ID`, which is an intentional placeholder for future authentication.
-   **`hooks/api/students.ts`, `content.ts`, `sessions.ts`, `teacher.ts`**:
    -   **Responsibility:** These files form the API Abstraction Layer. Each file corresponds to a backend domain. They export custom hooks (`useStudents`, `useDecks`) and action functions (`createStudent`, `assignDeck`).
    -   **Key Logic:** The `use...` hooks wrap `useSWR` with the correct API endpoint. The action functions wrap `mutateWithOptimistic` with the correct endpoint, HTTP method, and body.
-   **`hooks/stores/use-live-session-store.ts`**:
    -   **Responsibility:** A Zustand store for managing client-side UI state specific to the live teaching session.
    -   **Key State:** `isActionLoading`, `isPaused`, `elapsedTime`, `reviewCount`, `encounteredCards`.
    -   **Key Logic:** Includes the `useProgressData` selector, a performance optimization that computes derived progress state so that components only re-render when the specific data they need changes.
    -   **Known Gap:** The `progress.payload.queue` in the Zustand store is a simplified representation of the FSRS queue, containing only `id`, `state`, and `due`. It lacks the full `StudentCardState` details (e.g., `stability`, `difficulty`, `reps`, `lapses`, `retrievability`, `intervalDays`) that are available from the backend and could provide richer real-time FSRS insights within the live session UI.
-   **`hooks/use-api-enhanced.ts`**:
    -   **Responsibility:** Re-exports all domain-specific API hooks for convenience. Also contains general-purpose utility hooks for complex frontend operations.
    -   **Key Hooks:** `useAsyncOperation` (generic async operation management), `useOptimisticUpdate` (generic optimistic UI state).
-   **`hooks/use-mobile.tsx`**:
    -   **Responsibility:** Determines if the current viewport is considered "mobile" based on a breakpoint.
    -   **Key Logic:** Uses `window.matchMedia` and `useEffect` to listen for screen size changes.
-   **`hooks/use-toast.ts`**:
    -   **Responsibility:** Provides a React hook for displaying transient notifications (toasts) to the user.
    -   **Key Logic:** Manages a global toast state using a reducer pattern. Provides `toast()` function to trigger notifications and `dismiss()` to remove them.
-   **`hooks/use-ui-preferences.ts`**:
    -   **Responsibility:** Manages user interface display preferences (e.g., currency format, date format) by storing them in `localStorage`.
    -   **Key Hooks:** `useUIPreferences` (main hook), `useCurrencyFormatter` (specialized), `useDateTimeFormatter` (specialized).
    -   **Key Logic:** Uses `useState` and `useEffect` to synchronize preferences with `localStorage` and react to changes (even across browser tabs). Relies on `lib/ui-preferences.ts` for the actual `localStorage` interactions.

### **3.4. `lib/` (Frontend Utilities)**

Contains shared utility functions and type definitions.

-   **`lib/types.ts`**:
    -   **Responsibility:** Defines custom TypeScript types used across the frontend.
    -   **Key Types:** `FullSessionState`, `VocabularyDeckProgress`, `AnswerPayload`, `AvailableUnit`, `FullStudentProfile`, `NewUnitItemData`, `VocabularyExerciseConfig`. These types ensure strong typing for data received from the backend and for data passed between frontend components.
    -   **Known Gap:** The `FullStudentProfile` type includes `upcomingClasses: ClassSchedule[]`, which implies the backend provides a pre-filtered list. However, the backend `useStudent` hook currently fetches all `classSchedules`, and the "upcoming" filtering is done implicitly on the frontend. This is a mismatch between the type definition and the actual backend data fetching.
-   **`lib/utils.ts`**:
    -   **Responsibility:** General-purpose utility functions for the frontend.
    -   **Key Functions:** `cn` (helper for Tailwind CSS classes), `formatTime` (formats time in seconds), `safeNumberConversion` (safely converts values, especially Prisma `Decimal` strings, to numbers).
-   **`lib/ui-preferences.ts`**:
    -   **Responsibility:** Handles the low-level logic for loading, saving, and formatting UI preferences to/from `localStorage`.
    -   **Key Functions:** `loadUIPreferences`, `saveUIPreferences`, `formatCurrency`, `formatDate`, `formatTime`, `getCurrencySymbol`.
    -   **Key Types:** `UIPreferences`, `UI_PREFERENCE_OPTIONS`.

---

## **4. Key Workflows in Action (Frontend Perspective)**

Let's trace the frontend's role in our critical workflows, highlighting current limitations.

### **Workflow 1: Onboarding a New Student**

1.  **Teacher Action:** On the Dashboard (`/`) or Students page (`/students`), the teacher clicks "Add New Student".
2.  **UI Interaction:** The `Add Student Dialog` (managed by `TeacherDashboard` or `StudentsPage`) opens.
3.  **Form Input:** The teacher fills in student details (name, email, notes) in the dialog's `Input` and `Textarea` components.
4.  **Data Fetching (Pre-requisite):** The `StudentsPage` (or `TeacherDashboard`) uses `useDecks` to fetch available vocabulary decks. This is crucial because a default deck is assigned during onboarding.
    *   **Current Limitation:** The logic for selecting a `defaultDeck` (`decks.find(d => d.name === 'Default Seed Deck') || decks[0]`) is a hardcoded assumption.
5.  **Submission:** The teacher clicks "Add Student".
6.  **Frontend Logic (`handleAddStudent` in `StudentsPage` / `TeacherDashboard`):**
    *   Basic client-side validation (name, email present).
    *   `setIsSubmitting(true)` to disable the button and show loading state.
    *   Calls `createStudent` (from `hooks/api/students.ts`), passing the new student data and the `defaultDeck.id`.
    *   `createStudent` internally uses `mutateWithOptimistic` to send a `POST` request to `/api/workflows/onboard-student` on the backend.
7.  **Backend Interaction:** The backend processes the request, creates the student, and initiates an `INITIALIZE_CARD_STATES` job.
8.  **Frontend Update:**
    *   On successful API response, `mutate()` (from `useStudents` hook) is called, triggering a revalidation of the `/api/students` endpoint. This fetches the newly created student and updates the `students` list displayed in the `DataTable`.
    *   A success `toast` is displayed.
    *   The dialog closes, and form fields are reset.
    *   **Current Limitation:** The student's avatar in the list will still show a hardcoded placeholder image (`/placeholder.svg`).
9.  **Error Handling:** If the API call fails, `mutateWithOptimistic` automatically reverts any optimistic UI changes (if implemented for this flow), and a `destructive` `toast` is displayed with the error message.

### **Workflow 2: Conducting a Live Vocabulary Session**

1.  **Teacher Action:** From a student's profile (`/students/[studentId]`) or the Sessions page (`/sessions`), the teacher clicks "Start Session".
2.  **UI Interaction:** The `SessionStartDialog` opens.
3.  **Data Fetching:** The `SessionStartDialog` uses `useAvailableUnits(studentId)` to fetch units the student is ready for. It displays available and unavailable units with their prerequisites.
4.  **Unit Selection:** The teacher selects a unit from the list.
5.  **Submission:** The teacher clicks "Start Session".
6.  **Frontend Logic (`handleStartSession` in `SessionStartDialog`):**
    *   `setIsStarting(true)` to show loading state.
    *   Calls `startSession(studentId, selectedUnit.id)` (from `hooks/api/sessions.ts`).
    *   `startSession` sends a `POST` request to `/api/sessions/start`.
7.  **Backend Interaction:** The backend creates a new `Session` record, initializes its state, and returns the `sessionId`.
8.  **Navigation:** On success, `router.push(`/session/${result.data.id}`)` navigates the browser to the live session page.
9.  **Live Session Initialization (`LiveSession` component at `/session/[sessionId]`):**
    *   The `LiveSession` component mounts.
    *   It calls `useSession(sessionId)` (SWR hook). This hook has a `refreshInterval: 1000` (1 second), ensuring the session state is constantly updated from the backend.
    *   `useEffect` hooks within `LiveSession` initialize the `elapsedTime` in the `useLiveSessionStore` (Zustand) based on `session.startTime` and start the client-side timer.
    *   The `useProgressData` selector hook starts calculating and providing real-time progress metrics.
        *   **Current Limitation:** The `progress.payload.queue` used for live queue analysis is a simplified representation, lacking full FSRS state details for each card.
    *   The `VocabularyExercise` component (or another exercise type) is rendered based on `session.currentUnitItem.type`.
        *   **Intentional Placeholder:** Other exercise types are currently rendered by `UnsupportedExercise`.
10. **Teacher Interaction (Vocabulary Review):**
    *   The `VocabularyExercise` displays the `englishWord`.
    *   Teacher clicks "Reveal Answer".
    *   `handleRevealAnswer` in `LiveSession` calls `submitAnswer(sessionId, { action: 'REVEAL_ANSWER' })`.
    *   `submitAnswer` uses `mutateWithOptimistic` to send the request.
    *   The `useSession` SWR hook revalidates, fetching the updated session state (now `AWAITING_RATING`).
    *   The UI updates to show the `chineseTranslation` and rating buttons.
    *   Teacher clicks a rating (e.g., "Good").
    *   `handleRating` in `LiveSession` calls `submitAnswer(sessionId, { action: 'SUBMIT_RATING', data: { rating: 3 } })`.
    *   `incrementReviewCount()` (Zustand) immediately updates the local review count displayed in the sidebar.
    *   `submitAnswer` uses `mutateWithOptimistic` again.
    *   The `useSession` SWR hook revalidates, fetching the next card in the queue.
    *   `addEncounteredCard()` (Zustand) tracks the unique card seen.
    *   The UI updates to the next card.
11. **Session End:**
    *   Teacher clicks "End Session".
    *   `handleEndSession` calls `endSession(sessionId)` (from `hooks/api/sessions.ts`).
    *   `endSession` sends a `DELETE` request to mark the session as `COMPLETED`.
    *   On success, a toast is shown, and `router.push` navigates back to the student's profile.
    *   The `useLiveSessionStore` is `reset()` on unmount.

### **Workflow 3: Managing Vocabulary Cards in a Deck**

1.  **Teacher Action:** Navigates to "Vocabulary Decks" (`/decks`), then clicks "Manage Cards" for a specific deck (`/decks/[deckId]/manage`).
2.  **Page Load:** The `ManageDeckPage` component loads.
3.  **Data Fetching:** `useDeck(deckId)` fetches the deck details, and `VocabularyCardManager` uses `useDeckCards(deckId)` to fetch all cards belonging to that deck.
4.  **Card List Display:** The `DataTable` component renders the `filteredCards` using `cardColumns`.
5.  **Teacher Action (Add Card):** Clicks "Add Card".
    *   **Current Limitation:** The "Import" and "Export" buttons are present but non-functional.
6.  **UI Interaction:** The `Add Card Dialog` opens.
7.  **Form Input:** Teacher fills in card details (English word, Chinese translation, etc.) in the dialog's `Input`, `Textarea`, `Select` components.
8.  **Submission:** Teacher clicks "Add Card".
9.  **Frontend Logic (`handleAddCard` in `VocabularyCardManager`):**
    *   Client-side validation.
    *   `setIsSubmitting(true)`.
    *   Calls `addCardToDeck(deckId, formData)` (from `hooks/api/content.ts`).
    *   `addCardToDeck` uses `mutateWithOptimistic` to send a `POST` request to `/api/decks/[deckId]/cards`.
10. **Backend Interaction:** The backend creates the new `VocabularyCard` record.
11. **Frontend Update:**
    *   On successful API response, `mutate()` (from `useDeckCards` hook) is called, revalidating the `/api/decks/[deckId]/cards` endpoint. The `DataTable` automatically updates with the new card.
    *   A success `toast` is displayed.
    *   The dialog closes, and form fields are reset.
12. **Teacher Action (Edit Card):** Clicks "Edit" from a card's dropdown menu.
13. **UI Interaction:** The `Edit Card Dialog` opens, pre-filled with the card's current data.
14. **Submission:** Teacher modifies fields and clicks "Update Card".
15. **Frontend Logic (`handleEditCard` in `VocabularyCardManager`):**
    *   Client-side validation.
    *   `setIsSubmitting(true)`.
    *   Calls `updateCard(editingCard.id, formData)` (from `hooks/api/content.ts`).
    *   `updateCard` uses `mutateWithOptimistic` to send a `PUT` request to `/api/cards/[cardId]`.
16. **Backend Interaction:** The backend updates the `VocabularyCard` record.
17. **Frontend Update:** Similar to adding, `mutate()` revalidates, `DataTable` updates, toast is shown, dialog closes.
18. **Teacher Action (Delete Card):** Clicks "Delete" from a card's dropdown menu.
19. **UI Interaction:** A confirmation dialog appears.
20. **Frontend Logic (`handleDeleteCard` in `VocabularyCardManager`):**
    *   If confirmed, calls `deleteCard(card.id)` (from `hooks/api/content.ts`).
    *   `deleteCard` uses `mutateWithOptimistic` to send a `DELETE` request to `/api/cards/[cardId]`.
21. **Backend Interaction:** The backend soft-deletes the `VocabularyCard` record.
22. **Frontend Update:** `mutate()` revalidates, `DataTable` updates (card disappears), toast is shown.

---

## **5. How to Contribute**

To ensure consistency, maintainability, and high quality, please adhere to the following guidelines when contributing to the frontend:

1.  **Follow the Patterns:** New features must adhere to the Page -> Feature -> UI component hierarchy and the SWR + Zustand state management strategy.
2.  **Abstract API Calls:** All new backend interactions must be added to the appropriate file in `hooks/api/`. Components should never use `fetch` directly.
3.  **Use `shadcn/ui`:** Build all new UI elements from the primitives in `components/ui/` to maintain visual consistency.
4.  **Manage State Appropriately:**
    *   Is it data from the server? Use SWR via an API hook.
    *   Is it temporary, shared UI state? Use a Zustand store.
    *   Is it confined to one component? Use `useState`.
5.  **Type Everything:** Use the shared types from `lib/types.ts` to ensure end-to-end type safety.
6.  **Implement Consistent Error Handling & Feedback:**
    *   Use `useToast` for all user notifications (success, error, info).
    *   Catch errors from API calls and display them clearly to the user.
7.  **Prioritize Performance:**
    *   Be mindful of unnecessary re-renders.
    *   Optimize image loading (e.g., `next/image`).
    *   Consider lazy loading for large components or data.
8.  **Address Known Gaps:** Actively work to resolve the limitations and incomplete implementations detailed in Section 6.

---

## **6. Current Limitations & Known Gaps**

The current frontend provides a solid foundation, but it has several areas where implementations are incomplete, oversimplified, or rely on mock data/functions. These are critical areas for immediate attention to solidify the existing foundation.

## **6.1. Data Utilization & Backend Integration Gaps**

These gaps involve either the frontend not fully utilizing data already available from the backend or requiring new backend API integrations to support intended frontend features.

### **1. `components/class-scheduler.tsx` (Class Scheduler)**

*   **Problem:** The `ScheduleFormData` includes `duration` and `notes` fields, but the backend `ClassSchedule` model in `prisma/schema.prisma` does not currently support these fields.
*   **Solution:** Remove `notes` from the frontend. Add `duration` to the backend `ClassSchedule` model and persist it.
*   **Affected Files/Components:**
    *   **Backend:** `prisma/schema.prisma` (`ClassSchedule` model), `lib/actions/students.ts` (`createSchedule`, `updateSchedule`), `app/api/students/[studentId]/schedules/route.ts`, `app/api/schedules/[scheduleId]/route.ts`.
    *   **Frontend:** `components/class-scheduler.tsx` (`ScheduleFormData`, UI elements), `lib/types.ts` (`ClassSchedule` type).
*   **Implementation Details:**
    1.  **Frontend (`components/class-scheduler.tsx`):**
        *   Remove the `notes` field from `ScheduleFormData` and its corresponding `Textarea` UI element.
        *   Ensure the `duration` field is correctly passed in `createSchedule` and `updateSchedule` calls.
    2.  **Backend (`prisma/schema.prisma`):**
        *   Add `duration Int` to the `ClassSchedule` model. (Consider `Int?` if optional).
    3.  **Backend (`lib/actions/students.ts`, API routes):**
        *   Modify `createSchedule` and `updateSchedule` to accept and persist the `duration` field.
        *   Update the Zod schemas for schedule creation/update to include `duration`.
*   **Testing Considerations:**
    *   Schedule classes with different durations and verify they are saved and displayed correctly.
    *   Ensure that updating a schedule also correctly updates its duration.
*   **Production-Grade Aspects:** Allows teachers to specify and track the planned duration of each class, improving scheduling accuracy and record-keeping.

### **2. `components/payment-manager.tsx` (Payment Manager)**

*   **Problem 1 (Notes & Payment Method):** `notes` and `paymentMethod` fields are present on the frontend but not persisted to the backend `Payment` model.
*   **Solution 1:** Remove `notes` and `paymentMethod` from the frontend.
*   **Affected Files/Components:**
    *   **Frontend:** `components/payment-manager.tsx` (`PaymentFormData`, UI elements).
*   **Implementation Details 1:**
    1.  **Frontend (`components/payment-manager.tsx`):**
        *   Remove the `notes` and `paymentMethod` fields from `PaymentFormData`.
        *   Remove the corresponding `Textarea` and `Select` UI elements from the "Record Payment Dialog".
*   **Testing Considerations 1:**
    *   Verify that these fields are no longer present in the payment recording dialog.
*   **Production-Grade Aspects 1:** Simplifies the payment recording process by removing fields that are not currently utilized or persisted, reducing cognitive load for the teacher.

*   **Problem 2 (Payment Status):** The payment status display is simplified (`remaining > 0` vs. "Fully used"). The backend `PaymentStatus` enum (`ACTIVE`, `EXPIRED`, `REFUNDED`) is not fully utilized.
*   **Solution 2:** Enhance the frontend display to utilize the full `PaymentStatus` enum from the backend for more granular status representation.
*   **Affected Files/Components:**
    *   **Backend:** `prisma/schema.prisma` (`Payment` model, `PaymentStatus` enum).
    *   **Frontend:** `components/payment-manager.tsx` (`paymentColumns`).
*   **Implementation Details 2:**
    1.  **Backend (`prisma/schema.prisma`):**
        *   Ensure the `Payment` model has a `status PaymentStatus @default(ACTIVE)` field. (This is already present in the provided schema).
        *   Ensure the backend API returns this `status` field.
    2.  **Frontend (`components/payment-manager.tsx`):**
        *   Modify the `render` function for the `status` column in `paymentColumns`.
        *   Instead of `remaining > 0`, use `row.status` to render the badge.
        *   Map `PaymentStatus` values to appropriate badge variants and text.
            ```typescript
            render: (_: any, row: Payment) => {
              let variant: "default" | "secondary" | "destructive" | "outline" = "outline";
              let text = row.status;
              switch (row.status) {
                case "ACTIVE":
                  variant = "default";
                  text = "Active";
                  break;
                case "EXPIRED":
                  variant = "secondary"; // Or a warning variant
                  text = "Expired";
                  break;
                case "REFUNDED":
                  variant = "destructive";
                  text = "Refunded";
                  break;
                // Add logic for remaining classes if still desired alongside status
                default:
                  break;
              }
              return <Badge variant={variant}>{text}</Badge>;
            },
            ```
*   **Testing Considerations 2:**
    *   Manually update payment statuses in the backend (e.g., via Prisma Studio) and verify the frontend displays them correctly.
    *   Consider adding backend logic to automatically update `EXPIRED` status based on `classesUsed` reaching `classesPurchased`.
*   **Production-Grade Aspects 2:** Provides a more accurate and informative overview of payment statuses, aiding teachers in financial management and student credit tracking.

### **3. `components/fsrs-analytics-dashboard.tsx` (FSRS Analytics Dashboard)**

*   **Problem 1 (Total Cards Calculation):** The `totalCards` calculation (`student.studentDecks.reduce((sum, deck) => sum + (deck.deck._count?.cards || 0), 0)`) is incorrect because the `useStudents` SWR hook does not include `deck.cards` in its fetch.
*   **Solution 1:** The `useStudents` hook should be updated to include the `_count` of cards for each deck.
*   **Affected Files/Components:**
    *   **Backend:** `app/api/students/route.ts` (Prisma query).
    *   **Frontend:** `components/fsrs-analytics-dashboard.tsx`.
*   **Implementation Details 1:**
    1.  **Backend (`app/api/students/route.ts`):**
        *   Modify the Prisma query in the `GET` handler to include the count of cards for each deck.
            ```typescript
            // Example Prisma query modification
            const students = await prisma.student.findMany({
              where: { teacherId },
              include: {
                studentDecks: {
                  include: {
                    deck: {
                      include: {
                        _count: {
                          select: { cards: true },
                        },
                      },
                    },
                  },
                },
                // ... other includes
              },
            });
            ```
    2.  **Frontend (`components/fsrs-analytics-dashboard.tsx`):**
        *   The existing calculation logic will now work correctly once the backend provides the `_count` data.
*   **Testing Considerations 1:**
    *   Verify that the "Total Cards" metric in the FSRS dashboard accurately reflects the sum of cards from all of a student's assigned decks.
*   **Production-Grade Aspects 1:** Ensures accurate data display, providing teachers with a reliable overview of a student's learning material volume.

*   **Problem 2 (Difficulty Display):** The `difficulty` display in `dueCardColumns` uses `(value * 100)%` for `StudentCardState.difficulty`. FSRS difficulty is typically a float between 0 and 1, making this a misrepresentation of the FSRS difficulty scale.
*   **Solution 2:** Display the raw FSRS difficulty value as a float, which is more accurate and informative for the teacher.
*   **Affected Files/Components:**
    *   **Frontend:** `components/fsrs-analytics-dashboard.tsx`.
*   **Implementation Details 2:**
    1.  **Frontend (`components/fsrs-analytics-dashboard.tsx`):**
        *   Modify the `render` function for the `difficulty` column in `dueCardColumns`.
        *   Instead of a progress bar based on `value * 100`, display the float directly.
            ```typescript
            render: (value: number) => (
              <div className="text-sm text-slate-600">{value.toFixed(2)}</div>
            ),
            ```
*   **Testing Considerations 2:**
    *   Verify that the difficulty column in the "Due Cards" table shows a float value (e.g., 0.75).
*   **Production-Grade Aspects 2:** Provides a more accurate representation of the FSRS algorithm's internal state, allowing teachers to better understand card difficulty.

---

## **6.2. Oversimplifications & Mismatches**

These gaps highlight areas where the frontend's assumptions or data models don't perfectly align with the backend, or where frontend features are oversimplified.

### **1. `lib/types.ts` (Frontend Types) - Alignment with Backend**

*   **Problem:** The `FullStudentProfile` type includes `upcomingClasses: ClassSchedule[]`, which implies the backend provides a pre-filtered list. This is a mismatch with the current backend implementation where `useStudent` fetches all `classSchedules`, and "upcoming" filtering is done implicitly on the frontend.
*   **Solution:** Align the frontend type definition with the actual backend data.
*   **Affected Files/Components:**
    *   **Frontend:** `lib/types.ts` (`FullStudentProfile` type), `components/student-profile.tsx`, `components/teacher-dashboard.tsx`.
*   **Implementation Details:**
    1.  **Frontend (`lib/types.ts`):**
        *   Modify `FullStudentProfile` to remove `upcomingClasses` and instead ensure `classSchedules: ClassSchedule[]` is present.
    2.  **Frontend (`components/student-profile.tsx`, `components/teacher-dashboard.tsx`):**
        *   Update any code that directly accesses `student.upcomingClasses` to instead filter `student.classSchedules` on the frontend to derive the "upcoming" classes.
            ```typescript
            // Example in TeacherDashboard
            const upcomingClasses = student.classSchedules.filter(
              (schedule) => new Date(schedule.scheduledTime) > new Date()
            ).sort((a, b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime());
            // Use `upcomingClasses` for display
            ```
*   **Testing Considerations:**
    *   Verify that the "Upcoming Classes" count and display remain accurate after the type change and frontend filtering.
    *   Test with students having various schedules (past, present, future).
*   **Production-Grade Aspects:** Ensures type definitions accurately reflect the data contract, preventing potential runtime errors and improving code clarity. This also explicitly places the "upcoming" filtering logic on the frontend, where it is currently performed.

### **2. `hooks/stores/use-live-session-store.ts` (Live Session Store)**

*   **Problem:** The `progress.payload.queue` in the Zustand store is a simplified representation of the FSRS queue, containing only `id`, `state`, and `due`. It lacks the full `StudentCardState` details (e.g., `stability`, `difficulty`, `reps`, `lapses`, `retrievability`, `intervalDays`) that are available from the backend and could provide richer real-time FSRS insights within the live session UI.
*   **Solution:** Enhance the backend session state to include full `StudentCardState` details for the current queue and update the frontend store and UI to utilize this richer data.
*   **Affected Files/Components:**
    *   **Backend:** `lib/actions/sessions.ts` (session state generation).
    *   **Frontend:** `lib/types.ts` (`VocabularyDeckProgress` type), `hooks/stores/use-live-session-store.ts`, `components/live-session.tsx`.
*   **Implementation Details:**
    1.  **Backend (`lib/actions/sessions.ts`):**
        *   Modify the `SessionProgress` object to include the full `StudentCardState` for each item in the `queue`.
    2.  **Frontend (`lib/types.ts`):**
        *   Update the `VocabularyDeckProgress` type to reflect the richer queue data.
    3.  **Frontend (`hooks/stores/use-live-session-store.ts`, `components/live-session.tsx`):**
        *   Update the `useProgressData` selector and the `LiveSession` component's sidebar to display more detailed live queue analysis (e.g., average stability of due cards, number of lapses in the current queue).
*   **Testing Considerations:**
    *   Verify that the live session sidebar displays the new, richer FSRS data.
    *   Ensure the data updates correctly after each review.
*   **Production-Grade Aspects:** Provides teachers with unprecedented real-time insight into the FSRS queue, allowing them to understand *why* certain cards are appearing and make more informed pedagogical decisions during a session.

---

## **6.3. Incomplete Implementations & Placeholders**

These are features that are partially implemented or have UI elements without corresponding functionality.

### **1. `app/layout.tsx` (Root Layout) - Metadata Generator**

*   **Problem:** The `metadata.generator` field is currently `'v0.dev'`, an artifact from a code generation tool.
*   **Solution:** Update or remove the `metadata.generator` field.
*   **Affected Files/Components:**
    *   **Frontend:** `app/layout.tsx`.
*   **Implementation Details:**
    1.  **Frontend (`app/layout.tsx`):**
        *   Change `generator: 'v0.dev'` to `generator: 'Next.js'` or remove the line entirely if not needed.
*   **Testing Considerations:**
    *   No functional impact, but a good practice for code cleanliness.
*   **Production-Grade Aspects:** Improves code hygiene and accurately reflects the project's technology stack.

### **2. `components/app-sidebar.tsx` (App Sidebar) - Notifications**

*   **Problem:** The `notifications` count is currently a hardcoded mock, and there are no plans for a notification feature at this time.
*   **Solution:** Remove the notifications mock and related UI elements from the frontend.
*   **Affected Files/Components:**
    *   **Frontend:** `components/app-sidebar.tsx`.
*   **Implementation Details:**
    1.  **Frontend (`components/app-sidebar.tsx`):**
        *   Remove `const [notifications] = useState(3);`.
        *   Remove the `Bell` icon and associated `Badge` for notifications from the `DropdownMenuItem` in the `SidebarFooter`.
        *   Remove the `notifications > 0` conditional rendering logic.
*   **Testing Considerations:**
    *   Verify that the notification badge and icon are no longer present in the sidebar.
*   **Production-Grade Aspects:** Reduces unnecessary UI clutter and removes features that are not actively supported, aligning the UI with current functionality.

### **3. `components/unit-editor.tsx` (Unit Editor)**

*   **Problem 1 (Configure Exercise):** The `handleConfigureExercise` function is currently a `toast` placeholder.
*   **Solution 1:** Integrate the robust configuration dialog from `UnitBuilder` into `UnitEditor`, utilizing the `updateUnitItemConfig` API.
*   **Affected Files/Components:**
    *   **Frontend:** `components/unit-editor.tsx`, `components/unit-builder.tsx` (for reusable dialog logic), `hooks/api/content.ts` (`updateUnitItemConfig`).
*   **Implementation Details 1:**
    1.  **Frontend (`components/unit-editor.tsx`):**
        *   Introduce state for `isConfigDialogOpen` and `editingItem` (similar to `UnitBuilder`).
        *   Modify `handleConfigureExercise` to set `editingItem` and open the dialog.
        *   Extract the `renderItemConfigDialog` logic from `UnitBuilder` into a reusable component or function, passing necessary props (e.g., `editingItem`, `onSave`, `onCancel`, `decks`).
        *   The `onSave` callback from the configuration dialog should call `updateUnitItemConfig(editingItem.id, updatedConfig)` and then `mutate()` the `useUnit` hook to refresh the data.
*   **Testing Considerations 1:**
    *   Verify that clicking "Configure" for any exercise type opens the correct configuration dialog.
    *   Test modifying configurations for different exercise types and ensure changes are persisted and reflected in the unit.
    *   Verify that the `mutate()` call correctly revalidates the unit data.
*   **Production-Grade Aspects 1:** Provides essential functionality for teachers to fine-tune individual exercises within a unit, enabling highly customized lesson plans.

*   **Problem 2 (Remove Exercise):** The `handleRemoveExercise` function uses a direct `fetch` call with a hardcoded `X-Teacher-ID` header, violating the established API abstraction layer.
*   **Solution 2:** Refactor `handleRemoveExercise` to use the `removeUnitItem` API hook from `hooks/api/content.ts`.
*   **Affected Files/Components:**
    *   **Frontend:** `components/unit-editor.tsx`, `hooks/api/content.ts` (`removeUnitItem`).
*   **Implementation Details 2:**
    1.  **Frontend (`components/unit-editor.tsx`):**
        *   Modify `handleRemoveExercise` to call `removeUnitItem(unitId, itemId)` instead of the raw `fetch`.
        *   Ensure proper error handling with `useToast`.
*   **Testing Considerations 2:**
    *   Verify that removing an exercise works correctly and the unit list updates.
    *   Ensure error messages are displayed if the removal fails.
*   **Production-Grade Aspects 2:** Adheres to the API abstraction layer, making the code more maintainable, testable, and consistent with the rest of the application's data flow.

### **4. `components/vocabulary-card-manager.tsx` (Vocabulary Card Manager) - Import/Export**

*   **Problem:** The "Import" and "Export" buttons are present but have no associated functionality, serving as placeholders.
*   **Solution:** Implement the import/export functionality.
*   **Affected Files/Components:**
    *   **Frontend:** `components/vocabulary-card-manager.tsx`.
*   **Implementation Details:**
    1.  **Frontend (`components/vocabulary-card-manager.tsx`):**
        *   **Import:** The "Import" button should open a modal that contains the `BulkImportTools` component, pre-configured for vocabulary import and passed the current `deckId`.
        *   **Export:** The "Export" button should trigger a function that fetches all cards for the current deck (using the already available `cards` data from the `useDeckCards` hook), converts them to a CSV format, and initiates a browser download.
*   **Testing Considerations:**
    *   Verify that clicking "Import" opens the bulk import tool.
    *   Verify that clicking "Export" downloads a correctly formatted CSV file with all the cards from the deck.
*   **Production-Grade Aspects:** Provides essential data portability for teachers, allowing them to easily move vocabulary content between this platform and other tools.

You now have the knowledge. Build with precision, responsiveness, and a relentless focus on the teacher's experience.
