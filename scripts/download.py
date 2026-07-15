import os
import requests
from tqdm import tqdm
from concurrent.futures import ThreadPoolExecutor

BASE_URL = "https://dcapswoz.ict.usc.edu/wwwedaic/data/"
SAVE_DIR = r"D:\Mental_health\extended daic-woz"    # Save location

os.makedirs(SAVE_DIR, exist_ok=True)

def download(i):
    filename = f"{i}_P.tar.gz"
    url = BASE_URL + filename
    filepath = os.path.join(SAVE_DIR, filename)

    if os.path.exists(filepath):
        print(f"Skipping {filename}")
        return

    r = requests.get(url, stream=True)

    if r.status_code != 200:
        print(f"{filename} not found")
        return

    total = int(r.headers.get("content-length", 0))

    with open(filepath, "wb") as f, tqdm(
        total=total,
        unit="B",
        unit_scale=True,
        desc=filename,
    ) as bar:
        for chunk in r.iter_content(chunk_size=1024 * 1024):
            if chunk:
                f.write(chunk)
                bar.update(len(chunk))

    print(f"Finished {filename}")

with ThreadPoolExecutor(max_workers=4) as executor:
    executor.map(download, range(451, 488))

print("All downloads complete!")