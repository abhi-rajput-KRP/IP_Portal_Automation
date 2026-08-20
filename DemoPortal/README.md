# Demo Portal

A React and Vite portal for signing in with Firebase Authentication, selecting a semester, viewing students, and updating student marks in Cloud Firestore.

## Prerequisites

- Node.js 18 or newer
- npm
- A Firebase project with Authentication and Cloud Firestore enabled

## Setup

1. Open this repository and move into the project directory:

   ```bash
   cd DemoPortal
   ```

2. Install the dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file in the project root. Vite only exposes variables prefixed with `VITE_`, and the application reads these Firebase configuration values:

   ```env
   VITE_apiKey=your_firebase_api_key
   VITE_authDomain=your-project.firebaseapp.com
   VITE_projectId=your_firebase_project_id
   VITE_storageBucket=your-project.firebasestorage.app
   VITE_messagingSenderId=your_messaging_sender_id
   VITE_appId=your_firebase_app_id
   VITE_measurementId=your_google_analytics_measurement_id
   ```

   Get these values from **Firebase Console > Project settings > General > Your apps > Firebase SDK snippet > Config**. `VITE_measurementId` can be omitted if Google Analytics is not enabled, but all other values are required for Firebase initialization.

   Do not commit `.env`. It is already excluded by `.gitignore`. Restart the Vite server after changing environment variables.

4. Configure Firebase:

   - Enable **Authentication > Sign-in method > Email/Password**.
   - Create accounts for the users who should access the portal.
   - Create a Cloud Firestore database.
   - Add a `Students` collection. Each document should contain at least `sem`, `enrollment_no`, `name`, and `marks` fields. `sem` should be a number, and `marks` is stored as a number when submitted.
   - Add Firestore security rules appropriate for your environment. Do not use open read/write rules in production.

## Run locally

Start the development server:

```bash
npm run dev
```

Open the local URL shown by Vite, usually `http://localhost:5173`.

The portal routes are:

| Route | Purpose |
| --- | --- |
| `/` | Firebase email/password login |
| `/sems` | Select semester 1, 3, 5, or 7 |
| `/students?sem=1` | View and update students for a semester |
| `/logout` | Sign out and return to login |

## Available commands

```bash
npm run dev       # Start the Vite development server
npm run build     # Create a production build in dist/
npm run preview   # Preview the production build locally
npm run lint      # Run ESLint
```

## Deployment

The project can be deployed to Vercel or another static host that supports SPA fallback routing. Build with `npm run build`, publish the `dist` directory, and configure the same `VITE_` environment variables in the hosting provider. The included `vercel.json` rewrites routes to `index.html` so React Router URLs work after deployment.

## Project structure

```text
DemoPortal/
├── src/
│   ├── assets/              # Application assets
│   ├── components/
│   │   ├── loader.jsx       # Loading state component
│   │   ├── Login.jsx        # Firebase login form
│   │   ├── logout.jsx       # Sign-out route component
│   │   ├── Sems.jsx         # Semester selection screen
│   │   └── Students.jsx     # Student list and marks editor
│   ├── firebase.js          # Firebase setup and auth/Firestore helpers
│   ├── index.css            # Global styles and Tailwind styles
│   └── main.jsx             # React entry point and route definitions
├── .env                     # Local Firebase values; do not commit
├── .gitignore               # Ignored files and local configuration
├── eslint.config.js         # ESLint configuration
├── index.html               # Vite HTML entry point
├── package.json             # Scripts and dependencies
├── package-lock.json        # Locked dependency versions
├── vercel.json              # Vercel SPA rewrite configuration
└── vite.config.js           # Vite, React, and Tailwind configuration
```
