import os
import asyncio
import json
from dotenv import load_dotenv
from openai import AsyncOpenAI
from tool import check_availability,book_appointment,save_memory

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

    For now, you are only responsible for understanding
    appointment requests. We will add scheduling tools later.
    
    When you have both a date and a specific time,
    use the check_availability tool to check the trainer's schedule.
    
    Only use book_appointment after the client has explicitly confirmed
    that they want to book the available appointment.
    
    Here is the information you already know about the client:

    {memory}
    """,
    model=model,
    tools= [
        check_availability,
        book_appointment,
        save_memory
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