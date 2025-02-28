import os
import json
import openai
from openai import OpenAI
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Try to load the API key from environment variables
DEEPSEEK_API_KEY = os.environ.get("DEEPSEEK_API_KEY") or os.environ.get("OPENAI_API_KEY")

# If not found in environment, try to load from the .env file directly
if not DEEPSEEK_API_KEY:
    env_file_path = os.path.join(os.path.dirname(__file__), "DEEPSEEK_API_KEY.env")
    if os.path.exists(env_file_path):
        with open(env_file_path, "r") as f:
            DEEPSEEK_API_KEY = f.read().strip()

# Set the environment variable for OpenAI client
if DEEPSEEK_API_KEY:
    os.environ["OPENAI_API_KEY"] = DEEPSEEK_API_KEY

# Initialize the OpenAI client to point to DeepSeek's endpoint
client = OpenAI(
    api_key=DEEPSEEK_API_KEY,  # Explicitly pass the API key
    base_url="https://api.deepseek.com"
)

def get_response_from_deepseek(messages, model="deepseek-reasoner"):
    """
    Calls the DeepSeek API with the provided conversation messages.
    
    :param messages: A list of message dictionaries (each with 'role' and 'content').
    :param model: The model to use (default is "deepseek-reasoner").
    :return: The API response.
    """
    if not DEEPSEEK_API_KEY:
        raise ValueError("DeepSeek API key not found. Please set the DEEPSEEK_API_KEY environment variable.")
        
    response = client.chat.completions.create(
        model=model,
        messages=messages
        # You can optionally add parameters like max_tokens here.
    )
    return response

def get_streaming_response_from_deepseek(messages, model="deepseek-reasoner", stream=True):
    """
    Calls the DeepSeek API with streaming enabled and yields chunks of the response.
    
    :param messages: A list of message dictionaries (each with 'role' and 'content').
    :param model: The model to use (default is "deepseek-reasoner").
    :param stream: Whether to stream the response (default is True).
    :return: If stream=True, yields JSON chunks. If stream=False, returns the complete response.
    """
    if not DEEPSEEK_API_KEY:
        raise ValueError("DeepSeek API key not found. Please set the DEEPSEEK_API_KEY environment variable.")
    
    # Add a system message to encourage proper LaTeX and Markdown formatting
    system_message = {
        "role": "system",
        "content": """When responding with mathematical content, please use proper LaTeX notation:
        - For inline math, use single dollar signs: $E=mc^2$
        - For display math, use double dollar signs: $$\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}$$
        
        Format your response in markdown for better readability:
        - Use # for headings
        - Use **bold** and *italic* for emphasis
        - Use - or * for bullet points
        - Use 1. 2. 3. for numbered lists
        - Use > for blockquotes
        - Use `code` for inline code
        - Use ```language\\ncode\\n``` for code blocks
        
        Ensure all LaTeX expressions are properly escaped and formatted."""
    }
    
    # Add the system message if not already present
    if not any(msg.get("role") == "system" for msg in messages):
        messages = [system_message] + messages
    
    if not stream:
        # If streaming is not requested, use the regular function
        return get_response_from_deepseek(messages, model)
    
    # Create a streaming response
    response_stream = client.chat.completions.create(
        model=model,
        messages=messages,
        stream=True
    )
    
    # Initialize variables to accumulate content and reasoning
    content_so_far = ""
    reasoning_so_far = ""
    
    # Process each chunk
    for chunk in response_stream:
        # Check if there's new content
        delta = chunk.choices[0].delta
        
        # Extract content and reasoning from the delta
        if hasattr(delta, "content") and delta.content is not None:
            content_so_far += delta.content
        
        # Check for reasoning content
        reasoning_content = getattr(delta, "reasoning_content", None)
        if reasoning_content is not None:
            reasoning_so_far += reasoning_content
        
        # Create a response object to send to the frontend
        response_obj = {
            "content": content_so_far,
            "reasoning_content": reasoning_so_far,
            "is_complete": False
        }
        
        # Convert to JSON and yield
        yield json.dumps(response_obj)
    
    # Final response with is_complete flag
    final_response = {
        "content": content_so_far,
        "reasoning_content": reasoning_so_far,
        "is_complete": True
    }
    
    yield json.dumps(final_response)