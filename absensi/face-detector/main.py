from fastapi import FastAPI

app = FastAPI()

@app.get("/health")
def health():
    return {"service": "face-detector", "ok": True}
