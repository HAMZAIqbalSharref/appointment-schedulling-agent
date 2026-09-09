# Personal AI Scheduler

A full-stack personal scheduling application with a React dashboard, a FastAPI service, an AI scheduling assistant, Google Calendar integration, and persistent task management.

The React UI is the primary user experience. The AI Assistant remains the natural-language interface for booking appointments, checking availability, managing tasks, and organizing the user's schedule.

## Requirements

- Python 3.10 or newer
- A Gemini API key
- A Google Cloud project with the Google Calendar API enabled
- OAuth 2.0 Desktop credentials for Google Calendar

## Setup

1. Create and activate a virtual environment:

   ```powershell
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   ```

   In VS Code, select `.venv\Scripts\python.exe` as the Python interpreter. If activation is unavailable, run the program directly with `\.venv\Scripts\python.exe`.

2. Install the dependencies:

   ```powershell
   pip install openai-agents python-dotenv google-api-python-client google-auth-httplib2 google-auth-oauthlib
   ```

3. Create a `.env` file in the project root:

   ```env
   GEMINI_API_KEY=your_gemini_api_key
   ```

4. Download Google OAuth Desktop App credentials from Google Cloud Console and save the file as `credentials.json` in the project root. This file is ignored by Git.

## Run

Start the interactive assistant:

```powershell
python agent.py
```

If the virtual environment is not activated, use:

```powershell
.\.venv\Scripts\python.exe agent.py
```

Type `exit` to stop the assistant. On the first calendar operation, a browser window opens for Google authorization. The resulting `token.json` file is stored locally and ignored by Git.

### Run the FastAPI backend

From the project root:

```powershell
uvicorn server:app --reload
```

The API runs on `http://127.0.0.1:8000`.

### Run the React UI

In a second terminal:

```powershell
cd ui
npm install
npm run dev
```

Vite prints the local UI URL, normally `http://127.0.0.1:5173`.

## React UI

The frontend is a Vite and React application in `ui/`. It preserves the scheduler's light and dark visual themes and provides these views:

- **Dashboard**: Calculates today's events, upcoming appointments, free time, today's schedule, and real schedule conflicts from fetched data. It includes empty states when there is no schedule data.
- **Calendar**: Displays real Google Calendar events and persistent tasks by date. Month navigation, date selection, selected-day details, and task/appointment labels use actual event dates and times.
- **Appointments**: Lists real appointment records and supports booking, cancellation, and rescheduling through the backend.
- **Tasks**: Lists persistent tasks with title, date, start time, duration, reminder, and completion state. Tasks can be created through the UI or AI Assistant and marked complete.
- **AI Assistant**: Sends natural-language messages to the FastAPI `/chat` endpoint, preserving the existing `{ message, history }` request format.
- **Settings**: Provides the existing workspace preference view and theme controls.

### UI data sources

- Google Calendar is the source of truth for calendar events and appointments.
- `memory.json` stores appointment records and their Google Calendar event IDs.
- `tasks.json` stores persistent task records.
- The React UI fetches data from the backend and refreshes it after relevant operations and periodically while open. It does not maintain a second fake calendar or task database.

### Chat history

AI conversations are stored in the browser's `localStorage` under `personal-ai-scheduler-chats`. Each stored chat contains an ID, title, timestamps, and messages. The UI supports:

- Continuing the active conversation after refresh or navigation.
- Starting a new conversation without deleting older chats.
- Selecting previous conversations from grouped chat history.
- Deleting individual conversations.

Chat history is not sent to a new database. The active conversation's messages continue to be sent to the existing FastAPI `/chat` endpoint as request history.

## Project Files

- `agent.py`: Runs the interactive scheduling assistant.
- `server.py`: FastAPI application exposing chat, calendar, appointment, and task endpoints.
- `tool.py`: Defines availability, booking, cancellation, rescheduling, task, and memory tools.
- `calendar_service.py`: Authenticates with and connects to Google Calendar.
- `ui/src/App.jsx`: Main React application, navigation, dashboard views, calendar, appointments, tasks, and chat history state.
- `ui/src/styles.css`: Existing responsive layout, colors, dark mode, cards, calendar, and assistant styling.
- `memory.json`: Stores the local client name and Google Calendar appointment records.
- `tasks.json`: Stores persistent task records used by the frontend and AI task tool.

## Notes

- Calendar times are interpreted as Pakistan Standard Time (UTC+05:00).
- Booking creates a Google Calendar event and saves its event ID and appointment details to `memory.json`.
- Cancellation and rescheduling update both Google Calendar and `memory.json` when the stored appointment has an event ID.
- The FastAPI server exposes read and mutation endpoints for calendar events, appointments, and tasks for the React frontend.
- Keep `.env`, `credentials.json`, and `token.json` private.

## Current Status

- The application starts successfully with the project virtual environment and reaches the interactive prompt.
- The installed dependencies include `openai-agents 0.22.0`, `python-dotenv 1.2.3`, and `google-api-python-client 2.200.0`.
- Google OAuth files are present locally, so calendar operations can use the saved token until reauthorization is required.
