import os
import re

def patch_logo_v8_final():
    root_dir = "/Users/franciscolozano/Desktop/Antigravity_Romet/GitHub/web-joyeria"
    
    # Flexible pattern
    pattern = re.compile(r'<img\s+[^>]*?src="([^"]*logo-romet\.png)"[^>]*?>', re.IGNORECASE)

    count = 0
    for root, dirs, files in os.walk(root_dir):
        for file in files:
            if file.endswith(".html"):
                path = os.path.join(root, file)
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # h-14 is 56px (perfect for mobile). md:h-[60px] is the balance between 56px (too small) and 64px (too big)
                new_tag_template = r'<img src="\1" alt="Romet Joyería" class="h-14 md:h-[60px] w-auto" style="mix-blend-mode: multiply;">'
                
                new_content = pattern.sub(new_tag_template, content)
                
                if new_content != content:
                    with open(path, 'w', encoding='utf-8') as f:
                        f.write(new_content)
                    print(f"Patched: {path}")
                    count += 1
    
    print(f"Total files patched: {count}")

if __name__ == "__main__":
    patch_logo_v8_final()
