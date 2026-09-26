# LRVS Login Demo (Express + EJS)

A runnable demo of the "Land Record Verification System" sign-in page,
built with Express and EJS templating.

## Project structure

```
lrvs-app/
├── package.json
├── server.js          # Express app: routes, form handling
├── views/
│   └── lrvs-login.ejs # The page template
└── README.md
```

## How to run it in VS Code

1. Unzip / open this folder in VS Code (`File > Open Folder...`).
2. Open a terminal in VS Code: `Terminal > New Terminal`.
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the server:
   ```bash
   npm start
   ```
5. You should see:
   ```
   LRVS login demo running at http://localhost:3000/login
   ```
6. Open that URL in your browser (Cmd/Ctrl-click the link in the VS Code
   terminal, or paste it manually).

## What you can test

- **Normal load**: `GET /login` renders the page with the User ID field
  pre-filled as `MH-REV-4471`.
- **Error state**: on the page, type anything into Password, but type
  exactly `wrong` (case-insensitive) and click **Sign In** — the page
  re-renders with a red error banner above the form.
- **Success state**: type any other password and click **Sign In** — you'll
  see a simple "Signed in successfully" confirmation page.

## Wiring up real authentication

Everything auth-related lives in `server.js`, inside the `app.post("/login", ...)`
handler. Replace the placeholder `if` check with a real lookup (e.g. a database
query and a hashed-password comparison) and set up a session or token on
success instead of the placeholder `res.send(...)`.

## Notes

- Styling is plain CSS inside the `<style>` block of `lrvs-login.ejs` — no
  external stylesheet or build step required.
- Port defaults to `3000`. Override with `PORT=4000 npm start` if needed.
