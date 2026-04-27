import os
import re

def patch_logo_scale():
    root_dir = "/Users/franciscolozano/Desktop/Antigravity_Romet/GitHub/web-joyeria"
    
    # Let's match the <img> and the <span>
    pattern = re.compile(r'(<img\s+[^>]*?src="([^"]*logo-romet\.png)"[^>]*?>)\s*(<span[^>]*>Romet Joyería</span>)', re.IGNORECASE)

    count = 0
    for root, dirs, files in os.walk(root_dir):
        for file in files:
            if file.endswith(".html"):
                path = os.path.join(root, file)
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                def replace_func(match):
                    img_src = match.group(2)
                    span_tag = match.group(3)
                    
                    # - We use height: 45px for layout (keeps header slim)
                    # - transform: scale(1.65) visually 'crops' the image by making it 65% bigger without expanding the header
                    # - transform-origin: left center keeps it anchored to the left
                    # - margin-right: 16px ensures it doesn't overlap the text "ROMET JOYERÍA" after scaling
                    new_img = f'<img src="{img_src}" alt="Romet Joyería Logo" style="height: 45px; width: auto; mix-blend-mode: multiply; transform: scale(1.7); transform-origin: left center; margin-right: 18px;">'
                    
                    return f"{new_img}\n\t\t\t\t\t{span_tag}"
                
                new_content = pattern.sub(replace_func, content)
                
                if new_content != content:
                    with open(path, 'w', encoding='utf-8') as f:
                        f.write(new_content)
                    print(f"Patched: {path}")
                    count += 1
    
    print(f"Total files patched: {count}")

if __name__ == "__main__":
    patch_logo_scale()
