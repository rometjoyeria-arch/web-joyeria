import os
import re

def robust_patch_v2():
    root_dir = "/Users/franciscolozano/Desktop/Antigravity_Romet/GitHub/web-joyeria"
    
    # Flexible pattern: matches <img ... src="...logo-romet.png" ... >
    # We use a non-greedy .*? to catch other attributes
    pattern = re.compile(r'<img\s+[^>]*?src="([^"]*logo-romet\.png)"[^>]*?>', re.IGNORECASE)

    count = 0
    for root, dirs, files in os.walk(root_dir):
        for file in files:
            if file.endswith(".html"):
                path = os.path.join(root, file)
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # Intermediate size: h-14 md:h-16
                new_tag_template = r'<img src="\1" alt="Romet Joyería" class="h-14 md:h-16 w-auto" style="mix-blend-mode: multiply;">'
                
                new_content = pattern.sub(new_tag_template, content)
                
                if new_content != content:
                    with open(path, 'w', encoding='utf-8') as f:
                        f.write(new_content)
                    print(f"Patched: {path}")
                    count += 1
    
    print(f"Total files patched: {count}")

if __name__ == "__main__":
    robust_patch_v2()
