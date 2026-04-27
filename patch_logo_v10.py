import os
import re

def patch_logo_with_text():
    root_dir = "/Users/franciscolozano/Desktop/Antigravity_Romet/GitHub/web-joyeria"
    
    # We find the <a> tag wrapping the <img> tag
    img_pattern = re.compile(r'(<a[^>]*>)\s*(<img\s+[^>]*?src="([^"]*logo-romet\.png)"[^>]*?>)\s*(</a>)', re.IGNORECASE)

    count = 0
    for root, dirs, files in os.walk(root_dir):
        for file in files:
            if file.endswith(".html"):
                path = os.path.join(root, file)
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                def replace_func(match):
                    a_tag = match.group(1)
                    img_src = match.group(3)
                    a_end = match.group(4)
                    
                    # Prevent multiple injections of style
                    if 'display:flex; align-items:center; gap:16px;' not in a_tag:
                        if 'style=' in a_tag:
                            a_tag = re.sub(r'style="([^"]*)"', r'style="\1 display:flex; align-items:center; gap:16px; text-decoration:none;"', a_tag)
                        else:
                            a_tag = a_tag.replace('href=', 'style="display:flex; align-items:center; gap:16px; text-decoration:none;" href=')
                        
                    new_img = f'<img src="{img_src}" alt="Romet Joyería Logo" style="height: 48px; width: auto; mix-blend-mode: multiply;">'
                    
                    # Note: We conditionally render the text. "hidden md:block" handles hiding it on mobile and showing it on desktop.
                    new_span = '<span class="hidden md:block text-2xl tracking-[0.2em] uppercase font-bold whitespace-nowrap text-foreground" style="font-family: \'Cormorant Garamond\', serif; letter-spacing: 0.15em;">Romet Joyería</span>'
                    
                    return f"{a_tag}\n\t\t\t\t\t{new_img}\n\t\t\t\t\t{new_span}\n\t\t\t\t{a_end}"
                
                new_content = img_pattern.sub(replace_func, content)
                
                if new_content != content:
                    with open(path, 'w', encoding='utf-8') as f:
                        f.write(new_content)
                    print(f"Patched: {path}")
                    count += 1
    
    print(f"Total files patched: {count}")

if __name__ == "__main__":
    patch_logo_with_text()
