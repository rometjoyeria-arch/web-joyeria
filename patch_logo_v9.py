import os
import re

def patch_logo_v9_inline():
    root_dir = "/Users/franciscolozano/Desktop/Antigravity_Romet/GitHub/web-joyeria"
    
    # Matches any img tag with logo-romet.png
    pattern = re.compile(r'<img\s+[^>]*?src="([^"]*logo-romet\.png)"[^>]*?>', re.IGNORECASE)

    count = 0
    for root, dirs, files in os.walk(root_dir):
        for file in files:
            if file.endswith(".html"):
                path = os.path.join(root, file)
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # We completely drop the Tailwind classes for height to prevent any compilation issues
                # and use rock-solid inline CSS styles. 
                new_tag_template = r'<img src="\1" alt="Romet Joyería" style="height: 48px; width: auto; mix-blend-mode: multiply;">'
                
                new_content = pattern.sub(new_tag_template, content)
                
                if new_content != content:
                    with open(path, 'w', encoding='utf-8') as f:
                        f.write(new_content)
                    print(f"Patched: {path}")
                    count += 1
    
    print(f"Total files patched: {count}")

if __name__ == "__main__":
    patch_logo_v9_inline()
