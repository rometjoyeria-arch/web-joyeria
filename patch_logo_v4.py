import os
import re

def patch_everything():
    root_dir = "/Users/franciscolozano/Desktop/Antigravity_Romet/GitHub/web-joyeria"
    
    # 1. Pattern to replace existing image logos (updating classes/styles)
    img_pattern = re.compile(r'<img\s+src="[^"]*logo-romet\.png"[^>]*class="[^"]*"[^>]*>')
    
    # 2. Pattern to replace text logos (ROMET IA) inside the <a> tag in the header
    text_pattern = re.compile(r'<a[^>]*href="[^"]*(?:index\.html|rometjoyeria\.com/)"[^>]*>\s*<span[^>]*class="logo-text"[^>]*>ROMET\s+IA</span>\s*</a>', re.IGNORECASE)
    
    # 3. Alternative pattern for text logos without spans
    alt_text_pattern = re.compile(r'<a[^>]*href="[^"]*(?:index\.html|rometjoyeria\.com/)"[^>]*>\s*ROMET\s+IA\s*</a>', re.IGNORECASE)

    count = 0
    for root, dirs, files in os.walk(root_dir):
        for file in files:
            if file.endswith(".html"):
                path = os.path.join(root, file)
                # Determine relative path to root for logo.png
                rel_depth = root.replace(root_dir, "").count(os.sep)
                prefix = "./" if rel_depth == 0 else "../" * rel_depth
                logo_path = prefix + "logo-romet.png"
                
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # Replace existing images to standardize
                new_content = img_pattern.sub(
                    f'<img src="{logo_path}" alt="Romet Joyería" class="h-10 md:h-12 w-auto" style="mix-blend-mode: multiply;">',
                    content
                )
                
                # Replace text versions with the image version
                # We target the specific <a> tag structure
                replacement = f'<a class="hover:opacity-70 transition-opacity" href="{prefix}index.html"><img src="{logo_path}" alt="Romet Joyería" class="h-10 md:h-12 w-auto" style="mix-blend-mode: multiply;"></a>'
                
                new_content = text_pattern.sub(replacement, new_content)
                new_content = alt_text_pattern.sub(replacement, new_content)
                
                if new_content != content:
                    with open(path, 'w', encoding='utf-8') as f:
                        f.write(new_content)
                    print(f"Patched: {path}")
                    count += 1
    
    print(f"Total files patched: {count}")

if __name__ == "__main__":
    patch_everything()
