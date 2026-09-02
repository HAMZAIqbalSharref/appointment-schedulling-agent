import os.path

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build


# Permissions our app needs:
# - Check calendar availability
# - Create/edit calendar events
SCOPES = [
    "https://www.googleapis.com/auth/calendar.freebusy",
    "https://www.googleapis.com/auth/calendar.events",
]


def get_calendar_service():
    """
    Authenticate with Google Calendar and return the Calendar API service.
    """

    creds = None

    # If we have already authenticated before,
    # load the saved credentials.
    if os.path.exists("token.json"):
        creds = Credentials.from_authorized_user_file(
            "token.json",
            SCOPES
        )

   
    if not creds or not creds.valid:#If we don't have credentials OR the credentials we have aren't valid, fix the authentication.

        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request()) #"We have credentials, they have expired, but we have a refresh token that can get us a new access token."

        else:
            flow = InstalledAppFlow.from_client_secrets_file(
                "credentials.json", # we have to aututenticate from scratch manually and we have some scopes that we need scopes = permissions
                SCOPES
            )

            creds = flow.run_local_server(port=0)

        # Save credentials so we don't have to
        # authorize every time we run the program.
        with open("token.json", "w") as token:
            token.write(creds.to_json())

    # Build the Google Calendar API service.
    service = build(
        "calendar",
        "v3",
        credentials=creds
    )

    return service

if __name__ == "__main__":
    service = get_calendar_service()

    events_result = service.events().list(
        calendarId="primary",
        maxResults=10,
        singleEvents=True,
        orderBy="startTime"
    ).execute()

    events = events_result.get("items", [])

    print("\nUpcoming appointments:")

    if not events:
        print("No upcoming events found.")

    for event in events:
        start = event["start"].get(
            "dateTime",
            event["start"].get("date")
        )

        print(f"- {event.get('summary', 'No title')} | {start}")