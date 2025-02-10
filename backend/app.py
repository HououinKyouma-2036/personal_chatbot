import os
from flask import Flask, request, jsonify
from openai import OpenAI

app = Flask(__name__)

# Load your DeepSeek API key from an environment variable.
# Replace "your_default_api_key" with a dummy key if needed.
DEEPSEEK_API_KEY = os.environ.get("DEEPISEK_API_KEY", "your_default_api_key")

# Initialize the OpenAI client to point to DeepSeek's endpoint.
client = OpenAI(api_key=DEEPSEEK_API_KEY, base_url="https://api.deepseek.com")

@app.route("/api/chat", methods=["POST"])
def chat():
    """
    Expects a JSON payload in the format:
    {
        "messages": [
            {"role": "user", "content": "Hello, who are you?"},
            {"role": "assistant", "content": "I'm a chatbot."},
            // ... further conversation history
        ]
    }

    The endpoint will:
      - Remove any 'reasoning_content' fields from the messages.
      - Send the cleaned conversation history to the DeepSeek API.
      - Return the assistant's reply and its reasoning chain.
    """
    data = request.get_json()
    if not data or "messages" not in data:
        return jsonify({"error": "Missing 'messages' in request body"}), 400

    messages = data["messages"]

    if not isinstance(messages, list):
        return jsonify({"error": "'messages' must be a list"}), 400

    # Clean each message: ensure that only "role" and "content" keys are sent.
    clean_messages = []
    for msg in messages:
        # Make sure the message is a dictionary and contains required keys.
        if isinstance(msg, dict) and "role" in msg and "content" in msg:
            clean_messages.append({"role": msg["role"], "content": msg["content"]})
        else:
            return jsonify({"error": "Each message must be a dict with 'role' and 'content'"}), 400

    try:
        # Call the DeepSeek API with the cleaned messages.
        response = client.chat.completions.create(
            model="deepseek-reasoner",
            messages=clean_messages
            # Optionally, add other parameters like max_tokens if needed.
        )

        # Extract the final answer (content) and the reasoning chain.
        assistant_message = response.choices[0].message
        final_content = assistant_message.content
        reasoning_chain = assistant_message.reasoning_content

        return jsonify({
            "content": final_content,
            "reasoning_content": reasoning_chain
        })

    except Exception as e:
        # In case of errors from the API call, return the error message.
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    # Run the Flask app on localhost:5000 in debug mode.
    app.run(debug=True)
