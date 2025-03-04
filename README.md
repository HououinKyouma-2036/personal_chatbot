 L       EEEEE   OOO   GGGGG    AAAAA   III  
 L       E      O   O  G        A     A   I   
 L       EEEE   O   O  G  GG    AAAAAAA   I   
 L       E      O   O  G   G    A     A   I   
 LLLLL   EEEEE   OOO   GGGGG    A     A  III  

# DeepSeek Reasoner Chatbot

A full-stack web application that provides an interactive chat interface powered by the DeepSeek Reasoner AI model. This application allows users to define a specific role for the AI assistant and engage in conversations with detailed reasoning capabilities.

## Features

- **Role-Based AI Interaction**: Define the AI's expertise (e.g., coding expert, math tutor, science advisor)
- **Streaming Responses**: Real-time streaming of AI responses for a more interactive experience
- **Reasoning Visibility**: View the AI's reasoning process alongside its final answers
- **Markdown & LaTeX Support**: Rich text formatting with proper support for mathematical notation
- **Syntax Highlighting**: Code blocks are displayed with proper syntax highlighting
- **Responsive Design**: Clean, user-friendly interface that works across devices

## Architecture

The application follows a client-server architecture:

### Frontend (React + TypeScript)
- Built with React and TypeScript
- Real-time streaming response handling
- Markdown and LaTeX rendering with KaTeX
- Code syntax highlighting with Prism

### Backend (Python + Flask)
- Flask-based REST API
- Integration with DeepSeek API
- Streaming response support
- Environment-based configuration

## Getting Started

### Prerequisites

- Node.js (v14+)
- Python (v3.8+)
- DeepSeek API key

### Installation

#### Backend Setup

1. Navigate to the backend directory:
   ```
   cd backend
   ```

2. Install Python dependencies:
   ```
   pip install -r requirements.txt
   ```

3. Set up your DeepSeek API key:
   - Create a `.env` file in the backend directory
   - Add your API key: `DEEPSEEK_API_KEY=your_api_key_here`
   - Alternatively, you can create a `DEEPSEEK_API_KEY.env` file with just the key

4. Start the Flask server:
   ```
   python app.py
   ```
   The server will run on http://127.0.0.1:5000

#### Frontend Setup

1. Navigate to the frontend directory:
   ```
   cd frontend
   ```

2. Install Node.js dependencies:
   ```
   npm install
   ```

3. Start the development server:
   ```
   npm start
   ```
   The application will be available at http://localhost:3000

## Usage

1. When you first open the application, you'll be prompted to define a role for the AI assistant
2. Choose from suggested roles or enter a custom role (e.g., "a physics professor")
3. Start chatting with the AI by typing your questions in the input field
4. View both the AI's final response and its reasoning process
5. For mathematical content, the AI will use LaTeX notation
6. Code snippets will be displayed with syntax highlighting

## API Endpoints

- `GET /`: Basic API information
- `POST /api/chat`: Send messages to the chatbot
  - Request body:
    ```json
    {
      "messages": [
        {"role": "user", "content": "Your message here"}
      ],
      "stream": true,
      "botRole": "a coding expert"
    }
    ```
  - Response: Server-sent events stream or JSON response

## Technical Details

### DeepSeek Model Integration

The application uses the DeepSeek Reasoner model through the OpenAI-compatible API. The integration is handled in `backend/deepseek_model.py`, which:

1. Loads the API key from environment variables
2. Initializes the OpenAI client with DeepSeek's endpoint
3. Provides functions for both streaming and non-streaming responses
4. Handles system messages with role definitions and formatting instructions

### Streaming Implementation

The application implements server-sent events (SSE) for streaming responses:

1. The frontend makes a POST request to the backend
2. The backend creates a streaming connection to the DeepSeek API
3. As chunks arrive from DeepSeek, they're processed and forwarded to the frontend
4. The frontend updates the UI in real-time as new content arrives

### Markdown and LaTeX Rendering

The frontend uses:
- `react-markdown` for Markdown rendering
- `remark-math` and `rehype-katex` for LaTeX support
- Custom code block parsing for syntax highlighting

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- DeepSeek for providing the AI model API
- React and Flask communities for the excellent frameworks
- All open-source libraries used in this project
