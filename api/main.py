from fastapi import FastAPI

app = FastAPI(title="AI Hiring Assistant API")

@app.get("/health")
def health():
    return {"status": "ok"}