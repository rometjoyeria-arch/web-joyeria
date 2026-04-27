import os
import re

def patch_logo_v7():
    root_dir = "/Users/franciscolozano/Desktop/Antigravity_Romet/GitHub/web-joyeria"
    
    # Target the <img> tag with any attributes
    img_pattern = re.compile(r'<img\s+src="([^"]*logo-romet\.png)"[^>]*class="[^"]*"[^>]*style="[^"]*"[^>]*>', re.IGNORECASE)

    count = 0
    for root, dirs, files in os.walk(root_dir):
        for file in files:
            if file.endswith(".html"):
                path = os.path.join(root, file)
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # Update image size to h-14 md:h-16 (Goldilocks attempt)
                replacement = r'<img src="\1" alt="Romet Joyería" class="h-14 md:h-16 w-auto" style="mix-blend-mode: multiply;">'
                
                new_content = img_pattern.sub(replacement, content)
                
                if new_content != content:
                    with open(path, 'w', encoding='utf-8') as f:
                        f.write(new_content)
                    print(f"Patched: {path}")
                    count += 1
    
    print(f"Total files patched: {count}")

if __name__ == "__main__":
    patch_logo_v7()
