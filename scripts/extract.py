import tarfile
import os
from pathlib import Path

# Folder containing the .tar.gz files (change if needed)
source_dir = Path("D:\Mental_health\extended daic-woz")

# Whether to extract each archive into its own subfolder
extract_into_own_folder = True

for file in source_dir.glob("*.tar.gz"):
    print(f"Extracting {file.name}...")
    
    if extract_into_own_folder:
        out_dir = source_dir / file.stem.replace(".tar", "")
        out_dir.mkdir(exist_ok=True)
    else:
        out_dir = source_dir

    with tarfile.open(file, "r:gz") as tar:
        tar.extractall(path=out_dir)

print("Done.")