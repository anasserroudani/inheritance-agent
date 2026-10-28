# 🤖 Inheritance Agent

An intelligent AI agent powered by **Gemini (gemini-3.1-flash-lite)** designed to calculate, analyze, and explain complex inheritance and succession rules according to Fiqh and the Moudawana.

## 🚀 Features
- **Share Calculation:** Precise evaluation of Islamic estate distribution (Fara'id).
- **Special Cases:** Automated handling of advanced legal rules (Radd, Awl, Mushtarakah, etc.).
- **Interactive Chat:** A conversational command-line interface to ask inheritance questions in natural language.

## 📦 Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/YOUR_USERNAME/inheritance-agent.git
   cd inheritance-agent
   ```

2. **Install Node.js dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   Create a `.env` file in the root directory of the project and add your Gemini API key:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

## 🛠️ Usage

To launch the AI agent in interactive chat mode inside your console:
```bash
npm run chat
```

To launch the web app locally (open http://localhost:3000 or the port shown in the console):
```bash
npm start
```

To run it without a Gemini key (demo mode):
```bash
npm run demo
```

Other useful commands:
```bash
npm test               # run the tests
npm run build:data     # rebuild the knowledge files in /data
npm run eval:search    # check the search quality
npm run eval:engine    # stress-test the calculation engine
```

## 🗂️ Project Structure
- `/agent` - Core AI agent logic, system prompts, and Gemini API connectors.
- `/engine` - Mathematical and legal calculations engine for inheritance shares.
- `/data` - Knowledge base and reference texts (Fiqh, Moudawana data).
- `/api` - API endpoints to expose the agent's functionality (used by Vercel).
- `/public` - Web chat interface (HTML, CSS, JavaScript).
- `/scripts` - Scripts that build and evaluate the knowledge data.
- `/eval` - Engine stress-test (fuzz) script.
- `server.js` - Local web server for the chat interface.