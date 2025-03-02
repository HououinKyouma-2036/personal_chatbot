import os
import flask
from flask import Flask, request, jsonify, Response, stream_with_context
from flask_cors import CORS
from deepseek_model import get_streaming_response_from_deepseek

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

@app.route("/", methods=["GET"])
def index():
    """Root endpoint that provides basic API information."""
    return jsonify({
        "name": "Personal Chatbot API",
        "version": "1.0.0",
        "endpoints": {
            "/api/chat": "POST - Send messages to the chatbot"
        },
        "status": "running"
    })

@app.route("/api/chat", methods=["POST"])
def chat():
    """
    Handles chat requests from the frontend.
    """
    print("Received request to /api/chat")
    
    # Check if the request has JSON data
    if not request.is_json:
        print("Error: Request does not contain JSON data")
        return jsonify({"error": "Request must be JSON"}), 400
    
    try:
        data = request.get_json()
        print(f"Request data: {data}")
        
        if not data or "messages" not in data:
            print("Error: Missing 'messages' in request body")
            return jsonify({"error": "Missing 'messages' in request body"}), 400
        
        # Clean and validate the messages
        clean_messages = data["messages"]
        
        # Get the bot role if provided
        bot_role = data.get("botRole", "")
        print(f"Bot role received: {bot_role}")
        
        # Check if streaming is requested (default to True)
        stream = data.get("stream", True)
        
        if stream:
            # Return a streaming response
            print("Streaming response requested")
            
            @stream_with_context
            def generate():
                try:
                    # Get a streaming response from the model
                    for chunk in get_streaming_response_from_deepseek(clean_messages, bot_role=bot_role):
                        # Convert the chunk to a JSON string and yield it
                        yield f"data: {chunk}\n\n"
                except Exception as e:
                    print(f"Error in stream: {str(e)}")
                    error_json = jsonify({"error": str(e)})
                    yield f"data: {error_json.get_data(as_text=True)}\n\n"
                finally:
                    yield "data: [DONE]\n\n"
            
            return Response(generate(), mimetype="text/event-stream")
        else:
            # Non-streaming response (original implementation)
            print("Non-streaming response requested")
            response = get_streaming_response_from_deepseek(clean_messages, stream=False, bot_role=bot_role)
            
            # Extract the final answer (content) and the reasoning chain
            assistant_message = response.choices[0].message
            final_content = assistant_message.content
            
            # Check if reasoning_content exists in the response
            reasoning_chain = getattr(assistant_message, "reasoning_content", None)
            
            print(f"Sending response back to frontend: {final_content[:50]}...")
            return jsonify({
                "content": final_content,
                "reasoning_content": reasoning_chain
            })
    except Exception as e:
        print(f"Error processing request: {str(e)}")
        # In case of errors from the API call, return the error message
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    # Run the Flask app on localhost:5000 in debug mode.
    app.run(debug=True)
