from agents import function_tool
import json
from calendar_service import get_calendar_service

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
    Book an appointment and save it to persistent memory.
    """

    with open("memory.json", "r", encoding="utf-8") as file:
        memory = json.load(file)

    appointment = {
        "date": date,
        "time": time,
        "type": "Personal Training"
    }

    memory["appointments"].append(appointment)

    with open("memory.json", "w", encoding="utf-8") as file:
        json.dump(memory, file, indent=4)

    return f"Appointment booked for {client_name} on {date} at {time}."

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

