import os
import re

replacements = {
    # Headers
    'Categoría de Producto': 'Product Category',
    'Siguiente': 'Next',
    
    # Form Paso 7 / Upload
    'Tu correo electrónico': 'Your email address',
    'Tu nombre completo': 'Your full name',
    'Nombre completo': 'Full name',
    'Tu teléfono': 'Your phone number',
    'Teléfono': 'Phone',
    '¿Tienes alguna idea adicional? (Opcional)': 'Do you have any additional ideas? (Optional)',
    'Ej. Quiero que la banda sea muy fina': 'E.g. I want the band to be very thin',
    
    # Rest of missed texts
    'Generar diseño con IA': 'Generate AI design',
    'Medallas': 'Medallions',
    'Volver al inicio de sesión': 'Back to login',
}

# Image sources fixing
src_replacements = [
    ('src="./designer-paso', 'src="../designer-paso'),
    ('src="./upload-design', 'src="../upload-design'),
    ('src="./index_files', 'src="../index_files'),
    ('src="designer-paso', 'src="../designer-paso'),
]

files_to_translate = ['upload-design.html'] + [f'designer-paso{i}.html' for i in range(1, 8)]

for file in files_to_translate:
    # Read from original Spanish file to translate anew, preventing double-translating en/ or appending
    # Wait, if we read the original Spanish, it STILL needs the previous translations.
    # It's better to modify the EXISTING EN files directly!
    en_file = 'en/' + file
    if not os.path.exists(en_file):
        continue
    
    with open(en_file, 'r', encoding='utf-8') as f:
        text = f.read()
    
    # Apply new text replacements
    for es, en in replacements.items():
        text = text.replace(es, en)
        
    # Apply src replacements to fix images
    for bad, good in src_replacements:
        text = text.replace(bad, good)
        
    # Also fix anything like src="./images/ to src="../images/
    text = text.replace('src="./', 'src="../')
    
    # Re-fix the JS and favicon because src="../" might become src="../../"
    text = text.replace('src="../../js/', 'src="../js/')
    text = text.replace('src="../../favicon.png', 'src="../favicon.png')
    text = text.replace('href="../../', 'href="../')

    # Any remaining href to css
    text = text.replace('href="./designer-paso', 'href="../designer-paso')
    text = text.replace('href="../designer-paso1.html', 'href="./designer-paso1.html')
    text = text.replace('href="../designer-paso2.html', 'href="./designer-paso2.html')
    text = text.replace('href="../designer-paso3.html', 'href="./designer-paso3.html')
    text = text.replace('href="../designer-paso4.html', 'href="./designer-paso4.html')
    text = text.replace('href="../designer-paso5.html', 'href="./designer-paso5.html')
    text = text.replace('href="../designer-paso6.html', 'href="./designer-paso6.html')
    text = text.replace('href="../designer-paso7.html', 'href="./designer-paso7.html')
    text = text.replace('href="../upload-design.html', 'href="./upload-design.html')
    text = text.replace('href="../login.html', 'href="./login.html')
    text = text.replace('href="../index.html', 'href="./index.html')
    # Actually if they link back to index in english it should be ./index.html
    # But logo links to https://rometjoyeria.com/ -> Let's make it link to ./index.html
    text = text.replace('href="https://rometjoyeria.com/"', 'href="./index.html"')

    with open(en_file, 'w', encoding='utf-8') as f:
        f.write(text)

print("Patching complete.")
