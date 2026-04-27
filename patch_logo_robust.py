import os
import re

def robust_patch():
    root_dir = "/Users/franciscolozano/Desktop/Antigravity_Romet/GitHub/web-joyeria"
    
    # Very flexible pattern to find any <img> tag that has logo-romet.png inside
    pattern = re.compile(r'<img[^>]*src="([^"]*logo-romet\.png)"[^>]>', re.IGNORECASE)

    count = 0
    for root, dirs, files in os.walk(root_dir):
        for file in files:
            if file.endswith(".html"):
                path = os.path.join(root, file)
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # We want to catch the src group and replace the whole tag
                # Note: This might be slightly risky if there are multiple logos with different src, 
                # but we'll use the captured src (\1)
                
                # New standardized tag
                # Size: h-14 md:h-16 (Intermediate)
                new_tag_template = r'<img src="\1" alt="Romet Joyería" class="h-14 md:h-16 w-auto" style="mix-blend-mode: multiply;">'
                
                new_content = pattern.sub(new_tag_template, content)
                
                if new_content != content:
                    with open(path, 'w', encoding='utf-8') as f:
                        f.write(new_content)
                    print(f"Patched: {path}")
                    count += 1
    
    print(f"Total files patched: {count}")

if __name__ == "__main__":
    robust_patch()
