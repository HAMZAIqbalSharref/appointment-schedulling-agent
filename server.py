from datetime import datetime, timedelta
import json
import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from agents import Runner
from agent import trainer_agent
from calendar_service import get_calendar_service


app = FastAPI()


# Allow the React frontend to communicate with FastAPI.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []


class TaskRequest(BaseModel):
    title: str
    date: str
    start: str
    duration: int = 60
    reminder: str = "No reminder"


class TaskUpdate(BaseModel):
    done: bool


class AppointmentUpdate(BaseModel):
    date: str
    time: str


class AppointmentRequest(BaseModel):
    title: str
    date: str
    time: str


MEMORY_PATH = "memory.json"
TASKS_PATH = "tasks.json"


def load_json(path, default):
    if not os.path.exists(path):
        return default
    with open(path, "r", encoding="utf-8") as file:
        return json.load(file)


def save_json(path, value):
    with open(path, "w", encoding="utf-8") as file:
        json.dump(value, file, indent=4)


def event_from_google(item):
    start_value = item.get("start", {}).get("dateTime")
    end_value = item.get("end", {}).get("dateTime")
    if not start_value:
        date_value = item.get("start", {}).get("date")
        if not date_value:
            return None
        return {
            "id": item.get("id"),
            "type": "appointment",
            "title": item.get("summary", "Untitled event"),
            "date": date_value,
            "start": "00:00",
            "duration": 1440,
            "color": "coral",
        }

    start = datetime.fromisoformat(start_value.replace("Z", "+00:00"))
    end = datetime.fromisoformat(end_value.replace("Z", "+00:00")) if end_value else start
    return {
        "id": item.get("id"),
        "type": "appointment",
        "title": item.get("summary", "Untitled event"),
        "date": start.strftime("%Y-%m-%d"),
        "start": start.strftime("%H:%M"),
        "duration": max(1, round((end - start).total_seconds() / 60)),
        "color": "coral",
    }


@app.get("/")
def home():
    return {
        "message": "Personal AI Scheduler API is running!"
    }


@app.get("/calendar/events")
def calendar_events():
    now = datetime.now().astimezone()
    service = get_calendar_service()
    response = service.events().list(
        calendarId="primary",
        timeMin=(now - timedelta(days=365)).isoformat(),
        timeMax=(now + timedelta(days=365)).isoformat(),
        singleEvents=True,
        orderBy="startTime",
    ).execute()

    events = [event_from_google(item) for item in response.get("items", [])]
    events = [event for event in events if event]
    tasks = load_json(TASKS_PATH, [])
    return {"events": events + [
        {
            **task,
            "type": "task",
            "color": "blue",
        }
        for task in tasks
    ]}


@app.get("/appointments")
def appointments():
    records = load_json(MEMORY_PATH, {}).get("appointments", [])
    return {"appointments": [
        {
            "id": record.get("event_id", f"{record['date']}-{record['time']}"),
            "event_id": record.get("event_id"),
            "service": record.get("type", "Appointment"),
            "provider": "Google Calendar",
            "date": record["date"],
            "time": record["time"],
            "status": "Confirmed",
            "color": "coral",
        }
        for record in records
    ]}


@app.post("/appointments")
def create_appointment(request: AppointmentRequest):
    start = datetime.fromisoformat(f"{request.date}T{request.time}:00+05:00")
    end = start + timedelta(hours=1)
    service = get_calendar_service()
    event = service.events().insert(
        calendarId="primary",
        body={
            "summary": request.title,
            "start": {"dateTime": start.isoformat(), "timeZone": "Asia/Karachi"},
            "end": {"dateTime": end.isoformat(), "timeZone": "Asia/Karachi"},
        },
    ).execute()
    memory = load_json(MEMORY_PATH, {"appointments": []})
    memory.setdefault("appointments", []).append({
        "date": request.date,
        "time": request.time,
        "type": request.title,
        "event_id": event["id"],
    })
    save_json(MEMORY_PATH, memory)
    return {"ok": True}


@app.delete("/appointments/{event_id}")
def delete_appointment(event_id: str):
    memory = load_json(MEMORY_PATH, {"appointments": []})
    record = next(
        (item for item in memory.get("appointments", []) if item.get("event_id") == event_id),
        None,
    )
    if not record:
        raise HTTPException(status_code=404, detail="Appointment not found")

    service = get_calendar_service()
    service.events().delete(calendarId="primary", eventId=event_id).execute()
    memory["appointments"].remove(record)
    save_json(MEMORY_PATH, memory)
    return {"ok": True}


@app.patch("/appointments/{event_id}")
def update_appointment(event_id: str, request: AppointmentUpdate):
    memory = load_json(MEMORY_PATH, {"appointments": []})
    record = next(
        (item for item in memory.get("appointments", []) if item.get("event_id") == event_id),
        None,
    )
    if not record:
        raise HTTPException(status_code=404, detail="Appointment not found")

    start = datetime.fromisoformat(f"{request.date}T{request.time}:00+05:00")
    end = start + timedelta(hours=1)
    service = get_calendar_service()
    event = service.events().get(calendarId="primary", eventId=event_id).execute()
    event["start"] = {"dateTime": start.isoformat(), "timeZone": "Asia/Karachi"}
    event["end"] = {"dateTime": end.isoformat(), "timeZone": "Asia/Karachi"}
    service.events().update(calendarId="primary", eventId=event_id, body=event).execute()
    record["date"] = request.date
    record["time"] = request.time
    save_json(MEMORY_PATH, memory)
    return {"ok": True}


@app.get("/tasks")
def tasks():
    return {"tasks": load_json(TASKS_PATH, [])}


@app.post("/tasks")
def create_task(request: TaskRequest):
    tasks = load_json(TASKS_PATH, [])
    task = {
        "id": f"task-{datetime.now().timestamp()}",
        "title": request.title,
        "date": request.date,
        "start": request.start,
        "duration": request.duration,
        "reminder": request.reminder,
        "done": False,
    }
    tasks.append(task)
    save_json(TASKS_PATH, tasks)
    return task


@app.patch("/tasks/{task_id}")
def update_task(task_id: str, request: TaskUpdate):
    tasks = load_json(TASKS_PATH, [])
    task = next((item for item in tasks if item.get("id") == task_id), None)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task["done"] = request.done
    save_json(TASKS_PATH, tasks)
    return task


@app.post("/chat")
async def chat(request: ChatRequest):

    # Convert the frontend conversation into the format
    # expected by the Agents SDK.
    conversation_history = [
        {
            "role": message.role,
            "content": message.content
        }
        for message in request.history
    ]

    # Add the newest user message.
    conversation_history.append(
        {
            "role": "user",
            "content": request.message
        }
    )

    # Run the actual AI scheduling agent.
    result = await Runner.run(
        trainer_agent,
        input=conversation_history
    )

    return {
        "response": result.final_output
    }