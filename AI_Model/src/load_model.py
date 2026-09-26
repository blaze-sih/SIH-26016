import torch
from transformers import AutoProcessor, AutoModelForVision2Seq, BitsAndBytesConfig
from peft import PeftModel

def load_lora_model(base_model_id="Qwen/Qwen2.5-VL-3B-Instruct", lora_path="/content/drive/MyDrive/marathi-ocr-model/lora_adapter"):
    """
    Loads the base Qwen vision model in 4-bit and applies the saved LoRA adapter.
    """
    print(f"Loading base model: {base_model_id} with 4-bit quantization...")
    
    # Configure 4-bit Quantization
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_compute_dtype=torch.bfloat16,
        bnb_4bit_use_double_quant=True,
        bnb_4bit_quant_type="nf4"
    )

    # Load base model
    model = AutoModelForVision2Seq.from_pretrained(
        base_model_id,
        quantization_config=bnb_config,
        device_map="auto" # Automatically map layers to available GPUs/CPU
    )
    
    print("Loading processor...")
    # Load processor (you can also load this from the lora_path if you saved it there)
    try:
        processor = AutoProcessor.from_pretrained(lora_path)
        print("Loaded processor from LoRA directory.")
    except:
        processor = AutoProcessor.from_pretrained(base_model_id)
        print("Loaded processor from base model directory.")
        
    print(f"Loading LoRA weights from: {lora_path}...")
    # Apply the LoRA adapter weights
    model = PeftModel.from_pretrained(model, lora_path)
    
    print("✅ Model and LoRA adapter loaded successfully!")
    return model, processor

if __name__ == "__main__":
    # You can change this path if you move the weights locally to models/
    saved_adapter_path = "/content/drive/MyDrive/marathi-ocr-model/lora_adapter"
    
    model, processor = load_lora_model(lora_path=saved_adapter_path)
    
    # Now you can use `model` and `processor` for inference.
    # print(model)
