# Phone Buyer AI
(Another README.md present in the project)
An AI-powered smartphone recommendation and comparison platform that helps users find the best mobile devices based on their specific requirements.

## Project Structure

- /frontend: React-based user interface built with Vite.
- /backend: FastAPI server handling AI ranking and data serving.
- /scraper: Synthetic data generator that creates a realistic dataset of 1200+ phone variants.
- /data: Directory where the generated dataset is stored (excluded from Git).

### Frontend
- React.js
- Vite (Build tool)
- Vanilla CSS (Styling)

### Backend
- FastAPI (High-performance web framework)
- Uvicorn (ASGI server)
- Pydantic (Data validation)

### Machine Learning and Data Analysis
- Scikit-learn: Used for the ranking engine.
- MinMaxScaler: Normalizes phone specifications (Price, RAM, Camera, Battery) for comparison.
- Cosine Similarity: Calculates the match score between user requirements and device specifications.
- Pandas: Handles data manipulation and filtering.

## Setup and Installation

### 1. Clone the Project
```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
cd "phone buyer"
```

### 2. Python Environment Setup
It is recommended to use a virtual environment:
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
pip install -r scraper/requirements.txt
```

### 3. Frontend Setup
```bash
cd frontend
npm install
cd ..
```

## Running the Application

The easiest way to run the entire project (scraper, backend, and frontend) is to use the provided automation script.

### Using run_all.py
This script will generate the data, start the backend, and verify everything is working:
```bash
python3 run_all.py
```

### Manual Execution
If you prefer to run components separately:

1. Generate the Dataset:
```bash
python3 scraper/scraper.py
```

2. Start the Backend:
```bash
uvicorn backend.main:app --reload
```

3. Start the Frontend:
```bash
cd frontend
npm run dev
```

## Features
- AI Ranking Engine: Uses vector-based similarity to find phones matching your budget and spec requirements.
- Real-time Pricing Simulation: Simulates live price checks across Indian retailers (Amazon, Flipkart, etc.).
- Procedural Dataset: Generates a massive dataset to demonstrate the system's scalability without scraping restrictions.
- Comparison Tool: Compare up to 3 phones side-by-side with highlight features.
