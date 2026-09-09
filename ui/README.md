# Personal AI Scheduler UI

A Vite + React frontend for the FastAPI-backed personal scheduler. It preserves the existing scheduler visual language, responsive layout, light/dark themes, sidebar, cards, and assistant workspace.

## Run

```powershell
cd ui
npm install
npm run dev
```

Start the FastAPI server from the project root in a second terminal:

```powershell
uvicorn server:app --reload
```

The UI expects the backend at `http://127.0.0.1:8000`.

## Features

- Dashboard statistics and schedule items are calculated from real backend data.
- Calendar events come from Google Calendar, with month navigation, date selection, and selected-day details.
- Appointments support real booking, cancellation, and rescheduling operations.
- Tasks are persistent records stored in the backend's `tasks.json` file.
- The AI Assistant uses the existing FastAPI `/chat` endpoint and preserves conversation history in each request.
- Assistant conversations persist in browser `localStorage` under `personal-ai-scheduler-chats`.
- Users can start new chats, switch between previous chats, and delete individual chats.

## Backend data contract

The frontend reads and updates data through these backend routes:

- `GET /calendar/events`
- `GET /appointments`
- `POST /appointments`
- `PATCH /appointments/{event_id}`
- `DELETE /appointments/{event_id}`
- `GET /tasks`
- `POST /tasks`
- `PATCH /tasks/{task_id}`
- `POST /chat`

Google Calendar remains the source of truth for calendar events and appointments. The frontend does not replace backend data with mock scheduler data.
