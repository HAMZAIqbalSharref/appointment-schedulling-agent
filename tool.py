from agents import function_tool
import json
from calendar_service import get_calendar_service
from datetime import datetime, timedelta
from pathlib import Path

@function_tool
def check_availability(date: str, time: str) -> str:
    """
    Check whether the personal trainer is available
    at the requested date and time using Google Calendar.
    """

    service = get_calendar_service() #Get our Google Calendar connection

    # We will assume Pakistan Standard Time (UTC+05:00).
    start_time = f"{date}T{time}:00+05:00"


    from datetime import datetime, timedelta #Used to represent a duration.

    start = datetime.fromisoformat(start_time) #Convert the string into a datetime
    end = start + timedelta(hours=1) #Make the appointment one hour long
 
    # Ask Google Calendar if there are events during this time.
    body = {
        "timeMin": start.isoformat(), #Start checking from this time.
        "timeMax": end.isoformat(),   #Stop checking at this time.
        "items": [
            {
                "id": "primary"
            }
        ]
    }

    result = service.freebusy().query(
        body=body
    ).execute()

    busy_times = result["calendars"]["primary"]["busy"] #Get the busy periods

    if not busy_times:
        return f"{date} at {time} is available."

    return f"{date} at {time} is not available."




@function_tool
def book_appointment(client_name: str, date: str, time: str):
    """
    Book an appointment by creating a real Google Calendar event
    and saving the appointment to persistent memory.
    """

    # Connect to Google Calendar.
    service = get_calendar_service()

    # Convert the requested date and time into a datetime object.
    start_time = datetime.fromisoformat(
        f"{date}T{time}:00+05:00"
    )

    # Personal training sessions are 1 hour long.
    end_time = start_time + timedelta(hours=1)

    # Information for the Google Calendar event.
    event = {
        "summary": "Personal Training",
        "description": f"Personal training session for {client_name}.",
        "start": {
            "dateTime": start_time.isoformat(),
            "timeZone": "Asia/Karachi",
        },
        "end": {
            "dateTime": end_time.isoformat(),
            "timeZone": "Asia/Karachi",
        },
    }

    # Create the event on the primary Google Calendar.
    created_event = service.events().insert(
        calendarId="primary",
        body=event
    ).execute()

    # Save the appointment to our persistent memory.
    with open("memory.json", "r", encoding="utf-8") as file:
        memory = json.load(file)

    appointment = {
        "date": date,
        "time": time,
        "type": "Personal Training",
        "event_id": created_event["id"]
    }

    memory["appointments"].append(appointment)

    with open("memory.json", "w", encoding="utf-8") as file:
        json.dump(memory, file, indent=4)

    return f"Appointment booked for {client_name} on {date} at {time}."


@function_tool
def cancel_appointment(date: str, time: str) -> str:
    """
    Cancel an appointment from Google Calendar and persistent memory.
    """

    # Load our saved appointments.
    with open("memory.json", "r", encoding="utf-8") as file:
        memory = json.load(file)

    # Find the appointment matching the requested date and time.
    appointment_to_cancel = None

    for appointment in memory["appointments"]:
        if (
            appointment["date"] == date
            and appointment["time"] == time
        ):
            appointment_to_cancel = appointment
            break

    # Make sure we actually found the appointment.
    if not appointment_to_cancel:
        return f"No appointment was found for {date} at {time}."

    # Make sure the appointment has a Google Calendar event ID.
    if "event_id" not in appointment_to_cancel:
        return "This appointment does not have a Google Calendar event ID."

    # Connect to Google Calendar.
    service = get_calendar_service()

    # Delete the event from Google Calendar.
    service.events().delete(
        calendarId="primary",
        eventId=appointment_to_cancel["event_id"]
    ).execute()

    # Remove the appointment from our memory.
    memory["appointments"].remove(appointment_to_cancel) 

    with open("memory.json", "w", encoding="utf-8") as file:
        json.dump(memory, file, indent=4)

    return f"Appointment on {date} at {time} has been cancelled."

@function_tool
def reschedule_appointment( #"To reschedule an appointment, tell me which appointment to move and where to move it."
    old_date: str,
    old_time: str,
    new_date: str,
    new_time: str
) -> str:
    """
    Reschedule an existing appointment to a new date and time.
    """

    # Load our saved appointments.
    with open("memory.json", "r", encoding="utf-8") as file:
        memory = json.load(file)

   # Find the existing appointment that is connected to Google Calendar.
    appointment_to_reschedule = None

    for appointment in memory["appointments"]:
        if (
            appointment["date"] == old_date
            and appointment["time"] == old_time
            and "event_id" in appointment
    ):
            appointment_to_reschedule = appointment
            break

    # Make sure the appointment exists.
    if not appointment_to_reschedule:
        return f"No appointment was found for {old_date} at {old_time}."

    # Make sure we have the Google Calendar event ID.
    if "event_id" not in appointment_to_reschedule:
        return "This appointment does not have a Google Calendar event ID."

    # Connect to Google Calendar.
    service = get_calendar_service()

    # Create the new start and end times.
    new_start = datetime.fromisoformat(
        f"{new_date}T{new_time}:00+05:00"
    )

    new_end = new_start + timedelta(hours=1)

    # Update the Google Calendar event.
    event = service.events().get(
        calendarId="primary",
        eventId=appointment_to_reschedule["event_id"]
    ).execute()

    event["start"] = {
        "dateTime": new_start.isoformat(),
        "timeZone": "Asia/Karachi",
    }

    event["end"] = {
        "dateTime": new_end.isoformat(),
        "timeZone": "Asia/Karachi",
    }

    service.events().update(
        calendarId="primary",
        eventId=appointment_to_reschedule["event_id"],
        body=event
    ).execute()

    # Update our persistent memory.
    appointment_to_reschedule["date"] = new_date
    appointment_to_reschedule["time"] = new_time

    with open("memory.json", "w", encoding="utf-8") as file:
        json.dump(memory, file, indent=4)

    return (
        f"Appointment rescheduled from "
        f"{old_date} at {old_time} to "
        f"{new_date} at {new_time}."
    )


@function_tool
def save_memory(client_name: str) -> str:
    """
    Save the client's name to persistent memory.
    """

    with open("memory.json", "r", encoding="utf-8") as file:
        memory = json.load(file)

    memory["client_name"] = client_name

    with open("memory.json", "w", encoding="utf-8") as file:
        json.dump(memory, file, indent=4)

    return f"Saved {client_name} to memory."


@function_tool
def create_task(title: str, date: str, time: str, duration: int = 60, reminder: str = "No reminder") -> str:
    """Create a persistent task for the client."""
    tasks = []
    try:
        with open("tasks.json", "r", encoding="utf-8") as file:
            tasks = json.load(file)
    except FileNotFoundError:
        pass

    tasks.append({
        "id": f"task-{datetime.now().timestamp()}",
        "title": title,
        "date": date,
        "start": time,
        "duration": duration,
        "reminder": reminder,
        "done": False,
    })

    with open("tasks.json", "w", encoding="utf-8") as file:
        json.dump(tasks, file, indent=4)

    return f"Task '{title}' added for {date} at {time}."


@function_tool
def get_tasks(date: str | None = None) -> str:
    """
    Get tasks from the persistent tasks.json file.

    If a date is provided, only return tasks for that date.
    The date should be in YYYY-MM-DD format.
    """

    tasks_file = Path("tasks.json")

    if not tasks_file.exists():
        return "No tasks found."

    with open(tasks_file, "r", encoding="utf-8") as file:
        tasks = json.load(file)

    if date:
        tasks = [
            task
            for task in tasks
            if task.get("date") == date #"If the user asked for a particular date, only keep tasks whose date matches."
        ]

    if not tasks:
        if date:
            return f"No tasks found for {date}."
        return "No tasks found."

    return json.dumps(tasks, indent=2)  