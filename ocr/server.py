from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Optional
import uvicorn
import time
import os
from transformers import AutoTokenizer, AutoModelForCausalLM
import torch
import logging
import json
import re

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

# Enhanced whiteboard decision system
WHITEBOARD_KEYWORDS = {
    'teacher': [
        'show', 'demonstrate', 'example', 'explain', 'illustrate', 'draw', 'see',
        'look at', 'observe', 'display', 'present', 'visualize', 'teach', 'lesson'
    ],
    'student': [
        'practice', 'try', 'attempt', 'solve', 'work on', 'exercise', 'homework',
        'your turn', 'now you', 'calculate', 'figure out', 'find', 'compute'
    ]
}

DRAWING_CONCEPTS = {
    'probability_scale': [
        'probability scale', 'scale', 'impossible', 'certain', 'likelihood',
        'chance scale', '0 to 1', 'probability line'
    ],
    'distribution': [
        'distribution', 'histogram', 'frequency', 'bar chart', 'data distribution',
        'frequency distribution', 'bars', 'chart'
    ],
    'normal_curve': [
        'normal distribution', 'bell curve', 'gaussian', 'normal curve',
        'standard deviation', 'mean', 'sigma', 'bell shape'
    ],
    'tree_diagram': [
        'tree diagram', 'probability tree', 'conditional probability',
        'branches', 'outcomes', 'tree', 'sequential events'
    ]
}

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


def analyze_whiteboard_need(user_message: str) -> dict:
    """Analyze if whiteboard is needed and determine which one and what to draw"""
    message_lower = user_message.lower()
    
    # Determine whiteboard type
    teacher_score = sum(1 for keyword in WHITEBOARD_KEYWORDS['teacher'] 
                       if keyword in message_lower)
    student_score = sum(1 for keyword in WHITEBOARD_KEYWORDS['student'] 
                       if keyword in message_lower)
    
    # Default to teacher for demonstrations, student for practice
    if teacher_score > student_score:
        board_type = 'teacher'
    elif student_score > teacher_score:
        board_type = 'student'
    else:
        # Default decision based on context
        if any(word in message_lower for word in ['show', 'explain', 'what is', 'how does']):
            board_type = 'teacher'
        elif any(word in message_lower for word in ['practice', 'solve', 'calculate']):
            board_type = 'student'
        else:
            board_type = 'teacher'  # Default to teacher
    
    # Determine drawing type
    drawing_type = None
    for concept, keywords in DRAWING_CONCEPTS.items():
        if any(keyword in message_lower for keyword in keywords):
            drawing_type = concept
            break
    
    # If no specific concept, infer from general terms
    if not drawing_type:
        if any(word in message_lower for word in ['scale', 'impossible', 'certain']):
            drawing_type = 'probability_scale'
        elif any(word in message_lower for word in ['normal', 'bell', 'curve', 'gaussian']):
            drawing_type = 'normal_curve'
        elif any(word in message_lower for word in ['tree', 'conditional', 'branch']):
            drawing_type = 'tree_diagram'
        elif any(word in message_lower for word in ['distribution', 'histogram', 'frequency']):
            drawing_type = 'distribution'
    
    return {
        'needs_whiteboard': drawing_type is not None,
        'board_type': board_type,
        'drawing_type': drawing_type
    }


def enhance_response_with_whiteboard(response: str, user_message: str) -> str:
    """Enhance the response with appropriate whiteboard commands"""
    whiteboard_analysis = analyze_whiteboard_need(user_message)
    
    if not whiteboard_analysis['needs_whiteboard']:
        return response
    
    board_type = whiteboard_analysis['board_type']
    drawing_type = whiteboard_analysis['drawing_type']
    
    # Add whiteboard command to response
    whiteboard_command = f"[{board_type.upper()}_BOARD: {drawing_type}]"
    
    # Add contextual explanation
    if board_type == 'teacher':
        if drawing_type == 'probability_scale':
            response += f"\n\nLet me show you the probability scale on the teacher whiteboard! {whiteboard_command}"
        elif drawing_type == 'normal_curve':
            response += f"\n\nI'll draw a normal distribution curve to illustrate this concept! {whiteboard_command}"
        elif drawing_type == 'tree_diagram':
            response += f"\n\nA tree diagram will help visualize this - let me draw one! {whiteboard_command}"
        elif drawing_type == 'distribution':
            response += f"\n\nLet me show you with a distribution chart! {whiteboard_command}"
        else:
            response += f"\n\nI'll demonstrate this visually on the whiteboard! {whiteboard_command}"
    else:  # student board
        if drawing_type == 'probability_scale':
            response += f"\n\nNow it's your turn to practice with the probability scale! {whiteboard_command}"
        elif drawing_type == 'normal_curve':
            response += f"\n\nTry sketching a normal curve yourself on the student board! {whiteboard_command}"
        elif drawing_type == 'tree_diagram':
            response += f"\n\nPractice drawing a tree diagram for this problem! {whiteboard_command}"
        elif drawing_type == 'distribution':
            response += f"\n\nTry creating your own distribution chart! {whiteboard_command}"
        else:
            response += f"\n\nPractice this concept on your whiteboard! {whiteboard_command}"
    
    return response


def create_enhanced_prompt(user_message: str, context: List = None) -> str:
    """Create an enhanced prompt that includes whiteboard decision making"""
    
    # Analyze the message for whiteboard needs
    whiteboard_analysis = analyze_whiteboard_need(user_message)
    
    base_prompt = f"""You are an expert probability and statistics tutor with dual whiteboard capabilities.

WHITEBOARD SYSTEM:
- TEACHER WHITEBOARD: Use for demonstrations, explanations, examples, and teaching concepts
- STUDENT WHITEBOARD: Use for practice exercises, student work, and hands-on activities

AVAILABLE DRAWING FUNCTIONS:
- probability_scale: Shows 0-1 probability scale with examples
- normal_curve: Draws normal distribution with standard deviations
- tree_diagram: Creates probability tree for conditional events
- distribution: Shows frequency distribution/histogram

ANALYSIS OF CURRENT QUESTION:
Message: "{user_message}"
Whiteboard needed: {whiteboard_analysis['needs_whiteboard']}
Recommended board: {whiteboard_analysis['board_type']}
Suggested drawing: {whiteboard_analysis['drawing_type']}

INSTRUCTIONS:
1. Provide a clear, educational response about the probability/statistics concept
2. If visual aid would help, I will automatically add the appropriate whiteboard command
3. Be encouraging and supportive in your teaching approach
4. Use simple language and build concepts step by step
5. Give practical examples when possible

Student's Question: {user_message}

Provide a helpful, educational response:"""

    return base_prompt


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

        # Create enhanced prompt with whiteboard intelligence
        enhanced_prompt = create_enhanced_prompt(user_message)

        inputs = tokenizer(enhanced_prompt, return_tensors="pt",
                           padding=True, truncation=True, max_length=512)
        device = next(model.parameters()).device
        inputs = {k: v.to(device) for k, v in inputs.items()}

        logger.info("Generating enhanced response...")
        start_time = time.time()

        with torch.no_grad():
            outputs = model.generate(
                **inputs,
                max_new_tokens=min(request.max_tokens, 150),
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

        # Enhanced fallback responses based on question type
        if not response_text or len(response_text) < 10:
            if 'probability' in user_message.lower():
                response_text = f"Great question about probability! Let me help you understand this concept step by step."
            elif 'statistics' in user_message.lower():
                response_text = f"Statistics can be tricky, but I'm here to help! Let's break down your question about {user_message}."
            elif any(word in user_message.lower() for word in ['normal', 'distribution', 'curve']):
                response_text = f"Normal distributions are fundamental in statistics! Let me explain this concept clearly."
            elif any(word in user_message.lower() for word in ['tree', 'conditional']):
                response_text = f"Tree diagrams are perfect for understanding conditional probability! Let me show you how they work."
            else:
                response_text = f"I understand you're asking about '{user_message}'. Let me provide a clear explanation of this probability concept!"

        # Enhance response with intelligent whiteboard decisions
        enhanced_response = enhance_response_with_whiteboard(response_text, user_message)

        logger.info(f"Generated enhanced response: {enhanced_response[:50]}...")

        return {
            "id": f"chatcmpl-{int(time.time())}",
            "object": "chat.completion",
            "created": int(time.time()),
            "model": request.model,
            "choices": [{
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": enhanced_response
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
        "cuda_available": torch.cuda.is_available(),
        "whiteboard_system": "enhanced_dual_board"
    }


@app.get("/whiteboard/analyze")
async def analyze_message(message: str):
    """Endpoint to test whiteboard analysis"""
    analysis = analyze_whiteboard_need(message)
    return analysis


@app.get("/")
async def root():
    return {
        "message": "Enhanced TinyLlama Tutor Server with Intelligent Whiteboard System!",
        "features": [
            "Dual whiteboard system (teacher/student)",
            "Intelligent whiteboard selection",
            "Automatic drawing function detection",
            "Context-aware responses"
        ]
    }

if __name__ == "__main__":
    logger.info("Starting enhanced server on http://0.0.0.0:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")