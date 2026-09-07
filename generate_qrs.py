import os
import sys
import base64
from io import BytesIO

# Add local pip packages
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'pip_packages'))

import qrcode
import qrcode.image.svg
from PIL import Image, ImageDraw, ImageOps

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), 'qr_codes')
os.makedirs(OUTPUT_DIR, exist_ok=True)

URL_DIRECT = "https://rometjoyeria.com"
URL_TRACKED = "https://rometjoyeria.com/?utm_source=flyer&utm_medium=print&utm_campaign=lanzamiento"

def generate_svg(url, filename):
    factory = qrcode.image.svg.SvgPathImage
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=20,
        border=4,
        image_factory=factory
    )
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    filepath = os.path.join(OUTPUT_DIR, filename)
    img.save(filepath)
    print(f"Generated SVG: {filepath}")
    return filepath

def generate_highres_png(url, filename, logo_mode=None):
    # Box size 60 gives ~2500x2500 px which is > 20cm at 300 DPI (ideal for print)
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=60,
        border=4,
    )
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white").convert("RGBA")
    
    qr_w, qr_h = img.size
    
    if logo_mode == "icon":
        # Using favicon.png as the center icon
        fav_path = os.path.join(os.path.dirname(__file__), 'favicon.png')
        if os.path.exists(fav_path):
            fav = Image.open(fav_path).convert("RGBA")
            
            # Target icon size: ~20% of QR width
            icon_size = int(qr_w * 0.20)
            fav = fav.resize((icon_size, icon_size), Image.Resampling.LANCZOS)
            
            # Badge dimensions (with white margin/padding)
            badge_padding = int(icon_size * 0.15)
            badge_size = icon_size + (badge_padding * 2)
            
            badge = Image.new("RGBA", (badge_size, badge_size), (255, 255, 255, 0))
            draw = ImageDraw.Draw(badge)
            
            # Rounded rectangle background in pure white
            corner_radius = int(badge_size * 0.22)
            draw.rounded_rectangle(
                [(0, 0), (badge_size - 1, badge_size - 1)],
                radius=corner_radius,
                fill=(255, 255, 255, 255),
                outline=(220, 220, 220, 255),
                width=4
            )
            
            # Paste favicon onto badge
            badge.paste(fav, (badge_padding, badge_padding), fav if fav.mode == "RGBA" else None)
            
            # Paste badge onto QR center
            pos_x = (qr_w - badge_size) // 2
            pos_y = (qr_h - badge_size) // 2
            img.paste(badge, (pos_x, pos_y), badge)
            
    elif logo_mode == "logo":
        # Using logo-romet.png
        logo_path = os.path.join(os.path.dirname(__file__), 'logo-romet.png')
        if os.path.exists(logo_path):
            logo = Image.open(logo_path).convert("RGBA")
            
            # Target width ~28% of QR width, maintain aspect ratio
            target_w = int(qr_w * 0.28)
            aspect = logo.size[1] / logo.size[0]
            target_h = int(target_w * aspect)
            logo = logo.resize((target_w, target_h), Image.Resampling.LANCZOS)
            
            pad_x = int(target_w * 0.10)
            pad_y = int(target_h * 0.18)
            badge_w = target_w + pad_x * 2
            badge_h = target_h + pad_y * 2
            
            badge = Image.new("RGBA", (badge_w, badge_h), (255, 255, 255, 0))
            draw = ImageDraw.Draw(badge)
            corner_radius = int(min(badge_w, badge_h) * 0.25)
            draw.rounded_rectangle(
                [(0, 0), (badge_w - 1, badge_h - 1)],
                radius=corner_radius,
                fill=(255, 255, 255, 255),
                outline=(210, 210, 210, 255),
                width=4
            )
            badge.paste(logo, (pad_x, pad_y), logo if logo.mode == "RGBA" else None)
            
            pos_x = (qr_w - badge_w) // 2
            pos_y = (qr_h - badge_h) // 2
            img.paste(badge, (pos_x, pos_y), badge)

    filepath = os.path.join(OUTPUT_DIR, filename)
    # Save with 300 DPI metadata
    img.save(filepath, dpi=(300, 300))
    print(f"Generated High-Res PNG ({img.size[0]}x{img.size[1]} @ 300 DPI): {filepath}")
    return filepath

if __name__ == '__main__':
    print("Generating QR codes for Romet Joyería...")
    # 1. Standard Clean QR (Direct URL)
    generate_svg(URL_DIRECT, "qr_romet_directo_vectorial.svg")
    generate_highres_png(URL_DIRECT, "qr_romet_directo_300dpi.png", logo_mode=None)

    # 2. QR with Romet Icon (Direct URL)
    generate_highres_png(URL_DIRECT, "qr_romet_con_icono_300dpi.png", logo_mode="icon")

    # 3. QR with Full Romet Logo (Direct URL)
    generate_highres_png(URL_DIRECT, "qr_romet_con_logo_300dpi.png", logo_mode="logo")

    # 4. QR with Tracking / Analytics (UTM)
    generate_svg(URL_TRACKED, "qr_romet_campana_flyer_vectorial.svg")
    generate_highres_png(URL_TRACKED, "qr_romet_campana_flyer_300dpi.png", logo_mode="icon")
    
    print("All QR codes generated successfully!")
