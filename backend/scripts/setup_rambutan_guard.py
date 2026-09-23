"""Download the local rambutan verifier once; prediction never downloads models."""
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
os.environ.setdefault('HF_HOME', str(ROOT / '.cache' / 'huggingface'))
os.environ.setdefault('HF_HUB_DISABLE_XET', '1')


def main():
    from huggingface_hub import hf_hub_download

    path = hf_hub_download(
        repo_id='laion/CLIP-ViT-B-32-laion2B-s34B-b79K',
        revision='1a25a446712ba5ee05982a381eed697ef9b435cf',
        filename='open_clip_model.safetensors',
        local_dir=ROOT / 'backend' / 'models' / 'rambutan_guard',
    )
    print(f'Rambutan verifier downloaded: {path}')
    print('Restart Django after setup. Photos are processed locally.')


if __name__ == '__main__':
    main()
