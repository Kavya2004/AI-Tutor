from transformers import AutoModelForCausalLM, AutoTokenizer
import torch

# Path to your local model folder
LOCAL_MODEL_PATH = "/absolute/path/to/your/local/model"

# Load tokenizer and model
tokenizer = AutoTokenizer.from_pretrained(LOCAL_MODEL_PATH)
model = AutoModelForCausalLM.from_pretrained(LOCAL_MODEL_PATH, torch_dtype=torch.float16).to("cuda")  # use "cpu" if no GPU

def generate_text(prompt: str, max_tokens: int = 256, temperature: float = 0.7) -> str:
    inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
    outputs = model.generate(
        **inputs,
        max_new_tokens=max_tokens,
        temperature=temperature,
        do_sample=True
    )
    return tokenizer.decode(outputs[0], skip_special_tokens=True)
