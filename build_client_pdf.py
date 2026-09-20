import os
import sys

# Add local packages
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'pip_packages'))

from fpdf import FPDF

class ClientGuidePDF(FPDF):
    def footer(self):
        self.set_y(-16)
        self.set_font('ArialCustom', '', 8.5)
        self.set_text_color(130, 130, 130)
        self.cell(0, 10, 'Romet Joyería  •  Alta Joyería Personalizada  •  https://rometjoyeria.com', align='C')

def generate_pdf():
    pdf = ClientGuidePDF(orientation='P', unit='mm', format='A4')
    pdf.set_auto_page_break(auto=False)
    
    # Fonts
    font_regular = '/System/Library/Fonts/Supplemental/Arial.ttf'
    font_bold = '/System/Library/Fonts/Supplemental/Arial Bold.ttf'
    font_italic = '/System/Library/Fonts/Supplemental/Arial Italic.ttf'
    
    pdf.add_font('ArialCustom', '', font_regular)
    pdf.add_font('ArialCustom', 'B', font_bold)
    pdf.add_font('ArialCustom', 'I', font_italic)
    
    pdf.add_page()
    
    # ── 1. Top Decorative Bar (Gold Accent) ──
    pdf.set_fill_color(184, 134, 11) # Gold
    pdf.rect(0, 0, 210, 4.5, style='F')
    
    # ── 2. Brand Header & Logo ──
    logo_path = os.path.join(os.path.dirname(__file__), 'logo-romet.png')
    if os.path.exists(logo_path):
        # Center logo: width 48mm, placed around y=12
        pdf.image(logo_path, x=(210 - 48)/2, y=12, w=48)
        header_y = 38
    else:
        pdf.set_y(15)
        pdf.set_font('ArialCustom', 'B', 20)
        pdf.set_text_color(24, 24, 24)
        pdf.cell(0, 8, 'ROMET JOYERÍA', align='C', new_x='LMARGIN', new_y='NEXT')
        header_y = 28

    # ── 3. Document Titles ──
    pdf.set_y(header_y)
    pdf.set_font('ArialCustom', 'B', 17)
    pdf.set_text_color(24, 24, 24)
    pdf.cell(0, 8, 'Código QR Oficial para Flyer e Imprenta', align='C', new_x='LMARGIN', new_y='NEXT')
    
    pdf.set_font('ArialCustom', '', 9.5)
    pdf.set_text_color(115, 115, 115)
    pdf.cell(0, 5, 'Ficha técnica y recomendaciones de aplicación en material publicitario', align='C', new_x='LMARGIN', new_y='NEXT')
    
    # Subtle separator line
    pdf.set_draw_color(225, 222, 215)
    pdf.set_line_width(0.4)
    pdf.line(40, header_y + 16, 170, header_y + 16)
    
    # ── 4. Main Section: Left Card (QR Preview) + Right Column (Instructions) ──
    start_y = header_y + 22
    card_w = 80
    card_h = 108
    card_x = 16
    
    # Left Card Background
    pdf.set_fill_color(250, 249, 247) # Warm light cream/luxury tone
    pdf.set_draw_color(228, 224, 216)
    pdf.rect(card_x, start_y, card_w, card_h, style='FD', round_corners=True, corner_radius=3.5)
    
    # QR Image inside Card
    qr_path = '/Users/franciscolozano/Desktop/Antigravity_Romet/Codigos_QR_Flyer/QR_Romet_Oficial.png'
    qr_size = 64
    qr_x = card_x + (card_w - qr_size) / 2
    qr_y = start_y + 8
    pdf.image(qr_path, x=qr_x, y=qr_y, w=qr_size, h=qr_size)
    
    # URL and Scan Notice under QR
    pdf.set_xy(card_x, start_y + 75)
    pdf.set_font('ArialCustom', 'B', 10.5)
    pdf.set_text_color(184, 134, 11) # Gold
    pdf.cell(card_w, 5.5, 'https://rometjoyeria.com', align='C', new_x='LMARGIN', new_y='NEXT')
    
    pdf.set_x(card_x + 4)
    pdf.set_font('ArialCustom', '', 8)
    pdf.set_text_color(90, 90, 90)
    pdf.multi_cell(card_w - 8, 4, 'Escaneo directo con la cámara nativa del teléfono (iOS y Android) sin instalar aplicaciones adicionales.', align='C')
    
    # Badge at bottom of card
    pdf.set_xy(card_x + 14, start_y + 94)
    pdf.set_fill_color(240, 235, 222)
    pdf.set_draw_color(210, 202, 185)
    pdf.rect(card_x + 12, start_y + 93, card_w - 24, 7, style='FD', round_corners=True, corner_radius=2)
    pdf.set_font('ArialCustom', 'B', 7.5)
    pdf.set_text_color(130, 95, 10)
    pdf.set_xy(card_x + 12, start_y + 94.5)
    pdf.cell(card_w - 24, 4.5, 'LISTO PARA IMPRENTA • ALTA DEFINICIÓN', align='C')

    # ── Right Column: Pautas de uso para el cliente y diseñador ──
    rx = 104
    rw = 90
    
    def render_block(title, description, current_y, icon='•'):
        # Title
        pdf.set_xy(rx, current_y)
        pdf.set_font('ArialCustom', 'B', 10)
        pdf.set_text_color(24, 24, 24)
        pdf.cell(rw, 5, f"{icon}  {title}", new_x='LMARGIN', new_y='NEXT')
        
        # Text
        pdf.set_xy(rx + 4, current_y + 5.5)
        pdf.set_font('ArialCustom', '', 8.5)
        pdf.set_text_color(70, 70, 70)
        pdf.multi_cell(rw - 4, 4.3, description, align='L')
        return current_y + 24

    y_cursor = start_y + 2
    
    y_cursor = render_block(
        '1. ¿A dónde dirige este código?',
        'Al enfocarlo con la cámara del smartphone, abre automáticamente la página web principal de Romet Joyería. El usuario accede directamente a la experiencia de alta joyería y al diseñador exclusivo.',
        y_cursor,
        icon='1'
    )
    
    y_cursor = render_block(
        '2. Tamaño recomendado en el flyer',
        '• Tamaño óptimo: entre 2,5 cm y 3,5 cm de ancho.\n• Tamaño mínimo: no reducir por debajo de 2,0 cm para garantizar que cualquier teléfono lo lea de inmediato a una distancia cómoda.',
        y_cursor + 2,
        icon='2'
    )
    
    y_cursor = render_block(
        '3. Fondo y margen de seguridad',
        '• Mantenga siempre el recuadro blanco alrededor del código.\n• Si el diseño del flyer tiene fondo oscuro, textura o fotografía, asegúrese de colocar el código sobre su recuadro blanco para que la cámara enfoque al instante.',
        y_cursor + 4,
        icon='3'
    )
    
    render_block(
        '4. Ubicación estratégica en el diseño',
        'Se recomienda colocarlo en el reverso o en la parte inferior del folleto, acompañado de una frase clara que invite a la acción (ej. «Escanea para diseñar tu joya exclusiva»).',
        y_cursor + 6,
        icon='4'
    )

    # ── 5. Bottom Section: Archivos para la Imprenta / Diseñador ──
    box_y = start_y + card_h + 8
    box_h = 42
    pdf.set_fill_color(245, 246, 248)
    pdf.set_draw_color(225, 227, 232)
    pdf.rect(16, box_y, 178, box_h, style='FD', round_corners=True, corner_radius=3.5)
    
    pdf.set_xy(22, box_y + 5)
    pdf.set_font('ArialCustom', 'B', 10.5)
    pdf.set_text_color(24, 24, 24)
    pdf.cell(166, 5, 'Archivos adjuntos disponibles en la carpeta oficial:', new_x='LMARGIN', new_y='NEXT')
    
    # File 1: SVG
    pdf.set_xy(24, box_y + 12.5)
    pdf.set_font('ArialCustom', 'B', 9)
    pdf.set_text_color(184, 134, 11)
    pdf.cell(45, 4.5, '•  QR_Romet_Oficial.svg')
    pdf.set_font('ArialCustom', '', 8.5)
    pdf.set_text_color(70, 70, 70)
    pdf.cell(120, 4.5, 'Formato vectorial para imprenta profesional (Illustrator, InDesign). Escalable sin límites.', new_x='LMARGIN', new_y='NEXT')
    
    # File 2: PNG
    pdf.set_xy(24, box_y + 18.5)
    pdf.set_font('ArialCustom', 'B', 9)
    pdf.set_text_color(184, 134, 11)
    pdf.cell(45, 4.5, '•  QR_Romet_Oficial.png')
    pdf.set_font('ArialCustom', '', 8.5)
    pdf.set_text_color(70, 70, 70)
    pdf.cell(120, 4.5, 'Imagen de alta definición a 300 DPI (2700×2700 px). Lista para Canva, Photoshop o web.', new_x='LMARGIN', new_y='NEXT')

    # Recommendation note
    pdf.set_xy(24, box_y + 26.5)
    pdf.set_font('ArialCustom', 'I', 8.5)
    pdf.set_text_color(100, 100, 100)
    pdf.multi_cell(162, 4.2, 'Nota para el impresor o maquetador: Entregue el archivo .svg a su diseñador para garantizar la máxima nitidez sobre papel couche, estucado o cartulina de alta gama.', align='L')

    # Output files
    dest_path = '/Users/franciscolozano/Desktop/Antigravity_Romet/Codigos_QR_Flyer/Codigo_QR_Romet_Instrucciones_Cliente.pdf'
    pdf.output(dest_path)
    print(f"PDF created at: {dest_path}")
    
    # Also copy to artifacts dir
    artifact_path = '/Users/franciscolozano/.gemini/antigravity/brain/ab56af6c-e9b8-45a9-accb-c0594e444459/Codigo_QR_Romet_Instrucciones_Cliente.pdf'
    pdf.output(artifact_path)
    print(f"PDF copied to artifact dir: {artifact_path}")

if __name__ == '__main__':
    generate_pdf()
