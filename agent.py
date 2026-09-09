import os
import asyncio
import json
from dotenv import load_dotenv
from openai import AsyncOpenAI
from tool import check_availability,book_appointment,cancel_appointment,reschedule_appointment,save_memory,create_task,get_tasks

from agents import (
    Agent,
    OpenAIChatCompletionsModel,
    Runner,
    set_tracing_disabled,
)


load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# Connect the Agents SDK to Gemini
client = AsyncOpenAI(
    api_key=GEMINI_API_KEY,
    base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
)

with open("memory.json", "r", encoding="utf-8") as file:
    memory = json.load(file)

print("Memory loaded:", memory)


# We aren't using an OpenAI API key, so disable OpenAI tracing for now.
set_tracing_disabled(disabled=True)

model = OpenAIChatCompletionsModel(
    model="gemini-3.6-flash",
    openai_client=client
    
)


trainer_agent = Agent(
    name="Personal Trainer Scheduling Agent",
    instructions=f"""
    You are an appointment scheduling assistant for a personal trainer.

    Your job is to help clients book personal training sessions.

    Be friendly, professional, and concise.

    You can also create persistent tasks when the client asks for a reminder
    or a task. Ask for any missing date or time before creating one.
    
    When you have both a date and a specific time,
    use the check_availability tool to check the trainer's schedule.
    
    Only use book_appointment after the client has explicitly confirmed
    that they want to book the available appointment.
    
    If the client wants to cancel an appointment,
    ask for confirmation before cancelling it.

    Only use cancel_appointment after the client has
    explicitly confirmed that they want to cancel.
    
    If the client wants to reschedule an appointment,
    first check whether the new date and time are available.

    Ask for confirmation before rescheduling.

    Only use reschedule_appointment after the client has
    explicitly confirmed that they want to reschedule.
    
    When the user asks about their tasks, use the get_tasks tool to retrieve the relevant tasks from tasks.json.

    Use get_tasks when the user asks questions such as:
    - "What tasks do I have?"
    - "What tasks do I have tomorrow?"
    - "What are my tasks for today?"
    - "Show me my unfinished tasks."
    - "What tasks do I have this week?"

    When the user uses a relative date such as "today" or "tomorrow", determine the actual date first and pass the date to get_tasks in YYYY-MM-DD format.
    
    Do not claim to know the user's tasks without using get_tasks.

    Use the information returned by get_tasks to give the user a concise, natural-language answer.
    
    Here is the information you already know about the client:

    {memory}
    """,
    model=model,
    tools= [
        check_availability,
        book_appointment,
        cancel_appointment,
        reschedule_appointment,
        save_memory,
        create_task,
        get_tasks
    ]   
)


async def main():
    conversation_history = [] ## remember our conversation history
    
    while True:

        user_message = input("\nYou: ")

        if user_message.lower() == "exit":
            print("Goodbye!")
            break

        result = await Runner.run(
            trainer_agent,
            conversation_history + [
               {
                "role": "user",
                "content": user_message #Take everything from the previous conversation AND add the message the user just typed.
                }
            ]
        )
        print("\nAgent:", result.final_output)
        
        conversation_history = result.to_input_list() #updating the history
 
if __name__ == "__main__":
    asyncio.run(main())