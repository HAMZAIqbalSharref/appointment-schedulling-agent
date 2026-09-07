# Appointment Scheduling Agent

A conversational personal trainer appointment assistant powered by the OpenAI Agents SDK and Google Calendar. It can check calendar availability, book appointments, and remember the client's name and appointments locally.

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

## Project Files

- `agent.py`: Runs the interactive scheduling assistant.
- `tool.py`: Defines availability, booking, and memory tools.
- `calendar_service.py`: Authenticates with and connects to Google Calendar.
- `memory.json`: Stores the local client name and appointment list.

## Notes

- Calendar times are interpreted as Pakistan Standard Time (UTC+05:00).
- Booking creates a Google Calendar event and saves its event ID and appointment details to `memory.json`.
- Cancellation and rescheduling update both Google Calendar and `memory.json` when the stored appointment has an event ID.
- The current `memory.json` contains appointments for September 3 and September 4, 2026 at 18:00; it does not contain an appointment for September 5.
- Keep `.env`, `credentials.json`, and `token.json` private.

## Current Status

- The application starts successfully with the project virtual environment and reaches the interactive prompt.
- The installed dependencies include `openai-agents 0.22.0`, `python-dotenv 1.2.3`, and `google-api-python-client 2.200.0`.
- Google OAuth files are present locally, so calendar operations can use the saved token until reauthorization is required.
