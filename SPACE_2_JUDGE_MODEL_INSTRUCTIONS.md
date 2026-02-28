# HuggingFace Judge Space - Setup Instructions

## CONTEXT
I'm building an LLM evaluation backend. This HuggingFace Space runs a judge model to evaluate LLM outputs. It needs to:
- Use a **math adapter (PEFT/LoRA)** for AIME mathematical reasoning
- Use **prompt engineering** for MMLU, MSUR, custom datasets

## YOUR TASK
Create a HuggingFace Space that:
1. Loads a base model (e.g., Qwen/Qwen2.5-7B-Instruct)
2. Has a **math adapter** for AIME benchmark evaluation
3. Uses specialized prompts for MSUR (proof writing) and MMLU (multiple choice)
4. Returns evaluation judgments in JSON format

---

## REQUIREMENTS

### Space Configuration
- **Space SDK:** Gradio (with custom API endpoint)
- **Hardware:** GPU - A10G (24GB) recommended
- **Base Model:** Qwen/Qwen2.5-7B-Instruct or LLaMA-3-8B
- **Math Adapter:** PEFT/LoRA adapter trained on mathematical reasoning
- **Python Version:** 3.10+

### API Endpoints

#### 1. **POST** `/infer` - Evaluation Endpoint

**Request Body:**
```json
{
  "prompt": "Evaluate if the answer is correct...",
  "adapter": "math",
  "temperature": 0.3,
  "max_tokens": 512
}
```

**adapters:**
- `"math"` - Loads math adapter for AIME evaluation
- `"base"` or `"msur"` or `"mmlu"` or `"custom"` - Uses base model with specialized prompts

**Response:**
```json
{
  "text": "{\"score\": 8.5, \"passed\": true, \"reasoning\": \"...\"}",
  "generated_text": "...",
  "output": "..."
}
```

#### 2. **POST** `/generate` - Test Case Generation Endpoint

**Request Body:**
```json
{
  "parent_prompt": "What is the capital of France?",
  "temperature": 0.8,
  "max_tokens": 200
}
```

**Response:**
```json
{
  "parent_prompt": "What is the capital of France?",
  "generated_prompts": {
    "ambiguity": "What is the capital?",
    "contradiction": "What is the capital of France, which is not Paris?",
    "negation": "What is NOT the capital of France?"
  }
}
```

---

## FILES TO CREATE

### 1. `app.py` (Main Application)

```python
import gradio as gr
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM
from peft import PeftModel
import json
import os

# Global model and tokenizer
base_model = None
tokenizer = None
math_adapter_model = None

# Base model configuration
BASE_MODEL_NAME = "Qwen/Qwen2.5-7B-Instruct"
MATH_ADAPTER_PATH = "./math_adapter"  # Local path to adapter weights

# Base judge prompt (from backend prompts/judge.txt)
BASE_JUDGE_PROMPT = """You are an expert AI judge evaluating the quality of language model responses. Your task is to carefully assess the model's response based on the given prompt and provide a detailed, objective evaluation.

EVALUATION CRITERIA:
1. Accuracy (0-10): Is the response factually correct and free from errors?
2. Relevance (0-10): Does the response directly address the prompt?
3. Coherence (0-10): Is the response well-structured and logically organized?
4. Completeness (0-10): Does the response fully answer all aspects of the prompt?

INSTRUCTIONS:
- Read the original prompt carefully
- Analyze the model's response against each criterion
- Provide a score for each criterion (0-10)
- Calculate an overall score (average of all criteria)
- Provide detailed reasoning for your evaluation
- Determine if the response passes (score >= 6.0) or fails (score < 6.0)
- Give constructive feedback for improvement

OUTPUT FORMAT - RESPOND ONLY WITH VALID JSON (NO OTHER TEXT):
{
  "score": <overall_score>,
  "criteria": {
    "accuracy": <score>,
    "relevance": <score>,
    "coherence": <score>,
    "completeness": <score>
  },
  "reasoning": "<detailed explanation of your evaluation>",
  "passed": <true/false>,
  "feedback": "<constructive feedback for improvement>"
}

CRITICAL: Return ONLY the JSON object above. Do not include any explanatory text before or after the JSON. No markdown code blocks. Just pure JSON.

Be objective, fair, and thorough in your evaluation. Focus on the quality of the response, not on stylistic preferences."""

# Specialized prompts for different evaluation types
MSUR_SYSTEM_PROMPT = """You are an expert AI judge evaluating MATHEMATICAL PROOFS. Focus on proof-specific criteria:

EVALUATION CRITERIA:
1. Accuracy (0-10): Is the mathematical reasoning correct? Are formulas and calculations accurate?
2. Relevance (0-10): Does the proof address the problem statement directly?
3. Coherence (0-10): Is the logical flow clear? Are steps properly connected?
4. Completeness (0-10): Are all necessary steps included? Is the proof rigorous?

ADDITIONAL FOCUS FOR PROOFS:
- Logical rigor and mathematical correctness
- Proper use of mathematical notation
- Clear argument structure and step-by-step reasoning
- No logical gaps or unsupported leaps

OUTPUT FORMAT - RESPOND ONLY WITH VALID JSON:
{
  "score": <overall_score>,
  "criteria": {"accuracy": <score>, "relevance": <score>, "coherence": <score>, "completeness": <score>},
  "reasoning": "<detailed explanation>",
  "passed": <true/false>,
  "feedback": "<constructive feedback>"
}

Return ONLY the JSON object. No markdown, no extra text."""

MMLU_SYSTEM_PROMPT = """You are an expert AI judge evaluating MULTIPLE-CHOICE ANSWERS across various academic domains.

EVALUATION CRITERIA:
1. Accuracy (0-10): Is the selected answer factually correct? Does it match the expected answer?
2. Relevance (0-10): Does the answer directly address the question asked?
3. Coherence (0-10): Is the reasoning (if provided) logically sound?
4. Completeness (0-10): Does the answer fully address all aspects of the question?

ADDITIONAL FOCUS FOR MULTIPLE-CHOICE:
- Factual accuracy in the chosen answer
- Domain-specific knowledge correctness
- Whether the answer matches what an expert would select
- Reasoning quality if explanation is provided

OUTPUT FORMAT - RESPOND ONLY WITH VALID JSON:
{
  "score": <overall_score>,
  "criteria": {"accuracy": <score>, "relevance": <score>, "coherence": <score>, "completeness": <score>},
  "reasoning": "<detailed explanation>",
  "passed": <true/false>,
  "feedback": "<constructive feedback>"
}

Return ONLY the JSON object. No markdown, no extra text."""

MATH_SYSTEM_PROMPT = """You are an expert AI judge evaluating MATHEMATICAL PROBLEM SOLUTIONS (AIME competition level).

EVALUATION CRITERIA:
1. Accuracy (0-10): Is the final answer numerically correct? Are all calculations accurate?
2. Relevance (0-10): Does the solution address the problem statement?
3. Coherence (0-10): Is the mathematical reasoning logically sound and well-organized?
4. Completeness (0-10): Are all steps shown? Is the methodology complete?

ADDITIONAL FOCUS FOR COMPETITION MATH:
- Numerical correctness of the final answer (PRIMARY importance)
- Validity of mathematical methods used
- Proper handling of edge cases
- Clear presentation of solution steps

OUTPUT FORMAT - RESPOND ONLY WITH VALID JSON:
{
  "score": <overall_score>,
  "criteria": {"accuracy": <score>, "relevance": <score>, "coherence": <score>, "completeness": <score>},
  "reasoning": "<detailed explanation>",
  "passed": <true/false>,
  "feedback": "<constructive feedback>"
}

Return ONLY the JSON object. No markdown, no extra text."""

CUSTOM_SYSTEM_PROMPT = BASE_JUDGE_PROMPT  # Use base prompt for custom datasets

# Generator prompts for test case creation (from backend prompts/generators/)
AMBIGUITY_GENERATOR_PROMPT = """You are a test case generator specialized in creating AMBIGUOUS prompts for LLM evaluation.

Your task is to take the given parent prompt and generate ONE ambiguous version that is intentionally vague or can be interpreted in multiple ways.

CHARACTERISTICS OF AMBIGUOUS PROMPTS:
- Use pronouns without clear antecedents (e.g., "it", "they", "that")
- Include words with multiple meanings
- Provide insufficient context
- Use vague quantifiers ("some", "many", "a lot")
- Create situations where multiple interpretations are valid
- Omit critical details intentionally

GENERATION GUIDELINES:
- Keep prompts short (5-15 words)
- Ensure the ambiguity is natural, not contrived
- Avoid being so vague that the prompt is meaningless
- The prompt should be answerable, but require assumptions

PARENT PROMPT: {parent_prompt}

Generate ONE ambiguous version of this prompt. Return ONLY the ambiguous prompt, nothing else."""

CONTRADICTION_GENERATOR_PROMPT = """You are a test case generator specialized in creating prompts with CONTRADICTIONS for LLM evaluation.

Your task is to take the given parent prompt and generate ONE contradictory version that contains conflicting instructions or logically inconsistent elements.

CHARACTERISTICS OF CONTRADICTION PROMPTS:
- Include two or more mutually exclusive requirements
- Present conflicting instructions in the same prompt
- Combine contradictory facts or assumptions
- Request outputs that cannot coexist
- Create logical impossibilities
- Mix incompatible constraints

EXAMPLES:
- "Write a brief essay of at least 5000 words."
- "Explain this concept using only numbers, but don't use any digits."
- "Give me a detailed summary in one sentence."

GENERATION GUIDELINES:
- Make contradictions clear enough to be detectable
- Vary the type of contradiction (temporal, logical, quantitative, qualitative)
- Test how models prioritize conflicting instructions

PARENT PROMPT: {parent_prompt}

Generate ONE contradictory version of this prompt. Return ONLY the contradictory prompt, nothing else."""

NEGATION_GENERATOR_PROMPT = """You are a test case generator specialized in creating prompts with NEGATIONS for LLM evaluation.

Your task is to take the given parent prompt and generate ONE negation version that uses negative constraints or asks to avoid certain things.

CHARACTERISTICS OF NEGATION PROMPTS:
- Use explicit negations ("not", "don't", "never", "without")
- Request avoiding specific words, concepts, or approaches
- Ask for alternatives while excluding common options
- Include multiple layers of negation
- Combine positive and negative constraints

EXAMPLES:
- "Explain quantum physics without using the words 'particle' or 'wave'."
- "Write a story about happiness without mentioning any emotions."
- "List programming languages, excluding all languages that start with 'P'."

GENERATION GUIDELINES:
- Use clear negative instructions
- Test both content restrictions and format restrictions
- Some negations should be easy to follow, others challenging
- Test if models truly understand what to avoid

PARENT PROMPT: {parent_prompt}

Generate ONE negation version of this prompt. Return ONLY the negated prompt, nothing else."""

def load_models():
    """Load base model and math adapter"""
    global base_model, tokenizer, math_adapter_model
    
    print(f"Loading base model: {BASE_MODEL_NAME}")
    tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL_NAME, trust_remote_code=True)
    base_model = AutoModelForCausalLM.from_pretrained(
        BASE_MODEL_NAME,
        torch_dtype=torch.float16,
        device_map="auto",
        trust_remote_code=True
    )
    base_model.eval()
    
    # Load math adapter if exists
    if os.path.exists(MATH_ADAPTER_PATH):
        print(f"Loading math adapter from {MATH_ADAPTER_PATH}")
        try:
            math_adapter_model = PeftModel.from_pretrained(base_model, MATH_ADAPTER_PATH)
            math_adapter_model.eval()
            print("Math adapter loaded successfully")
        except Exception as e:
            print(f"Failed to load math adapter: {e}")
            print("Will use base model with math-focused prompts instead")
            math_adapter_model = None
    else:
        print("No math adapter found, using base model with specialized prompts")
        math_adapter_model = None

def get_system_prompt(adapter_type: str) -> str:
    """Get specialized system prompt based on adapter type"""
    if adapter_type == "msur":
        return MSUR_SYSTEM_PROMPT
    elif adapter_type == "mmlu":
        return MMLU_SYSTEM_PROMPT
    elif adapter_type == "math":
        return MATH_SYSTEM_PROMPT
    elif adapter_type == "custom":
        return CUSTOM_SYSTEM_PROMPT
    else:  # base
        return BASE_JUDGE_PROMPT

def infer(prompt: str, adapter: str = "base", temperature: float = 0.3, 
          max_tokens: int = 512, top_p: float = 1.0):
    """
    Run inference with specified adapter/prompt strategy
    """
    try:
        global base_model, tokenizer, math_adapter_model
        
        # Load models if not already loaded
        if base_model is None:
            load_models()
        
        # Determine which model to use
        if adapter == "math" and math_adapter_model is not None:
            model = math_adapter_model
            print("Using math adapter model")
        else:
            model = base_model
            print(f"Using base model with {adapter} prompt")
        
        # Get appropriate system prompt
        system_prompt = get_system_prompt(adapter)
        
        # Format messages for chat model
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt}
        ]
        
        # Apply chat template
        formatted_prompt = tokenizer.apply_chat_template(
    generate_test_case(parent_prompt: str, pattern_type: str, temperature: float = 0.8, 
                       max_tokens: int = 200):
    """
    Generate a single test case based on pattern type
    """
    try:
        global base_model, tokenizer
        
        if base_model is None:
            load_models()
        
        # Select the appropriate generator prompt
        if pattern_type == "ambiguity":
            generator_prompt = AMBIGUITY_GENERATOR_PROMPT.format(parent_prompt=parent_prompt)
        elif pattern_type == "contradiction":
            generator_prompt = CONTRADICTION_GENERATOR_PROMPT.format(parent_prompt=parent_prompt)
        elif pattern_type == "negation":
            generator_prompt = NEGATION_GENERATOR_PROMPT.format(parent_prompt=parent_prompt)
        else:
            return {"error": f"Unknown pattern type: {pattern_type}"}
        
        # Use base model for generation (not adapter)
        model = base_model
        
        # Format as user message
        messages = [{"role": "user", "content": generator_prompt}]
        
        # Apply chat template& Generation")
    gr.Markdown("APIs: POST /infer (evaluation) | POST /generate (test case generation)")
    
    with gr.Tab("Evaluation API"):
        request_input = gr.Textbox(
            label="Request JSON",
            placeholder='{"prompt": "Evaluate this...", "adapter": "math", "max_tokens": 512}',
            lines=5
        )
        response_output = gr.Textbox(label="Response JSON", lines=10)
        submit_btn = gr.Button("Send Request")
        submit_btn.click(api_inference, inputs=request_input, outputs=response_output)
    
    with gr.Tab("Generation API"):
        gen_request_input = gr.Textbox(
            label="Request JSON",
            placeholder='{"parent_prompt": "What is the capital of France?", "temperature": 0.8}',
            lines=3
        )
        gen_response_output = gr.Textbox(label="Response JSON", lines=10)
        gen_submit_btn = gr.Button("Generate Test Cases")
        gen_submit_btn.click(api_generate, inputs=gen_request_input, outputs=gen_
            outputs = model.generate(
                inputs.input_ids,
                max_new_tokens=max_tokens,
                temperature=temperature,
                top_p=0.95,
                do_sample=True,
                pad_token_id=tokenizer.eos_token_id
            )
        
        # Decode output
        generated_text = tokenizer.decode(
            outputs[0][inputs.input_ids.shape[1]:], 
            skip_special_tokens=True
        ).strip()
        
        return generated_text
        
    except Exception as e:
        return f"Error generating {pattern_type}: {str(e)}"

def generate_all_patterns(parent_prompt: str, temperature: float = 0.8, 
                          max_tokens: int = 200):
    """
    Generate one prompt for each of the three patterns
    """
    try:
        ambiguity_prompt = generate_test_case(parent_prompt, "ambiguity", temperature, max_tokens)
        contradiction_prompt = generate_test_case(parent_prompt, "contradiction", temperature, max_tokens)
        negation_prompt = generate_test_case(parent_prompt, "negation", temperature, max_tokens)
        
        return {
            "parent_prompt": parent_prompt,
            "generated_prompts": {
                "ambiguity": ambiguity_prompt,
                "contrEvaluation"):
        prompt_input = gr.Textbox(
            label="Evaluation Prompt", 
            value="Question: What is 2+2?\nModel Answer: 4\nExpected: 4\n\nEvaluate if the answer is correct.",
            lines=5
        )
        adapter_dropdown = gr.Dropdown(
            choices=["base", "math", "msur", "mmlu", "custom"],
            value="base",
            label="Adapter/Prompt Type"
        )
        temp_slider = gr.Slider(0.0, 1.0, value=0.3, label="Temperature")
        max_tokens_slider = gr.Slider(50, 1024, value=512, label="Max Tokens")
        
        test_output = gr.JSON(label="Output")
        test_btn = gr.Button("Run Evaluation")
        test_btn.click(
            infer,
            inputs=[prompt_input, adapter_dropdown, temp_slider, max_tokens_slider],
            outputs=test_output
        )
    
    with gr.Tab("Test Generation"):
        parent_prompt (Evaluation)
    - **math**: Uses math adapter (PEFT/LoRA) for AIME mathematical reasoning
    - **msur**: Proof writing evaluation with specialized prompt
    - **mmlu**: Multiple choice evaluation with specialized prompt
    - **custom**: General evaluation for custom datasets
    - **base**: Standard evaluation without specialization
    
    ### Test Case Generation
    Generates THREE prompts from one parent prompt:
    - **Ambiguity**: Removes critical context
    - **Contradiction**: Adds conflicting information
    - **Negation**: Asks for what is NOT the answerabel="Temperature")
        gen_max_tokens_slider = gr.Slider(50, 512, value=200, label="Max Tokens")
        
        gen_test_output = gr.JSON(label="Generated Prompts")
        gen_test_btn = gr.Button("Generate Test Cases")
        gen_test_btn.click(
            generate_all_patterns,
            inputs=[parent_prompt_input, gen_temp_slider, gen_max_tokens_slider],
            outputs=gen_.get("top_p", 1.0)
        
        if not prompt:
            return json.dumps({
                "error": "Missing required field: 'prompt'",
                "text": ""
            })
        
        result = infer(prompt, adapter, temperature, max_tokens, top_p)
        return json.dumps(result)
        
    except json.JSONDecodeError:
        return json.dumps({"error": "Invalid JSON", "text": ""})
    except Exception as e:
        return json.dumps({"error": str(e), "text": ""})

def api_generate(request: str):
    """API endpoint handler for test case generation"""
    try:
        data = json.loads(request)
        
        parent_prompt = data.get("parent_prompt")
        temperature = data.get("temperature", 0.8)
        max_tokens = data.get("max_tokens", 200)
        
        if not parent_prompt:
            return json.dumps({
                "error": "Missing required field: 'parent_prompt'"
            })
        
        result = generate_all_patterns(parent_prompt, temperature, max_tokens)
        return json.dumps(result)
        
    except json.JSONDecodeError:
        return json.dumps({"error": "Invalid JSON"})
    except Exception as e:
        return json.dumps({"error": str(e)
        return {
            "text": generated_text.strip(),
            "generated_text": generated_text.strip(),
            "output": generated_text.strip(),
            "adapter_used": adapter,
            "usage": {
                "prompt_tokens": input_length,
                "completion_tokens": output_length,
                "total_tokens": input_length + output_length
            }
        }
        
    except Exception as e:
        return {
            "error": str(e),
            "text": "",
            "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
        }

def api_inference(request: str):
    """API endpoint handler"""
    try:
        data = json.loads(request)
        
        prompt = data.get("prompt")
        adapter = data.get("adapter", "base")
        temperature = data.get("temperature", 0.3)
        max_tokens = data.get("max_tokens", 512)
        top_p = data.get("top_p", 1.0)
        
        if not prompt:
            return json.dumps({
                "error": "Missing required field: 'prompt'",
                "text": ""
            })
        
        result = infer(prompt, adapter, temperature, max_tokens, top_p)
        return json.dumps(result)
        
    except json.JSONDecodeError:
        return json.dumps({"error": "Invalid JSON", "text": ""})
    except Exception as e:
        return json.dumps({"error": str(e), "text": ""})

# Gradio Interface
with gr.Blocks() as demo:
    gr.Markdown("# Judge Model Space - Evaluation with Adapters")
    gr.Markdown("API Endpoint: POST /infer")
    
    with gr.Tab("API"):
        request_input = gr.Textbox(
            label="Request JSON",
            placeholder='{"prompt": "Evaluate this...", "adapter": "math", "max_tokens": 512}',
            lines=5
        )
        response_output = gr.Textbox(label="Response JSON", lines=10)
        submit_btn = gr.Button("Send Request")
        submit_btn.click(api_inference, inputs=request_input, outputs=response_output)
    
    with gr.Tab("Test Interface"):
        prompt_input = gr.Textbox(
            label="Evaluation Prompt", 
            value="Question: What is 2+2?\nModel Answer: 4\nExpected: 4\n\nEvaluate if the answer is correct.",
            lines=5
        )
        adapter_dropdown = gr.Dropdown(
            choices=["base", "math", "msur", "mmlu", "custom"],
            value="base",
            label="Adapter/Prompt Type"
        )
        temp_slider = gr.Slider(0.0, 1.0, value=0.3, label="Temperature")
        max_tokens_slider = gr.Slider(50, 1024, value=512, label="Max Tokens")
        
        test_output = gr.JSON(label="Output")
        test_btn = gr.Button("Run Evaluation")
        test_btn.click(
            infer,
            inputs=[prompt_input, adapter_dropdown, temp_slider, max_tokens_slider],
            outputs=test_output
        )
    
    gr.Markdown("""
    ### Adapter Types
    - **math**: Uses math adapter (PEFT/LoRA) for AIME mathematical reasoning
    - **msur**: Proof writing evaluation with specialized prompt
    - **mmlu**: Multiple choice evaluation with specialized prompt
    - **custom**: General evaluation for custom datasets
    - **base**: Standard evaluation without specialization
    
    ### Math Adapter
    If `math_adapter/` folder exists with PEFT weights, it will be loaded automatically.
    Otherwise, falls back to base model with math-focused prompts.
    """)

# Load models on startup
load_models()

demo.launch(server_name="0.0.0.0", server_port=7860)
```

### 2. `requirements.txt`

```txt
torch>=2.0.0
transformers>=4.30.0
accelerate>=0.20.0
### Evaluation Endpoint

gradio>=4.0.0
peft>=0.5.0
sentencepiece
protobuf
bitsandbytes
```

### 3. `README.md`

```markdown
---
title: Judge Model Space
emoji: ⚖️
colorFrom: purple
colorTo: pink
sdk: gradio
sdk_version: 4.0.0
app_file: app.py
pinned: false
license: mit
---

# Judge Model Space


### Generation Endpoint

**Endpoint:** POST /generate

**Request:**
\`\`\`json
{
  "parent_prompt": "What is the capital of France?",
  "temperature": 0.8,
  "max_tokens": 200
}
\`\`\`

**Response:**
\`\`\`json
{
  "parent_prompt": "What is the capital of France?",
  "generated_prompts": {
    "ambiguity": "What is the capital?",
    "contradiction": "What is the capital of France, which is not in Europe?",
    "negation": "What is NOT the capital of France?"
  }
}
\`\`\`
LLM judge for evaluation with specialized adapters and prompts.

## Features
- **Math Adapter**: PEFT/LoRA adapter for AIME mathematical reasoning
- **Specialized Prompts**: Custom prompts for MSUR, MMLU, custom datasets
- **JSON Output**: Structured evaluation results

## API Usage

**Endpoint:** POST /infer

**Request:**
\`\`\`json
{
  "prompt": "Question: What is 2+2?\\nModel Answer: 4\\nExpected: 4",
  "adapter": "math",
  "temperature": 0.3,
  "max_tokens": 512
}
\`\`\`

**Adapter Types:**
- \`math\` - Math adapter for AIME
- \`msur\` - Proof writing prompt
- \`mmlu\` - Multiple choice prompt
- \`custom\` - General evaluation prompt
- \`base\` - Standard prompt

**Response:**
\`\`\`json
{
  "text": "{\\\"score\\\": 10, \\\"passed\\\": true, \\\"reasoning\\\": \\\"Correct answer\\\"}",
  "adapter_used": "math"
}
\`\`\`
```

### 4. `math_adapter/README.md` (Adapter Documentation)

```markdown
# Math Adapter for AIME Evaluation

This folder should contain PEFT/LoRA adapter weights for mathematical reasoning.

## Option 1: Train Your Own Adapter

Use the training script to fine-tune on AIME problems:

```python
from transformers import AutoModelForCausalLM, AutoTokenizer, TrainingArguments
from peft import LoraConfig, get_peft_model, TaskType
from datasets import load_dataset

# Load base model
model = AutoModelForCausalLM.from_pretrained("Qwen/Qwen2.5-7B-Instruct")
tokenizer = AutoTokenizer.from_pretrained("Qwen/Qwen2.5-7B-Instruct")

# Configure LoRA
lora_config = LoraConfig(
    task_type=TaskType.CAUSAL_LM,
    r=16,
    lora_alpha=32,
    lora_dropout=0.1,
    target_modules=["q_proj", "v_proj", "k_proj", "o_proj"]
)

# Apply LoRA
model = get_peft_model(model, lora_config)

# Train on AIME dataset (you need to prepare this)
# ... training code ...

# Save adapter
model.save_pretrained("./math_adapter")
```

## Option 2: Use Pre-trained Math Adapter

Download a pre-trained math adapter from HuggingFace:

```bash
# Example: Download a math reasoning adapter
git clone https://huggingface.co/USERNAME/math-reasoning-adapter ./math_adapter
```

## Option 3: No Adapter (Prompt Engineering Only)

If no adapter is available, the system will use the base model with specialized math prompts.
This still works but may be less accurate than a fine-tuned adapter.

## Files Required

If using an adapter, this folder should contain:
- `adapter_config.json`
- `adapter_model.bin` or `adapter_model.safetensors`

The app will automatically detect and load these files on startup.
```

---

## DEPLOYMENT STEPS

### Step 1: Create HuggingFace Account
1. Go to https://huggingface.co
2. Sign up or login
3. Create access token: Settings → Access Tokens → New Token
s

**Test Evaluation Endpoint:**
```bash
curl -X POST https://YOUR_USERNAME-judge-model-space.hf.space/api/predict \
  -H "Content-Type: application/json" \
  -d '{
    "data": ["{\"prompt\": \"Question: 2+2?\\nAnswer: 4\\nExpected: 4\", \"adapter\": \"math\"}"],
    "fn_index": 0
  }'
```

**Test Generation Endpoint:**
```bash
curl -X POST https://YOUR_USERNAME-judge-model-space.hf.space/api/predict \
  -H "Content-Type: application/json" \
  -d '{
    "data": ["{\"parent_prompt\": \"What is the capital of France?\"}"],
    "fn_index": 1
5. **Hardware:** GPU - A10G (24GB) recommended
6. Click "Create Space"

### Step 3: Upload Files
**Option A: Web Interface**
1. Click "Files" tab
2. Create `app.py` (paste code above)
3. Create `requirements.txt` (paste dependencies)
4. Edit `README.md` (paste content above)
5. Create `math_adapter/README.md` (paste adapter docs)

**Option B: Git**
```bash
git clone https://huggingface.co/spaces/YOUR_USERNAME/judge-model-space
cd judge-model-space
# Copy files
cp app.py requirements.txt README.md ./
mkdir -p math_adapter
cp math_adapter/README.md ./math_adapter/
git add .
git commit -m "Initial commit"
git push
```

### Step 4: (Optional) Add Math Adapter
**If you have a trained math adapter:**
1. Upload adapter files to `math_adapter/` folder:
   - `adapter_config.json`
   - `adapter_model.bin` or `adapter_model.safetensors`

**If you don't have an adapter:**
- The app will work without it using prompt engineering
- You can train one later and upload it
- Performance will be good but not optimal for AIME

### Step 5: Configure Hardware
1. Go to Space Settings
2. Under "Hardware" select: **GPU - A10G (24GB)**
   - Free tier T4 may not be enough for 7B model
   - A10G costs ~$0.60/hour
3. Click "Save"
4. Space will restart with GPU

### Step 6: Wait for Build
- Monitor "Logs" tab
- Wait for "Running on http://0.0.0.0:7860"
- First build takes 5-10 minutes (downloads 7B model)

### Step 7: Get Your Space URL
Your Space API endpoint will be:
```
https://YOUR_USERNAME-judge-model-space.hf.space/infer
```

### Step 8: Test the API
```bash
curl -X POST https://YOUR_USERNAME-judge-model-space.hf.space/api/predict \
  -H "Content-Type: application/json" \
  -d '{

### Using the Generation Endpoint

When users want to generate test cases from the frontend:

1. Call `/generate` endpoint with parent prompt
2. Receive 3 generated prompts (ambiguity, contradiction, negation)
3. Store in database via `POST /api/generator/testcases/bulk`
4. Run models against these test cases
5. Evaluate responses with `/infer` endpoint
    "data": ["{\"prompt\": \"Question: 2+2?\\nAnswer: 4\\nExpected: 4\", \"adapter\": \"math\"}"]
  }'
```

---

## ADAPTER STRATEGY EXPLAINED

### AIME (Math Adapter)
- **Strategy:** PEFT/LoRA adapter fine-tuned on mathematical reasoning
- **Fallback:** If no adapter exists, uses base model with math-focused prompt
- **Why:** AIME requires precise mathematical evaluation
- **Training:** Fine-tune on AIME problems + solutions + evaluations

### MSUR (Prompt Engineering)
- **Strategy:** Specialized system prompt for proof evaluation
- **Prompt focuses on:** Logical rigor, clarity, notation, completeness
- **No adapter needed:** Prompt engineering sufficient for proof evaluation

### MMLU (Prompt Engineering)
- **Strategy:** Specialized prompt for multiple-choice across domains
- **Prompt focuses on:** Factual accuracy, reasoning, domain knowledge
- **No adapter needed:** Base model capable with proper prompting

### Custom/General (Prompt Engineering)
- **Strategy:** General evaluation prompt
- **Flexible:** Works for any custom dataset
- **No adapter needed:** Adaptable to user-defined criteria

---

## COST ESTIMATION

### Hardware Costs
- **T4 GPU (16GB):** Free tier (limited hours) - May not fit 7B model
- **A10G GPU (24GB):** ~$0.60/hour - Recommended
- **A100 GPU (40GB):** ~$3/hour - Overkill for this use case

### Recommendations
- **Development:** Use smaller model (3B) on T4 free tier
- **Production:** A10G with 7B model for best quality/cost ratio
- **Budget:** ~$15-20/month for moderate usage

---

## ALTERNATIVE: No Adapter Approach (Simpler)

If you want to start **without training an adapter**, the system will work fine with prompt engineering only:

1. Deploy the Space as-is (skip adapter upload)
2. System uses specialized prompts for each benchmark type
3. Quality will be good (80-90% of adapter performance)
4. Can add adapter later without changing backend code

This is recommended for **hackathon/prototype** to ship faster!

---

## INTEGRATION WITH YOUR BACKEND

Once deployed, update your `.env` file:

```env
HF_JUDGE_SPACE_ENDPOINT="https://YOUR_USERNAME-judge-model-space.hf.space"
```

Your backend in `services/llmservice.js` and `services/judgeservice.js` will call this endpoint automatically.

The adapter selection is handled automatically:
- AIME benchmarks → `adapter: "math"`
- MSUR benchmarks → `adapter: "msur"`  
- MMLU benchmarks → `adapter: "mmlu"`
- Custom datasets → `adapter: "custom"`

---

## TROUBLESHOOTING

### Out of Memory
- Use smaller base model (3B instead of 7B)
- Upgrade to A100 GPU
- Reduce max_tokens

### Adapter Not Loading
- Check `math_adapter/` folder exists
- Verify adapter files are present
- Check logs for error messages
- System will fallback to prompts if adapter fails

### Poor Evaluation Quality
- Improve system prompts
- Train better math adapter
- Use larger base model
- Adjust temperature (lower = more consistent)

---

## NEXT STEPS
1. Deploy this Space with or without math adapter
2. Test with backend: All benchmark endpoints should work
3. Monitor quality and decide if math adapter training is worth it
4. Update your backend .env with the Space URL
