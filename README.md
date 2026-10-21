# 🤖 Inheritance Agent

An intelligent AI agent powered by **Gemini (gemini-3.1-flash-lite)** designed to calculate, analyze, and explain complex inheritance and succession rules according to Fiqh and the Moudawana.

## 🚀 Features
- **Share Calculation:** Precise evaluation of Islamic estate distribution (Fara'id).
- **Special Cases:** Automated handling of advanced legal rules (Radd, Awl, Mushtarakah, etc.).
- **Interactive Chat:** A conversational command-line interface to ask inheritance questions in natural language.

## 📦 Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com
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

## 🗂️ Project Structure
- `/agent` - Core AI agent logic, system prompts, and Gemini API connectors.
- `/engine` - Mathematical and legal calculations engine for inheritance shares.
- `/data` - Knowledge base and reference texts (Fiqh, Moudawana data).
- `/api` - API endpoints to expose the agent's functionality.
