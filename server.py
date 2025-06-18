from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List
import uvicorn
import time
import os
from transformers import AutoTokenizer, AutoModelForCausalLM
import torch
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

os.environ["TOKENIZERS_PARALLELISM"] = "false"
torch.set_num_threads(4)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

model = None
tokenizer = None


def load_model():
    global model, tokenizer
    try:
        logger.info("Loading TinyLlama model and tokenizer...")
        model_name = "TinyLlama/TinyLlama-1.1B-Chat-v1.0"

        tokenizer = AutoTokenizer.from_pretrained(model_name)
        if tokenizer.pad_token is None:
            tokenizer.pad_token = tokenizer.eos_token

        model = AutoModelForCausalLM.from_pretrained(
            model_name,
            torch_dtype=torch.float16 if torch.cuda.is_available() else None,
            device_map="auto" if torch.cuda.is_available() else None
        )

        if torch.cuda.is_available():
            torch.backends.cudnn.benchmark = True
            torch.cuda.empty_cache()
            logger.info(
                f"GPU Memory: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f} GB")
        else:
            logger.info("Running on CPU")

        logger.info("Model loaded successfully!")
        return True
    except Exception as e:
        logger.error(f"Error loading model: {e}")
        return False


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatCompletionRequest(BaseModel):
    model: str
    messages: List[ChatMessage]
    temperature: float = 0.7
    max_tokens: int = 200


@app.on_event("startup")
async def startup_event():
    success = load_model()
    if not success:
        logger.error("Failed to load model on startup!")


@app.options("/v1/chat/completions")
async def preflight_handler(request: Request):
    return JSONResponse(content={}, status_code=200)


@app.post("/v1/chat/completions")
async def chat_completions(request: ChatCompletionRequest):
    global model, tokenizer

    if model is None or tokenizer is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    try:
        user_message = request.messages[-1].content if request.messages else ""
        logger.info(f"Processing message: {user_message[:50]}...")

        prompt = f"""### Instruction:
{user_message}

### Response:
"""

        inputs = tokenizer(prompt, return_tensors="pt",
                           padding=True, truncation=True, max_length=512)
        device = next(model.parameters()).device
        inputs = {k: v.to(device) for k, v in inputs.items()}

        logger.info("Generating response...")
        start_time = time.time()

        with torch.no_grad():
            outputs = model.generate(
                **inputs,
                max_new_tokens=min(request.max_tokens, 100),
                temperature=max(request.temperature, 0.1),
                do_sample=True,
                pad_token_id=tokenizer.pad_token_id,
                eos_token_id=tokenizer.eos_token_id,
                top_p=0.9,
                repetition_penalty=1.1,
                length_penalty=1.0,
                early_stopping=True
            )

        end_time = time.time()
        logger.info(f"⏱️ Response took {end_time - start_time:.2f} seconds")

        input_length = inputs['input_ids'].shape[1]
        response_tokens = outputs[0][input_length:]
        response_text = tokenizer.decode(
            response_tokens, skip_special_tokens=True).strip()

        if not response_text:
            response_text = "Could you clarify your question about probability?"

        logger.info(f"Generated response: {response_text[:50]}...")

        return {
            "id": f"chatcmpl-{int(time.time())}",
            "object": "chat.completion",
            "created": int(time.time()),
            "model": request.model,
            "choices": [{
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": response_text
                },
                "finish_reason": "stop"
            }],
            "usage": {
                "prompt_tokens": input_length,
                "completion_tokens": len(response_tokens),
                "total_tokens": input_length + len(response_tokens)
            }
        }

    except Exception as e:
        logger.error(f"Error in chat completion: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": {"message": str(e), "type": "server_error"}}
        )


@app.get("/health")
async def health_check():
    model_loaded = model is not None and tokenizer is not None
    return {
        "status": "healthy" if model_loaded else "unhealthy",
        "model_loaded": model_loaded,
        "cuda_available": torch.cuda.is_available()
    }


@app.get("/")
async def root():
    return {"message": "TinyLlama Tutor Server is running!"}

if __name__ == "__main__":
    logger.info("Starting server on http://0.0.0.0:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
