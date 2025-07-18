from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from model import generate_text

app = FastAPI()

class PromptRequest(BaseModel):
    prompt: str
    max_tokens: int = 256
    temperature: float = 0.7

@app.post("/generate")
async def generate(request: PromptRequest):
    try:
        result = generate_text(request.prompt, request.max_tokens, request.temperature)
        return {"response": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
