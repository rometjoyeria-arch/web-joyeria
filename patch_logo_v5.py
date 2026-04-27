import os
import re

def patch_logo_v5():
    root_dir = "/Users/franciscolozano/Desktop/Antigravity_Romet/GitHub/web-joyeria"
    
    # Pattern to find any image logo inside an <a> tag
    # We want to remove hover effects and increase size
    
    # 1. Target the <a> tag around the logo
    a_pattern = re.compile(r'<a\s+class="[^"]*hover:opacity-70[^"]*"[^>]*href="([^"]*(?:index\.html|rometjoyeria\.com/))"[^>]*>', re.IGNORECASE)
    
    # 2. Target the <img> tag itself
    img_pattern = re.compile(r'<img\s+src="([^"]*logo-romet\.png)"[^>]*class="[^"]*"[^>]*style="[^"]*"[^>]*>', re.IGNORECASE)
    # Also catch those without style if any
    img_pattern_no_style = re.compile(r'<img\s+src="([^"]*logo-romet\.png)"[^>]*class="[^"]*"[^>]*>', re.IGNORECASE)

    count = 0
    for root, dirs, files in os.walk(root_dir):
        for file in files:
            if file.endswith(".html"):
                path = os.path.join(root, file)
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # Remove hover:opacity-70 from the parent <a>
                new_content = a_pattern.sub(r'<a href="\1">', content)
                
                # Update image size to h-14 md:h-18 (slightly larger) and ensure multiply blend
                replacement = r'<img src="\1" alt="Romet Joyería" class="h-14 md:h-18 w-auto" style="mix-blend-mode: multiply;">'
                
                # Try with style first, then without
                new_content = re.sub(r'<img\s+src="([^"]*logo-romet\.png)"[^>]*class="[^"]*"[^>]*style="[^"]*"[^>]*>', replacement, new_content, flags=re.IGNORECASE)
                new_content = re.sub(r'<img\s+src="([^"]*logo-romet\.png)"[^>]*class="[^"]*"[^>]*>', replacement, new_content, flags=re.IGNORECASE)
                
                if new_content != content:
                    with open(path, 'w', encoding='utf-8') as f:
                        f.write(new_content)
                    print(f"Patched: {path}")
                    count += 1
    
    print(f"Total files patched: {count}")

if __name__ == "__main__":
    patch_logo_v5()
