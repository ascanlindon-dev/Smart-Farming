"""One locally loaded image encoder shared by leaf and rambutan checks."""
from pathlib import Path
from threading import Lock

WEIGHTS = Path(__file__).resolve().parent / 'models' / 'rambutan_guard' / 'open_clip_model.safetensors'
MODEL_NAME = 'ViT-B-32'


class VerifierUnavailable(RuntimeError):
    pass


class ImageVerifier:
    def __init__(self):
        if not WEIGHTS.is_file():
            raise VerifierUnavailable('Run backend/scripts/setup_rambutan_guard.py first')
        import torch
        import open_clip

        torch.set_num_threads(min(torch.get_num_threads(), 4))
        self.model, _, self.preprocess = open_clip.create_model_and_transforms(
            MODEL_NAME, pretrained=str(WEIGHTS), device='cpu',
        )
        self.model.eval()
        self.tokenizer = open_clip.get_tokenizer(MODEL_NAME)
        self.text_features = {}
        self.lock = Lock()

    def compare(self, image, descriptions):
        import torch
        from PIL import ImageOps

        # Check the complete uploaded photo, not just a center crop.
        square = ImageOps.pad(image.convert('RGB'), (224, 224), color=(127, 127, 127))
        tensor = self.preprocess(square).unsqueeze(0)
        descriptions = tuple(descriptions)
        with self.lock, torch.inference_mode():
            if descriptions not in self.text_features:
                tokens = self.tokenizer([f'A photo of {description}.' for description in descriptions])
                self.text_features[descriptions] = self.model.encode_text(tokens, normalize=True)
            features = self.model.encode_image(tensor, normalize=True)
            return (features @ self.text_features[descriptions].T)[0].cpu().numpy()


_verifier = None
_load_lock = Lock()


def compare_descriptions(image, descriptions):
    global _verifier
    try:
        with _load_lock:
            if _verifier is None:
                _verifier = ImageVerifier()
        return _verifier.compare(image, descriptions)
    except VerifierUnavailable:
        raise
    except Exception as exc:
        raise VerifierUnavailable('Image verification is unavailable') from exc
